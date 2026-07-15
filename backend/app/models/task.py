from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base

if TYPE_CHECKING:
    from .risk import Action


class FollowTask(Base):
    __tablename__ = "follow_task"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    action_id: Mapped[str] = mapped_column("actionId", String, ForeignKey("action.id"), unique=True)
    title: Mapped[str] = mapped_column(String)
    owner_id: Mapped[str] = mapped_column("ownerId", String, index=True)
    start_date: Mapped[datetime] = mapped_column("startDate", DateTime)
    deadline: Mapped[datetime] = mapped_column(DateTime)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="NOT_STARTED")
    progress_description: Mapped[str] = mapped_column("progressDescription", Text, default="")
    closed_at: Mapped[Optional[datetime]] = mapped_column("closedAt", DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    action: Mapped[Action] = relationship(back_populates="task")
    updates: Mapped[List[TaskUpdate]] = relationship(back_populates="task", cascade="all, delete-orphan")
    attachments: Mapped[List[Attachment]] = relationship(back_populates="task", cascade="all, delete-orphan")


class TaskUpdate(Base):
    __tablename__ = "task_update"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column("taskId", String, ForeignKey("follow_task.id", ondelete="CASCADE"))
    progress: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(Text)
    author_id: Mapped[str] = mapped_column("authorId", String)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    task: Mapped[FollowTask] = relationship(back_populates="updates")


class Attachment(Base):
    __tablename__ = "attachment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column("taskId", String, ForeignKey("follow_task.id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String, default="OTHER")
    file_name: Mapped[str] = mapped_column("fileName", String)
    stored_name: Mapped[str] = mapped_column("storedName", String)
    mime_type: Mapped[str] = mapped_column("mimeType", String)
    size: Mapped[int] = mapped_column(Integer)
    url: Mapped[str] = mapped_column(String)
    uploaded_by_id: Mapped[str] = mapped_column("uploadedById", String)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    task: Mapped[FollowTask] = relationship(back_populates="attachments")