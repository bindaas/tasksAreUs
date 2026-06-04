from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Labels ────────────────────────────────────────────────────────────────────

class LabelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    category: str
    value: str


# ── Users ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    device_uuid: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    device_uuid: str
    created_at: datetime


class MigrateRequest(BaseModel):
    device_uuid: str


class MigrateOut(BaseModel):
    user_id: str


# ── Tasks ─────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    notes: Optional[str] = None
    must_do_by: Optional[date] = None
    target_date: Optional[date] = None
    label_ids: List[str] = []
    is_high_priority: bool = False


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
    title: str
    notes: Optional[str] = None
    state: str
    must_do_by: Optional[date] = None
    target_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    recurrence_group_id: Optional[str] = None
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

class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
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


class SyncRequest(BaseModel):
    last_synced_at: datetime
    changes: SyncChanges


class SyncResponse(BaseModel):
    synced_at: datetime
    changes: SyncChanges
