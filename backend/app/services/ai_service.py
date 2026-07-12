"""Claude API integration: beliefs generation."""
from __future__ import annotations

import json
from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..models import AICostLog, Belief, BeliefStatusEnum, BeliefTypeEnum, Label, Task


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

    all_labels = db.query(Label).filter(Label.board_id == task.board_id).all()
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
