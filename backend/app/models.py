import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, ForeignKey,
    Integer, Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class CategoryEnum(str, enum.Enum):
    frequency = "frequency"
    mode = "mode"
    type = "type"


class StateEnum(str, enum.Enum):
    pending = "pending"
    done = "done"


class RoleEnum(str, enum.Enum):
    user = "user"
    assistant = "assistant"


class BeliefTypeEnum(str, enum.Enum):
    label_suggestion = "label_suggestion"
    time_estimate = "time_estimate"


class BeliefStatusEnum(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    auth_provider = Column(String, nullable=True)
    auth_provider_id = Column(String, nullable=True)
    firebase_uid = Column(String, unique=True, nullable=True, index=True)
    email = Column(String, nullable=True)
    display_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class Label(Base):
    __tablename__ = "labels"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(Enum(CategoryEnum), nullable=False)
    value = Column(String, nullable=False)


class TaskLabel(Base):
    __tablename__ = "task_labels"

    task_id = Column(String, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    label_id = Column(String, ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    state = Column(Enum(StateEnum), default=StateEnum.pending, nullable=False)
    must_do_by = Column(Date, nullable=True)
    target_date = Column(Date, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    recurrence_group_id = Column(String, nullable=True, index=True)
    is_high_priority = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    labels = relationship("Label", secondary="task_labels", lazy="joined")


class Belief(Base):
    __tablename__ = "beliefs"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    belief_type = Column(Enum(BeliefTypeEnum), nullable=False)
    label_id = Column(String, ForeignKey("labels.id"), nullable=True)
    estimated_minutes = Column(Integer, nullable=True)
    status = Column(Enum(BeliefStatusEnum), default=BeliefStatusEnum.pending, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    label = relationship("Label", lazy="joined")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    content = Column(Text, nullable=False)
    suggested_questions = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    starter_questions = Column(JSONB, nullable=True)
    high_priority_daily_limit = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class AICostLog(Base):
    __tablename__ = "ai_cost_log"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    feature = Column(String, nullable=False)
    model = Column(String, nullable=False)
    input_tokens = Column(Integer, nullable=False)
    output_tokens = Column(Integer, nullable=False)
    estimated_cost_usd = Column(Numeric(10, 6), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


LABEL_SEED = [
    ("frequency", "one-time"),
    ("frequency", "daily"),
    ("frequency", "weekly"),
    ("frequency", "monthly"),
    ("frequency", "annual"),
    ("mode", "online"),
    ("mode", "phone"),
    ("mode", "outdoor"),
    ("mode", "email"),
    ("type", "household"),
    ("type", "financial"),
    ("type", "child"),
    ("type", "trip"),
    ("type", "medical"),
]
