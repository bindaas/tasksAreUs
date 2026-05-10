"""Claude API integration: beliefs generation and conversational UI."""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..models import (
    AICostLog, Belief, BeliefStatusEnum, BeliefTypeEnum,
    Conversation, Label, Message, RoleEnum, StateEnum, Task,
)
from ..services.task_service import create_task, complete_task as svc_complete_task


def _anthropic_client():
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")
    import anthropic
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _log_cost(
    db: Session,
    user_id: str,
    feature: str,
    usage,
) -> None:
    input_cost = (usage.input_tokens / 1_000_000) * settings.CLAUDE_INPUT_COST_PER_M
    output_cost = (usage.output_tokens / 1_000_000) * settings.CLAUDE_OUTPUT_COST_PER_M
    log = AICostLog(
        user_id=user_id,
        feature=feature,
        model=settings.CLAUDE_MODEL,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        estimated_cost_usd=round(input_cost + output_cost, 6),
    )
    db.add(log)
    db.commit()


# ── Beliefs ───────────────────────────────────────────────────────────────────

def generate_beliefs(db: Session, task: Task, user_id: str) -> List[Belief]:
    client = _anthropic_client()

    # Weight accepted beliefs more heavily in the prompt
    accepted = db.query(Belief).filter(
        Belief.user_id == user_id,
        Belief.status == BeliefStatusEnum.accepted,
    ).all()
    accepted_context = ""
    if accepted:
        examples = []
        for b in accepted[:20]:
            if b.belief_type == BeliefTypeEnum.label_suggestion and b.label:
                examples.append(f"  - label {b.label.category}:{b.label.value} was accepted for a past task")
            elif b.belief_type == BeliefTypeEnum.time_estimate and b.estimated_minutes:
                examples.append(f"  - time estimate of {b.estimated_minutes} min was accepted for a past task")
        if examples:
            accepted_context = "\nPreviously accepted beliefs (weight these patterns higher):\n" + "\n".join(examples)

    all_labels = db.query(Label).all()
    labels_json = json.dumps([
        {"id": l.id, "category": l.category.value, "value": l.value}
        for l in all_labels
    ], indent=2)

    prompt = f"""Analyze this task and suggest labels and time estimate.

Task title: {task.title}
Task notes: {task.notes or "None"}{accepted_context}

Available labels:
{labels_json}

Return ONLY valid JSON (no markdown) with this shape:
{{
  "label_suggestions": [
    {{"label_id": "<uuid>", "reasoning": "<brief reason>"}}
  ],
  "time_estimate_minutes": <integer or null>
}}

Only suggest labels that clearly fit the task. It is fine to suggest zero labels."""

    response = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    _log_cost(db, user_id, "label_suggestion", response.usage)

    raw = response.content[0].text.strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned invalid JSON for beliefs")

    beliefs: List[Belief] = []

    for suggestion in data.get("label_suggestions", []):
        label_id = suggestion.get("label_id")
        if not label_id:
            continue
        label = db.query(Label).filter(Label.id == label_id).first()
        if not label:
            continue
        b = Belief(
            user_id=user_id,
            task_id=task.id,
            belief_type=BeliefTypeEnum.label_suggestion,
            label_id=label_id,
        )
        db.add(b)
        beliefs.append(b)

    minutes = data.get("time_estimate_minutes")
    if minutes and isinstance(minutes, int) and minutes > 0:
        b = Belief(
            user_id=user_id,
            task_id=task.id,
            belief_type=BeliefTypeEnum.time_estimate,
            estimated_minutes=minutes,
        )
        db.add(b)
        _log_cost(db, user_id, "time_estimate", response.usage)
        beliefs.append(b)

    db.commit()
    for b in beliefs:
        db.refresh(b)
    return beliefs


# ── Conversations ─────────────────────────────────────────────────────────────

_CONV_TOOLS = [
    {
        "name": "create_task",
        "description": "Create a new task for the user based on what they said.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Short task title"},
                "notes": {"type": "string", "description": "Optional additional notes"},
                "must_do_by": {"type": "string", "description": "Hard deadline YYYY-MM-DD or null"},
                "target_date": {"type": "string", "description": "Aspirational date YYYY-MM-DD or null"},
                "label_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of label IDs to apply",
                },
            },
            "required": ["title"],
        },
    },
    {
        "name": "complete_task",
        "description": "Mark an existing pending task as done.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "UUID of the task to complete"},
                "notes": {"type": "string", "description": "Optional completion notes"},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "respond_to_user",
        "description": "Send the final response to the user. Always call this last.",
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "The response message"},
                "suggested_questions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "2-3 follow-up questions the app can answer",
                },
            },
            "required": ["content", "suggested_questions"],
        },
    },
]


def handle_conversation_message(
    db: Session,
    conversation: Conversation,
    user_content: str,
    user_id: str,
) -> Tuple[Message, List[str], List[str]]:
    client = _anthropic_client()

    # Build context: pending tasks
    pending_tasks = db.query(Task).filter(
        Task.user_id == user_id,
        Task.state == StateEnum.pending,
        Task.is_deleted == False,
    ).limit(100).all()

    tasks_context = "\n".join([
        f"  - [{t.id}] {t.title}"
        + (f" (due {t.must_do_by})" if t.must_do_by else "")
        + (f" [labels: {', '.join(l.value for l in t.labels)}]" if t.labels else "")
        for t in pending_tasks
    ]) or "  (no pending tasks)"

    all_labels = db.query(Label).all()
    labels_context = "\n".join([
        f"  - [{l.id}] {l.category.value}: {l.value}"
        for l in all_labels
    ])

    today = date.today().isoformat()
    system = f"""You are a helpful task management assistant for the tasksAreUs app.
Today is {today}.

The user's pending tasks (use these IDs when calling complete_task):
{tasks_context}

Available labels (use these IDs when calling create_task):
{labels_context}

Instructions:
- If the user describes completing something, call complete_task with the matching task_id.
- If the user mentions something new to do, call create_task.
- Always finish by calling respond_to_user with a clear response and 2-3 suggested follow-up questions.
- Suggested questions must be things the app can actually answer about tasks."""

    # Build message history (last 20 turns)
    history = db.query(Message).filter(
        Message.conversation_id == conversation.id,
    ).order_by(Message.created_at.asc()).limit(20).all()

    claude_messages = []
    for msg in history:
        claude_messages.append({"role": msg.role.value, "content": msg.content})
    claude_messages.append({"role": "user", "content": user_content})

    # Store user message
    user_msg = Message(
        conversation_id=conversation.id,
        user_id=user_id,
        role=RoleEnum.user,
        content=user_content,
    )
    db.add(user_msg)
    db.flush()

    # Agentic tool-use loop
    tasks_created: List[str] = []
    tasks_completed: List[str] = []
    final_content = ""
    final_questions: List[str] = []
    total_input_tokens = 0
    total_output_tokens = 0

    for _ in range(8):  # safety limit on turns
        response = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=1024,
            system=system,
            tools=_CONV_TOOLS,
            messages=claude_messages,
        )
        total_input_tokens += response.usage.input_tokens
        total_output_tokens += response.usage.output_tokens

        # Collect tool calls from this response
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                tool_name = block.name
                tool_input = block.input
                result_text = ""

                if tool_name == "create_task":
                    try:
                        new_task = create_task(
                            db=db,
                            user_id=user_id,
                            title=tool_input["title"],
                            notes=tool_input.get("notes"),
                            must_do_by=_parse_date(tool_input.get("must_do_by")),
                            target_date=_parse_date(tool_input.get("target_date")),
                            label_ids=tool_input.get("label_ids", []),
                        )
                        tasks_created.append(new_task.id)
                        result_text = f"Created task [{new_task.id}]: {new_task.title}"
                    except Exception as e:
                        result_text = f"Error creating task: {e}"

                elif tool_name == "complete_task":
                    task_id = tool_input["task_id"]
                    task = db.query(Task).filter(
                        Task.id == task_id, Task.user_id == user_id
                    ).first()
                    if task:
                        try:
                            completed, _ = svc_complete_task(
                                db, task, tool_input.get("notes")
                            )
                            tasks_completed.append(completed.id)
                            result_text = f"Completed task: {completed.title}"
                        except Exception as e:
                            result_text = f"Error completing task: {e}"
                    else:
                        result_text = "Task not found"

                elif tool_name == "respond_to_user":
                    final_content = tool_input.get("content", "")
                    final_questions = tool_input.get("suggested_questions", [])
                    result_text = "Response recorded."

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result_text,
                })

            elif block.type == "text" and block.text.strip():
                # Claude finished with text (no more tool calls)
                if not final_content:
                    final_content = block.text.strip()

        if response.stop_reason == "end_turn" or not tool_results:
            break

        # Continue the loop with tool results
        claude_messages.append({"role": "assistant", "content": response.content})
        claude_messages.append({"role": "user", "content": tool_results})

        # Stop if respond_to_user was called
        if any(r["content"] == "Response recorded." for r in tool_results):
            break

    # Log total cost
    class _Usage:
        def __init__(self, inp, out):
            self.input_tokens = inp
            self.output_tokens = out

    _log_cost(db, user_id, "conversation", _Usage(total_input_tokens, total_output_tokens))

    if not final_content:
        final_content = "I've noted that."

    assistant_msg = Message(
        conversation_id=conversation.id,
        user_id=user_id,
        role=RoleEnum.assistant,
        content=final_content,
        suggested_questions=final_questions or None,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return assistant_msg, tasks_created, tasks_completed


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        return None
