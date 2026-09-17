from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select
from src.database import get_session
from src.models.branch import Branch
from src.models.queue import QueueEntry, QueueStatus
from src.models.user import User
from src.schemas.queue import (
    QueueEntryCreate,
    QueueEntryRead,
    QueueEntryDetailRead,
    QueueStatusUpdate,
    QueueMetrics,
    MetricTimeframe,
)
from src.services.queue_service import QueueService
from src.services.metrics_service import MetricsService
from src.api.deps import get_current_user

router = APIRouter(prefix="/branches/{branch_id}/queue", tags=["Queue Management (Comensales)"])


@router.post("/", response_model=QueueEntryRead, status_code=status.HTTP_201_CREATED)
def add_diner_to_queue(
    branch_id: int,
    entry_in: QueueEntryCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> QueueEntry:
    """
    Register a diner into the branch queue.
    Automatically enters the initial state: 'reserved'.
    """
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Branch with id {branch_id} not found",
        )

    return QueueService.add_diner_to_queue(
        session=session,
        branch_id=branch_id,
        data=entry_in,
        user_id=current_user.id,
    )


@router.get("/", response_model=List[QueueEntryRead])
def list_queue_entries(
    branch_id: int,
    queue_status: Optional[QueueStatus] = Query(
        default=None,
        description="Filter by status: reserved, seated, cancelled, no-show. Omit to list all.",
    ),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> List[QueueEntry]:
    """List queue entries for a given branch, optionally filtered by status."""
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Branch with id {branch_id} not found",
        )

    statement = (
        select(QueueEntry)
        .where(QueueEntry.branch_id == branch_id)
        .order_by(QueueEntry.check_in_time.asc())
    )
    if queue_status is not None:
        statement = statement.where(QueueEntry.status == queue_status)

    entries = session.exec(statement).all()
    return list(entries)


@router.get("/metrics", response_model=QueueMetrics)
def get_branch_queue_metrics(
    branch_id: int,
    timeframe: MetricTimeframe = Query(
        default=MetricTimeframe.ALL,
        description="Filter metrics by timeframe: day, week, month, year, all",
    ),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> QueueMetrics:
    """Retrieve queue operational metrics and time analytics for the branch."""
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Branch with id {branch_id} not found",
        )
    return MetricsService.get_branch_metrics(session, branch_id, timeframe=timeframe)


@router.get("/{entry_id}", response_model=QueueEntryDetailRead)
def get_queue_entry_detail(
    branch_id: int,
    entry_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> QueueEntry:
    """Retrieve full details of a queue entry including complete state transition history."""
    entry = session.get(QueueEntry, entry_id)
    if not entry or entry.branch_id != branch_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Queue entry with id {entry_id} not found for branch {branch_id}",
        )
    return entry


@router.patch("/{entry_id}/status", response_model=QueueEntryRead)
def update_queue_entry_status(
    branch_id: int,
    entry_id: int,
    status_update: QueueStatusUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> QueueEntry:
    """
    Transition the state of a diner in queue.
    Validates state machine transitions ('reserved' -> 'seated' | 'cancelled' | 'no-show')
    and tracks time spent in the previous state.
    """
    entry = session.get(QueueEntry, entry_id)
    if not entry or entry.branch_id != branch_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Queue entry with id {entry_id} not found for branch {branch_id}",
        )

    return QueueService.transition_status(
        session=session,
        queue_entry=entry,
        target_status=status_update.status,
        user_id=current_user.id,
    )
