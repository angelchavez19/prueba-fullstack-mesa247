from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from src.models.branch import Branch
    from src.models.user import User


class QueueStatus(str, Enum):
    RESERVED = "reserved"
    CALLED = "called"
    SEATED = "seated"
    CANCELLED = "cancelled"
    NO_SHOW = "no-show"


# Allowed state transitions:
# From 'reserved' -> 'called', 'seated', 'cancelled', 'no-show'
# From 'called' -> 'called' (re-call), 'seated', 'cancelled', 'no-show', 'reserved'
# Once in seated, cancelled, or no-show, the state is terminal.
VALID_TRANSITIONS: dict[QueueStatus, set[QueueStatus]] = {
    QueueStatus.RESERVED: {
        QueueStatus.CALLED,
        QueueStatus.SEATED,
        QueueStatus.CANCELLED,
        QueueStatus.NO_SHOW,
    },
    QueueStatus.CALLED: {
        QueueStatus.CALLED,
        QueueStatus.SEATED,
        QueueStatus.CANCELLED,
        QueueStatus.NO_SHOW,
        QueueStatus.RESERVED,
    },
    QueueStatus.SEATED: set(),
    QueueStatus.CANCELLED: set(),
    QueueStatus.NO_SHOW: set(),
}


class QueueEntryBase(SQLModel):
    branch_id: int = Field(foreign_key="branches.id", index=True)
    customer_name: str = Field(max_length=150)
    phone_number: str = Field(max_length=30)
    party_size: int = Field(gt=0, description="Cuantos vienen (number of diners in the party)")
    notes: Optional[str] = Field(default=None, max_length=255)


class QueueEntry(QueueEntryBase, table=True):
    __tablename__ = "queue_entries"

    id: Optional[int] = Field(default=None, primary_key=True)
    check_in_time: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Hora de ingreso a la cola",
        index=True
    )
    status: QueueStatus = Field(default=QueueStatus.RESERVED, index=True)

    # State transition timestamps
    called_at: Optional[datetime] = Field(default=None)
    was_called: bool = Field(default=False, description="Flag indicating if the diner was called")
    seated_at: Optional[datetime] = Field(default=None)
    cancelled_at: Optional[datetime] = Field(default=None)
    no_show_at: Optional[datetime] = Field(default=None)

    # Wait duration until reaching terminal state (in seconds)
    wait_time_seconds: Optional[int] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    branch: Optional["Branch"] = Relationship(back_populates="queue_entries")
    status_history: List["QueueStatusHistory"] = Relationship(
        back_populates="queue_entry",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "order_by": "QueueStatusHistory.changed_at"}
    )


class QueueStatusHistory(SQLModel, table=True):
    __tablename__ = "queue_status_history"

    id: Optional[int] = Field(default=None, primary_key=True)
    queue_entry_id: int = Field(foreign_key="queue_entries.id", index=True)
    from_status: Optional[str] = Field(default=None, max_length=50)
    to_status: str = Field(max_length=50)
    changed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    duration_seconds: Optional[int] = Field(
        default=None,
        description="Duration spent in from_status in seconds"
    )
    changed_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")

    # Relationships
    queue_entry: Optional[QueueEntry] = Relationship(back_populates="status_history")
