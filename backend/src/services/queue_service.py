from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlmodel import Session, select
from src.models.queue import (
    QueueEntry,
    QueueStatus,
    QueueStatusHistory,
    VALID_TRANSITIONS,
)
from src.schemas.queue import QueueEntryCreate


class QueueService:
    @staticmethod
    def add_diner_to_queue(
        session: Session,
        branch_id: int,
        data: QueueEntryCreate,
        user_id: Optional[int] = None,
    ) -> QueueEntry:
        """Register a new diner into the branch queue with initial status 'reserved'."""
        now = datetime.now(timezone.utc)
        entry = QueueEntry(
            branch_id=branch_id,
            customer_name=data.customer_name,
            phone_number=data.phone_number,
            party_size=data.party_size,
            notes=data.notes,
            check_in_time=now,
            status=QueueStatus.RESERVED,
            created_at=now,
            updated_at=now,
        )
        session.add(entry)
        session.flush()  # to obtain entry.id

        # Record initial status in history
        history = QueueStatusHistory(
            queue_entry_id=entry.id,  # type: ignore
            from_status=None,
            to_status=QueueStatus.RESERVED.value,
            changed_at=now,
            duration_seconds=0,
            changed_by_user_id=user_id,
        )
        session.add(history)
        session.commit()
        session.refresh(entry)
        return entry

    @staticmethod
    def transition_status(
        session: Session,
        queue_entry: QueueEntry,
        target_status: QueueStatus,
        user_id: Optional[int] = None,
    ) -> QueueEntry:
        """
        Transition a queue entry from its current state to a target state,
        enforcing the state machine rules and tracking the duration.
        """
        current_status = queue_entry.status

        # Validate transition
        allowed = VALID_TRANSITIONS.get(current_status, set())
        if target_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Transición de estado no permitida: de '{current_status.value}' "
                    f"a '{target_status.value}'. Las opciones válidas desde '{current_status.value}' son: "
                    f"{[s.value for s in allowed]}."
                ),
            )

        now = datetime.now(timezone.utc)

        # Calculate time spent in current state
        # First check the latest history record changed_at, or fallback to check_in_time
        statement = (
            select(QueueStatusHistory)
            .where(QueueStatusHistory.queue_entry_id == queue_entry.id)
            .order_by(QueueStatusHistory.changed_at.desc())  # type: ignore
        )
        last_history = session.exec(statement).first()

        start_time = last_history.changed_at if last_history else queue_entry.check_in_time
        # Ensure UTC timezone comparability
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)

        duration_seconds = max(0, int((now - start_time).total_seconds()))
        total_wait_from_checkin = max(
            0,
            int((now - (queue_entry.check_in_time.replace(tzinfo=timezone.utc) if queue_entry.check_in_time.tzinfo is None else queue_entry.check_in_time)).total_seconds())
        )

        # Update queue entry
        queue_entry.status = target_status
        queue_entry.updated_at = now
        queue_entry.wait_time_seconds = total_wait_from_checkin

        if target_status == QueueStatus.CALLED:
            queue_entry.called_at = now
            queue_entry.was_called = True
        elif target_status == QueueStatus.SEATED:
            queue_entry.seated_at = now
        elif target_status == QueueStatus.CANCELLED:
            queue_entry.cancelled_at = now
        elif target_status == QueueStatus.NO_SHOW:
            queue_entry.no_show_at = now

        # Add history log
        history = QueueStatusHistory(
            queue_entry_id=queue_entry.id,  # type: ignore
            from_status=current_status.value,
            to_status=target_status.value,
            changed_at=now,
            duration_seconds=duration_seconds,
            changed_by_user_id=user_id,
        )
        session.add(queue_entry)
        session.add(history)
        session.commit()
        session.refresh(queue_entry)
        return queue_entry
