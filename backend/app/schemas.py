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
    category: str  # "type" only
    value: str
    board_id: Optional[str] = None  # resolved to default board if omitted


class LabelUpdate(BaseModel):
    value: str


# ── Tasks ─────────────────────────────────────────────────────────────────────

MAX_TASK_LINKS = 3
_URL_SCHEME_RE = re.compile(r"^https?://", re.IGNORECASE)


class TaskLink(BaseModel):
    id: str
    url: str = Field(max_length=2048)
    description: str = Field(max_length=200)

    @field_validator("url")
    @classmethod
    def validate_url_scheme(cls, v: str) -> str:
        if not _URL_SCHEME_RE.match(v):
            raise ValueError("url must start with http:// or https://")
        return v

    @field_validator("description")
    @classmethod
    def validate_description_non_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("description must not be empty")
        return v


def validate_task_links(raw_links: Optional[List[Dict[str, Any]]]) -> List[TaskLink]:
    """Validate a raw list of link dicts against TaskLink rules.

    Shared between Pydantic validation (POST/PUT /tasks) and the sync router,
    which ingests raw dicts and bypasses Pydantic model validation entirely.
    """
    if not raw_links:
        return []
    if len(raw_links) > MAX_TASK_LINKS:
        raise ValueError(f"A task may have at most {MAX_TASK_LINKS} links")
    return [TaskLink.model_validate(item) for item in raw_links]


class TaskCreate(BaseModel):
    title: str
    notes: Optional[str] = None
    must_do_by: Optional[date] = None
    target_date: Optional[date] = None
    label_ids: List[str] = []
    is_high_priority: bool = False
    board_id: Optional[str] = None  # resolved to default board if omitted
    links: List[TaskLink] = []

    @field_validator("links")
    @classmethod
    def validate_links_cap(cls, v: List[TaskLink]) -> List[TaskLink]:
        if len(v) > MAX_TASK_LINKS:
            raise ValueError(f"A task may have at most {MAX_TASK_LINKS} links")
        return v


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    must_do_by: Optional[date] = None
    target_date: Optional[date] = None
    label_ids: Optional[List[str]] = None
    is_high_priority: Optional[bool] = None
    links: Optional[List[TaskLink]] = None  # None = unchanged; any list (incl. []) fully replaces
    board_id: Optional[str] = None  # None = unchanged; moves the task to a different board
    sort_order: Optional[float] = None  # None = let server decide (unchanged or auto-reset); explicit float places the task at a position

    @field_validator("links")
    @classmethod
    def validate_links_cap(cls, v: Optional[List[TaskLink]]) -> Optional[List[TaskLink]]:
        if v is not None and len(v) > MAX_TASK_LINKS:
            raise ValueError(f"A task may have at most {MAX_TASK_LINKS} links")
        return v


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
    links: List[TaskLink] = []
    sort_order: float
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
    high_priority_daily_limit: int = 3


class SettingsUpdate(BaseModel):
    high_priority_daily_limit: int = Field(default=3, ge=1)


# ── Sync ──────────────────────────────────────────────────────────────────────

class TaskLabelSync(BaseModel):
    task_id: str
    label_id: str


class SyncChanges(BaseModel):
    tasks: List[Dict[str, Any]] = []
    task_labels: List[TaskLabelSync] = []
    beliefs: List[Dict[str, Any]] = []
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
