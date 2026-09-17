from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlmodel import Session, select, func
from src.models.queue import QueueEntry, QueueStatus
from src.schemas.queue import QueueMetrics, MetricTimeframe


class MetricsService:
    @staticmethod
    def calculate_time_boundary(timeframe: MetricTimeframe) -> Optional[datetime]:
        """Compute the starting UTC datetime corresponding to the chosen timeframe."""
        now = datetime.now(timezone.utc)
        if timeframe == MetricTimeframe.DAY:
            return now - timedelta(days=1)
        elif timeframe == MetricTimeframe.WEEK:
            return now - timedelta(days=7)
        elif timeframe == MetricTimeframe.MONTH:
            return now - timedelta(days=30)
        elif timeframe == MetricTimeframe.YEAR:
            return now - timedelta(days=365)
        elif timeframe == MetricTimeframe.ALL:
            return None
        return None

    @staticmethod
    def get_branch_metrics(
        session: Session,
        branch_id: int,
        timeframe: MetricTimeframe = MetricTimeframe.ALL,
    ) -> QueueMetrics:
        """Calculate real-time operational and state metrics for a given branch filtered by timeframe."""
        from_date = MetricsService.calculate_time_boundary(timeframe)

        def apply_time_filter(query):
            if from_date is not None:
                return query.where(QueueEntry.check_in_time >= from_date)
            return query

        # Total registered
        total_stmt = apply_time_filter(
            select(func.count(QueueEntry.id)).where(QueueEntry.branch_id == branch_id)
        )
        total_entries = session.exec(total_stmt).one() or 0

        # Currently reserved
        reserved_stmt = apply_time_filter(
            select(func.count(QueueEntry.id)).where(
                QueueEntry.branch_id == branch_id,
                QueueEntry.status == QueueStatus.RESERVED,
            )
        )
        currently_reserved = session.exec(reserved_stmt).one() or 0

        # Currently called (waiting for diner response/arrival)
        called_stmt = apply_time_filter(
            select(func.count(QueueEntry.id)).where(
                QueueEntry.branch_id == branch_id,
                QueueEntry.status == QueueStatus.CALLED,
            )
        )
        currently_called = session.exec(called_stmt).one() or 0

        # Seated count (They sat down)
        seated_stmt = apply_time_filter(
            select(func.count(QueueEntry.id)).where(
                QueueEntry.branch_id == branch_id,
                QueueEntry.status == QueueStatus.SEATED,
            )
        )
        total_seated = session.exec(seated_stmt).one() or 0

        # Cancelled count (They left without sitting down)
        cancelled_stmt = apply_time_filter(
            select(func.count(QueueEntry.id)).where(
                QueueEntry.branch_id == branch_id,
                QueueEntry.status == QueueStatus.CANCELLED,
            )
        )
        total_cancelled = session.exec(cancelled_stmt).one() or 0

        # Total No-show
        no_show_stmt = apply_time_filter(
            select(func.count(QueueEntry.id)).where(
                QueueEntry.branch_id == branch_id,
                QueueEntry.status == QueueStatus.NO_SHOW,
            )
        )
        total_no_show = session.exec(no_show_stmt).one() or 0

        # Did not come when called (called and resolved as no-show)
        no_show_called_stmt = apply_time_filter(
            select(func.count(QueueEntry.id)).where(
                QueueEntry.branch_id == branch_id,
                QueueEntry.status == QueueStatus.NO_SHOW,
                QueueEntry.was_called == True,
            )
        )
        did_not_come_when_called = session.exec(no_show_called_stmt).one() or 0
        # If did_not_come_when_called is 0 but there are total_no_shows, fall back to total_no_show
        if did_not_come_when_called == 0 and total_no_show > 0:
            did_not_come_when_called = total_no_show

        # Average wait time for seated guests (Average wait)
        avg_wait_stmt = apply_time_filter(
            select(func.avg(QueueEntry.wait_time_seconds)).where(
                QueueEntry.branch_id == branch_id,
                QueueEntry.status == QueueStatus.SEATED,
                QueueEntry.wait_time_seconds.is_not(None),  # type: ignore
            )
        )
        avg_wait_raw = session.exec(avg_wait_stmt).one()
        avg_wait_seconds: Optional[float] = float(avg_wait_raw) if avg_wait_raw is not None else None
        avg_wait_minutes: Optional[float] = round(avg_wait_seconds / 60.0, 2) if avg_wait_seconds is not None else None

        # Calculate percentages
        completed = total_seated + total_cancelled + total_no_show
        cancellation_rate = round((total_cancelled / completed * 100), 2) if completed > 0 else 0.0
        no_show_rate = round((total_no_show / completed * 100), 2) if completed > 0 else 0.0
        seated_rate = round((total_seated / completed * 100), 2) if completed > 0 else 0.0

        return QueueMetrics(
            branch_id=branch_id,
            timeframe=timeframe,
            from_date=from_date,
            # Minimum metrics
            joined=total_entries,
            seated=total_seated,
            left_without_sitting=total_cancelled,
            did_not_come_when_called=did_not_come_when_called,
            average_wait_minutes=avg_wait_minutes,
            average_wait_seconds=round(avg_wait_seconds, 2) if avg_wait_seconds else None,
            # Complementary fields
            total_entries=total_entries,
            currently_reserved=currently_reserved,
            currently_called=currently_called,
            total_seated=total_seated,
            total_cancelled=total_cancelled,
            total_no_show=total_no_show,
            avg_wait_time_seated_seconds=round(avg_wait_seconds, 2) if avg_wait_seconds else None,
            avg_wait_time_seated_minutes=avg_wait_minutes,
            cancellation_rate_percent=cancellation_rate,
            no_show_rate_percent=no_show_rate,
            seated_rate_percent=seated_rate,
        )