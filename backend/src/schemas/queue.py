from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from src.models.queue import QueueStatus


class QueueEntryCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=150)
    phone_number: str = Field(min_length=6, max_length=30)
    party_size: int = Field(gt=0, description="Cuantos comensales vienen")
    notes: Optional[str] = Field(default=None, max_length=255)


class QueueStatusUpdate(BaseModel):
    status: QueueStatus = Field(description="Target status: seated, cancelled, or no-show")


class QueueStatusHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    queue_entry_id: int
    from_status: Optional[str] = None
    to_status: str
    changed_at: datetime
    duration_seconds: Optional[int] = None
    changed_by_user_id: Optional[int] = None


class QueueEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int
    customer_name: str
    phone_number: str
    party_size: int
    check_in_time: datetime
    status: QueueStatus
    called_at: Optional[datetime] = None
    was_called: bool = False
    seated_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    no_show_at: Optional[datetime] = None
    wait_time_seconds: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class QueueEntryDetailRead(QueueEntryRead):
    status_history: List[QueueStatusHistoryRead] = []


class MetricTimeframe(str, Enum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"
    ALL = "all"


class QueueMetrics(BaseModel):
    branch_id: int
    timeframe: MetricTimeframe = MetricTimeframe.ALL
    from_date: Optional[datetime] = None

    # Minimum requested metrics
    joined: int = Field(description="Total number of diners who joined the queue")
    seated: int = Field(description="Total number of diners seated at a table")
    left_without_sitting: int = Field(description="Total number of diners who cancelled / left without sitting")
    did_not_come_when_called: int = Field(description="Diners who were called but did not arrive / no-show")
    average_wait_minutes: Optional[float] = Field(default=None, description="Average wait time in minutes")
    average_wait_seconds: Optional[float] = Field(default=None, description="Average wait time in seconds")

    total_entries: int = 0
    currently_reserved: int = 0
    currently_called: int = 0
    total_seated: int = 0
    total_cancelled: int = 0
    total_no_show: int = 0
    avg_wait_time_seated_seconds: Optional[float] = None
    avg_wait_time_seated_minutes: Optional[float] = None
    cancellation_rate_percent: float = 0.0
    no_show_rate_percent: float = 0.0
    seated_rate_percent: float = 0.0