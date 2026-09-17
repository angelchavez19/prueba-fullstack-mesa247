import asyncio
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from src.database import get_session, engine
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
    QueuePositionInfo,
)
from src.services.queue_service import QueueService
from src.services.metrics_service import MetricsService
from src.services.sse_broadcaster import broadcaster
from src.api.deps import get_current_user, get_optional_current_user

router = APIRouter(prefix="/branches/{branch_id}/queue", tags=["Queue Management (Comensales)"])


@router.post("/", response_model=QueueEntryRead, status_code=status.HTTP_201_CREATED)
def add_diner_to_queue(
    branch_id: int,
    entry_in: QueueEntryCreate,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_current_user),
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

    user_id = current_user.id if current_user else None
    return QueueService.add_diner_to_queue(
        session=session,
        branch_id=branch_id,
        data=entry_in,
        user_id=user_id,
    )


@router.post("/check-in", response_model=QueueEntryRead, status_code=status.HTTP_201_CREATED)
def diner_self_check_in(
    branch_id: int,
    entry_in: QueueEntryCreate,
    session: Session = Depends(get_session),
) -> QueueEntry:
    """
    Public check-in endpoint for unauthenticated diners scanning branch QR code.
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
        user_id=None,
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


def _get_branch_active_queue_json(branch_id: int) -> str:
    with Session(engine) as local_session:
        stmt = (
            select(QueueEntry)
            .where(
                QueueEntry.branch_id == branch_id,
                QueueEntry.status.in_([QueueStatus.RESERVED, QueueStatus.CALLED]),
            )
            .order_by(QueueEntry.check_in_time.asc())
        )
        entries = local_session.exec(stmt).all()
        return json.dumps([QueueEntryRead.model_validate(e).model_dump(mode="json") for e in entries])


@router.get("/stream")
async def stream_branch_queue(
    branch_id: int,
    request: Request,
    session: Session = Depends(get_session),
):
    """
    Real-time SSE stream for staff to monitor active branch queue entries.
    Emits events when a diner is added, called, seated, cancelled, or marked no-show.
    """
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Branch with id {branch_id} not found")

    initial_json = _get_branch_active_queue_json(branch_id)
    queue = broadcaster.subscribe(branch_id)

    async def event_generator():
        try:
            # 1. Send immediate initial active queue
            yield f"event: queue_sync\ndata: {initial_json}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                try:
                    await asyncio.wait_for(queue.get(), timeout=15.0)
                    data_json = await asyncio.to_thread(_get_branch_active_queue_json, branch_id)
                    yield f"event: queue_sync\ndata: {data_json}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            broadcaster.unsubscribe(branch_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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


@router.post("/{entry_id}/cancel", response_model=QueueEntryRead)
def diner_cancel_reservation(
    branch_id: int,
    entry_id: int,
    session: Session = Depends(get_session),
) -> QueueEntry:
    """
    Public endpoint for a diner to cancel their queue reservation.
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
        target_status=QueueStatus.CANCELLED,
        user_id=None,
    )


@router.get("/{entry_id}/position", response_model=QueuePositionInfo)
def get_diner_position(
    branch_id: int,
    entry_id: int,
    session: Session = Depends(get_session),
) -> QueuePositionInfo:
    """
    Public endpoint for diners to check their current order number, status,
    and number of parties ahead in the queue.
    """
    return QueueService.get_diner_queue_position(session, branch_id, entry_id)


@router.get("/{entry_id}/live")
async def stream_diner_queue_live(
    branch_id: int,
    entry_id: int,
    request: Request,
    max_events: Optional[int] = Query(
        default=None,
        description="Optional maximum events to receive before closing stream (useful for testing)",
    ),
    session: Session = Depends(get_session),
):
    """
    Real-time Server-Sent Events (SSE) stream for a diner to track their order number.
    Pushes updates instantly when queue state changes without overloading the server.
    Includes keep-alive comments to prevent connection drops.
    """
    # Verify diner exists and belongs to branch
    initial_info = QueueService.get_diner_queue_position(session, branch_id, entry_id)
    queue = broadcaster.subscribe(branch_id)

    async def event_generator():
        sent_events = 0
        try:
            # 1. Send immediate initial state
            yield f"event: queue_update\ndata: {initial_info.model_dump_json()}\n\n"
            sent_events += 1
            if max_events is not None and sent_events >= max_events:
                return

            # If already resolved, finish stream
            if initial_info.status in (QueueStatus.SEATED, QueueStatus.CANCELLED, QueueStatus.NO_SHOW):
                return

            last_json = initial_info.model_dump_json()

            while True:
                if await request.is_disconnected():
                    break

                try:
                    # Await real-time notification from broadcaster or 15s keep-alive timeout
                    await asyncio.wait_for(queue.get(), timeout=15.0)

                    with Session(engine) as local_session:
                        current_info = QueueService.get_diner_queue_position(
                            local_session, branch_id, entry_id
                        )
                        current_json = current_info.model_dump_json()

                        if current_json != last_json:
                            last_json = current_json
                            yield f"event: queue_update\ndata: {current_json}\n\n"

                        if current_info.status in (
                            QueueStatus.SEATED,
                            QueueStatus.CANCELLED,
                            QueueStatus.NO_SHOW,
                        ):
                            yield f"event: queue_closed\ndata: {current_json}\n\n"
                            break
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep SSE connection alive without DB queries
                    yield ": keep-alive\n\n"

        finally:
            broadcaster.unsubscribe(branch_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

