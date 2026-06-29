from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Boards ────────────────────────────────────────────────────────────────────

class BoardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    is_default: bool
    is_deleted: bool
    color: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class BoardCreate(BaseModel):
    name: str


class BoardUpdate(BaseModel):
    name: Optional[str] = None
    is_default: Optional[bool] = None
    color: Optional[str] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.fullmatch(r"#[0-9a-fA-F]{6}", v):
            raise ValueError("color must be a 7-character hex string (e.g. #6366f1)")
        return v


# ── Labels ────────────────────────────────────────────────────────────────────

class LabelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    category: str
    value: str


class LabelCreate(BaseModel):
    category: str  # "mode" or "type" only
    value: str
    board_id: Optional[str] = None  # resolved to default board if omitted


class LabelUpdate(BaseModel):
    value: str


# ── Tasks ─────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    notes: Optional[str] = None
    must_do_by: Optional[date] = None
    target_date: Optional[date] = None
    label_ids: List[str] = []
    is_high_priority: bool = False
    board_id: Optional[str] = None  # resolved to default board if omitted


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    must_do_by: Optional[date] = None
    target_date: Optional[date] = None
    label_ids: Optional[List[str]] = None
    is_high_priority: Optional[bool] = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    board_id: str
    title: str
    notes: Optional[str] = None
    state: str
    must_do_by: Optional[date] = None
    target_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    labels: List[LabelOut] = []
    is_high_priority: bool = False
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


class CompleteTaskRequest(BaseModel):
    notes: Optional[str] = None


class CompleteTaskResponse(BaseModel):
    completed_task: TaskOut
    next_task: Optional[TaskOut] = None


# ── Beliefs ───────────────────────────────────────────────────────────────────

class BeliefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    belief_type: str
    label: Optional[LabelOut] = None
    estimated_minutes: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: datetime


class BeliefUpdate(BaseModel):
    status: str  # accepted | rejected


# ── Conversations ─────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    board_id: Optional[str] = None  # resolved to default board if omitted


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    board_id: str
    created_at: datetime


class MessageRequest(BaseModel):
    content: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role: str
    content: str
    suggested_questions: Optional[List[str]] = None
    created_at: datetime


class MessageActions(BaseModel):
    tasks_created: List[str] = []
    tasks_completed: List[str] = []


class SendMessageResponse(BaseModel):
    message: MessageOut
    actions: MessageActions


# ── Reports ───────────────────────────────────────────────────────────────────

class CompletionItem(BaseModel):
    task_id: str
    title: str
    completed_at: datetime
    labels: List[LabelOut]


class CompletionsReport(BaseModel):
    completions: List[CompletionItem]
    total: int


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingsOut(BaseModel):
    starter_questions: List[str] = []
    high_priority_daily_limit: int = 3


class SettingsUpdate(BaseModel):
    starter_questions: List[str]
    high_priority_daily_limit: int = Field(default=3, ge=1)


# ── Sync ──────────────────────────────────────────────────────────────────────

class TaskLabelSync(BaseModel):
    task_id: str
    label_id: str


class SyncChanges(BaseModel):
    tasks: List[Dict[str, Any]] = []
    task_labels: List[TaskLabelSync] = []
    beliefs: List[Dict[str, Any]] = []
    settings: Optional[Dict[str, Any]] = None
    boards: List[Dict[str, Any]] = []


class SyncRequest(BaseModel):
    last_synced_at: datetime
    changes: SyncChanges


class SyncResponse(BaseModel):
    synced_at: datetime
    changes: SyncChanges


# ── Focused View ───────────────────────────────────────────────────────────────

class FocusedViewConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    board_selection: str
    selected_board_ids: List[str] = []
    day_range: str


class FocusedViewConfigUpdate(BaseModel):
    board_selection: str
    selected_board_ids: List[str] = []
    day_range: str


class FocusedViewBoardGroup(BaseModel):
    board_id: str
    board_name: str
    board_color: Optional[str] = None
    tasks: List[TaskOut]


class FocusedViewTasksOut(BaseModel):
    boards: List[FocusedViewBoardGroup]
