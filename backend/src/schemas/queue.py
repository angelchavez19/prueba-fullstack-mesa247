from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_serializer
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

    @field_serializer("changed_at", when_used="json")
    def serialize_changed_at(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


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

    @field_serializer(
        "check_in_time",
        "called_at",
        "seated_at",
        "cancelled_at",
        "no_show_at",
        "created_at",
        "updated_at",
        when_used="json",
    )
    def serialize_datetime(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class QueueEntryDetailRead(QueueEntryRead):
    status_history: List[QueueStatusHistoryRead] = []


class QueuePositionInfo(BaseModel):
    entry_id: int
    branch_id: int
    customer_name: str
    party_size: int
    status: QueueStatus
    order_number: Optional[int] = Field(default=None, description="Número de orden actual en la cola")
    people_ahead: int = Field(default=0, description="Cantidad de comensales/grupos por delante")
    called_at: Optional[datetime] = None
    average_wait_minutes: Optional[float] = Field(default=None, description="Tiempo promedio histórico de espera en minutos")
    estimated_wait_minutes: Optional[int] = Field(default=None, description="Tiempo estimado de espera en minutos")
    message: str

    @field_serializer("called_at", when_used="json")
    def serialize_called_at(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()



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