import pytest
from datetime import datetime, timedelta, timezone
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool
from fastapi import HTTPException
from src.models.branch import Branch
from src.models.user import User, UserRole
from src.models.queue import (
    QueueEntry,
    QueueStatus,
    QueueStatusHistory,
    VALID_TRANSITIONS,
)
from src.schemas.queue import QueueEntryCreate, MetricTimeframe
from src.services.queue_service import QueueService
from src.services.metrics_service import MetricsService
from src.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


@pytest.fixture(name="session")
def session_fixture():
    """In-memory SQLite session for fast unit testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_argon2_password_hashing():
    """Verify passwords are encrypted with Argon2 and verified accurately."""
    raw_password = "SuperSecretHostPassword123!"
    hashed = hash_password(raw_password)

    # Argon2 hashes typically start with $argon2
    assert hashed.startswith("$argon2")
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_pyjwt_token_creation_and_decoding():
    """Verify JWT token encoding and decoding using PyJWT."""
    user_id = 42
    claims = {"email": "host@mesa247.com", "role": "host", "branch_id": 1}
    token = create_access_token(subject=user_id, extra_claims=claims)

    decoded = decode_access_token(token)
    assert decoded["sub"] == str(user_id)
    assert decoded["email"] == "host@mesa247.com"
    assert decoded["role"] == "host"
    assert decoded["branch_id"] == 1
    assert "exp" in decoded


def test_branch_segmented_address(session: Session):
    """Verify Branch model correctly stores segmented address."""
    branch = Branch(
        name="Mesa247 Miraflores",
        street="Av. Larco",
        exterior_number="1232",
        interior_number="Piso 2",
        neighborhood="Miraflores",
        city="Lima",
        state="Lima",
        country="Peru",
        postal_code="15074",
    )
    session.add(branch)
    session.commit()
    session.refresh(branch)

    assert branch.id is not None
    assert "Av. Larco 1232, Int Piso 2, Miraflores, Lima, Lima, Peru, CP 15074" in branch.full_address


def test_queue_initial_state_reserved(session: Session):
    """Verify newly registered diner starts in 'reserved' status and has history logged."""
    branch = Branch(
        name="Sede Palermo",
        street="Gorriti",
        exterior_number="4850",
        neighborhood="Palermo",
        city="Buenos Aires",
        state="CABA",
        country="Argentina",
    )
    session.add(branch)
    session.commit()

    entry_data = QueueEntryCreate(
        customer_name="Carlos Gomez",
        phone_number="+5491145678901",
        party_size=4,
        notes="Preferencia mesa al aire libre",
    )

    entry = QueueService.add_diner_to_queue(session, branch.id, entry_data)

    assert entry.id is not None
    assert entry.status == QueueStatus.RESERVED
    assert entry.party_size == 4
    assert entry.seated_at is None
    assert entry.cancelled_at is None
    assert entry.no_show_at is None

    # Check initial history record
    statement = select(QueueStatusHistory).where(QueueStatusHistory.queue_entry_id == entry.id)
    history = session.exec(statement).all()
    assert len(history) == 1
    assert history[0].to_status == "reserved"
    assert history[0].from_status is None


def test_queue_state_machine_valid_transitions(session: Session):
    """Test valid transitions: reserved -> seated, reserved -> cancelled, reserved -> no-show."""
    branch = Branch(
        name="Sede Roma Norte",
        street="Colima",
        exterior_number="150",
        neighborhood="Roma Norte",
        city="CDMX",
        state="CDMX",
        country="Mexico",
    )
    session.add(branch)
    session.commit()

    # 1. Test reserved -> seated
    entry1 = QueueService.add_diner_to_queue(
        session, branch.id, QueueEntryCreate(customer_name="Ana", phone_number="+525512345678", party_size=2)
    )
    updated1 = QueueService.transition_status(session, entry1, QueueStatus.SEATED)
    assert updated1.status == QueueStatus.SEATED
    assert updated1.seated_at is not None
    assert updated1.wait_time_seconds is not None

    # 2. Test reserved -> cancelled
    entry2 = QueueService.add_diner_to_queue(
        session, branch.id, QueueEntryCreate(customer_name="Beto", phone_number="+525512345679", party_size=3)
    )
    updated2 = QueueService.transition_status(session, entry2, QueueStatus.CANCELLED)
    assert updated2.status == QueueStatus.CANCELLED
    assert updated2.cancelled_at is not None

    # 3. Test reserved -> no-show
    entry3 = QueueService.add_diner_to_queue(
        session, branch.id, QueueEntryCreate(customer_name="Clara", phone_number="+525512345680", party_size=1)
    )
    updated3 = QueueService.transition_status(session, entry3, QueueStatus.NO_SHOW)
    assert updated3.status == QueueStatus.NO_SHOW
    assert updated3.no_show_at is not None

    # 4. Test reserved -> called -> seated
    entry4 = QueueService.add_diner_to_queue(
        session, branch.id, QueueEntryCreate(customer_name="Diego", phone_number="+525512345681", party_size=2)
    )
    called4 = QueueService.transition_status(session, entry4, QueueStatus.CALLED)
    assert called4.status == QueueStatus.CALLED
    assert called4.called_at is not None
    assert called4.was_called is True

    seated4 = QueueService.transition_status(session, called4, QueueStatus.SEATED)
    assert seated4.status == QueueStatus.SEATED
    assert seated4.seated_at is not None

    # 5. Test reserved -> called -> cancelled (called, answered, cancelled)
    entry5 = QueueService.add_diner_to_queue(
        session, branch.id, QueueEntryCreate(customer_name="Elena", phone_number="+525512345682", party_size=2)
    )
    called5 = QueueService.transition_status(session, entry5, QueueStatus.CALLED)
    cancelled5 = QueueService.transition_status(session, called5, QueueStatus.CANCELLED)
    assert cancelled5.status == QueueStatus.CANCELLED
    assert cancelled5.was_called is True

    # 6. Test reserved -> called -> no-show (called, didn't answer/show up)
    entry6 = QueueService.add_diner_to_queue(
        session, branch.id, QueueEntryCreate(customer_name="Fernando", phone_number="+525512345683", party_size=3)
    )
    called6 = QueueService.transition_status(session, entry6, QueueStatus.CALLED)
    noshow6 = QueueService.transition_status(session, called6, QueueStatus.NO_SHOW)
    assert noshow6.status == QueueStatus.NO_SHOW
    assert noshow6.was_called is True

    # 7. Test reserved -> called -> reserved (called, asked for more time, returned to queue)
    entry7 = QueueService.add_diner_to_queue(
        session, branch.id, QueueEntryCreate(customer_name="Gabriela", phone_number="+525512345684", party_size=2)
    )
    called7 = QueueService.transition_status(session, entry7, QueueStatus.CALLED)
    back_to_reserved = QueueService.transition_status(session, called7, QueueStatus.RESERVED)
    assert back_to_reserved.status == QueueStatus.RESERVED


def test_queue_state_machine_invalid_transitions(session: Session):
    """Terminal states (seated, cancelled, no-show) must reject transitions."""
    branch = Branch(
        name="Sede El Poblado",
        street="Carrera 43A",
        exterior_number="1 Sur-220",
        neighborhood="El Poblado",
        city="Medellin",
        state="Antioquia",
        country="Colombia",
    )
    session.add(branch)
    session.commit()

    entry = QueueService.add_diner_to_queue(
        session, branch.id, QueueEntryCreate(customer_name="Daniela", phone_number="+573001234567", party_size=5)
    )
    QueueService.transition_status(session, entry, QueueStatus.SEATED)

    # Attempting to move from 'seated' back to 'reserved' or 'cancelled' must raise HTTPException 400
    with pytest.raises(HTTPException) as exc_info:
        QueueService.transition_status(session, entry, QueueStatus.RESERVED)
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        QueueService.transition_status(session, entry, QueueStatus.CANCELLED)
    assert exc_info.value.status_code == 400


def test_metrics_calculation(session: Session):
    """Verify metrics calculation for a branch, including minimum requested metrics."""
    branch = Branch(
        name="Sede Vitacura",
        street="Av. Vitacura",
        exterior_number="3565",
        neighborhood="Vitacura",
        city="Santiago",
        state="RM",
        country="Chile",
    )
    session.add(branch)
    session.commit()

    # Add diners:
    # e1: seated (after being called)
    e1 = QueueService.add_diner_to_queue(session, branch.id, QueueEntryCreate(customer_name="A", phone_number="1234567", party_size=2))
    called_e1 = QueueService.transition_status(session, e1, QueueStatus.CALLED)
    QueueService.transition_status(session, called_e1, QueueStatus.SEATED)

    # e2: cancelled (se fueron sin sentarse)
    e2 = QueueService.add_diner_to_queue(session, branch.id, QueueEntryCreate(customer_name="B", phone_number="1234568", party_size=2))
    QueueService.transition_status(session, e2, QueueStatus.CANCELLED)

    # e3: no-show after being called (no vinieron al ser llamados)
    e3 = QueueService.add_diner_to_queue(session, branch.id, QueueEntryCreate(customer_name="C", phone_number="1234569", party_size=2))
    called_e3 = QueueService.transition_status(session, e3, QueueStatus.CALLED)
    QueueService.transition_status(session, called_e3, QueueStatus.NO_SHOW)

    # e4: stays reserved
    e4 = QueueService.add_diner_to_queue(session, branch.id, QueueEntryCreate(customer_name="D", phone_number="1234570", party_size=2))

    metrics = MetricsService.get_branch_metrics(session, branch.id)

    # Minimum required metrics
    assert metrics.joined == 4
    assert metrics.seated == 1
    assert metrics.left_without_sitting == 1
    assert metrics.did_not_come_when_called == 1
    assert metrics.average_wait_minutes is not None or metrics.average_wait_seconds is not None

    # Campos complementarios
    assert metrics.total_entries == 4
    assert metrics.currently_reserved == 1
    assert metrics.total_seated == 1
    assert metrics.total_cancelled == 1
    assert metrics.total_no_show == 1
    assert metrics.seated_rate_percent == pytest.approx(33.33, 0.1)
    assert metrics.cancellation_rate_percent == pytest.approx(33.33, 0.1)
    assert metrics.no_show_rate_percent == pytest.approx(33.33, 0.1)


def test_metrics_with_timeframe_filters(session: Session):
    """Verify metrics calculation with day, week, month, year, all filters."""
    branch = Branch(
        name="Sede Bogota",
        street="Calle 85",
        exterior_number="12-50",
        neighborhood="Zona T",
        city="Bogota",
        state="Cundinamarca",
        country="Colombia",
    )
    session.add(branch)
    session.commit()

    now = datetime.now(timezone.utc)

    # Entry 1: Today (2 hours ago)
    e_today = QueueEntry(
        branch_id=branch.id,
        customer_name="Comensal Hoy",
        phone_number="+573111111111",
        party_size=2,
        check_in_time=now - timedelta(hours=2),
        status=QueueStatus.SEATED,
        wait_time_seconds=600,
    )
    # Entry 2: 3 days ago (within week, month, year, all)
    e_week = QueueEntry(
        branch_id=branch.id,
        customer_name="Comensal Semana",
        phone_number="+573111111112",
        party_size=4,
        check_in_time=now - timedelta(days=3),
        status=QueueStatus.CANCELLED,
        wait_time_seconds=300,
    )
    # Entry 3: 15 days ago (within month, year, all)
    e_month = QueueEntry(
        branch_id=branch.id,
        customer_name="Comensal Mes",
        phone_number="+573111111113",
        party_size=1,
        check_in_time=now - timedelta(days=15),
        status=QueueStatus.NO_SHOW,
        wait_time_seconds=900,
    )
    # Entry 4: 60 days ago (within year, all)
    e_year = QueueEntry(
        branch_id=branch.id,
        customer_name="Comensal Anio",
        phone_number="+573111111114",
        party_size=6,
        check_in_time=now - timedelta(days=60),
        status=QueueStatus.SEATED,
        wait_time_seconds=1200,
    )
    session.add_all([e_today, e_week, e_month, e_year])
    session.commit()

    # DAY filter (last 24 hours)
    m_day = MetricsService.get_branch_metrics(session, branch.id, MetricTimeframe.DAY)
    assert m_day.total_entries == 1
    assert m_day.total_seated == 1
    assert m_day.total_cancelled == 0

    # WEEK filter (last 7 days)
    m_week = MetricsService.get_branch_metrics(session, branch.id, MetricTimeframe.WEEK)
    assert m_week.total_entries == 2
    assert m_week.total_seated == 1
    assert m_week.total_cancelled == 1

    # MONTH filter (last 30 days)
    m_month = MetricsService.get_branch_metrics(session, branch.id, MetricTimeframe.MONTH)
    assert m_month.total_entries == 3
    assert m_month.total_seated == 1
    assert m_month.total_cancelled == 1
    assert m_month.total_no_show == 1

    # YEAR filter (last 365 days)
    m_year = MetricsService.get_branch_metrics(session, branch.id, MetricTimeframe.YEAR)
    assert m_year.total_entries == 4
    assert m_year.total_seated == 2

    # ALL filter (general)
    m_all = MetricsService.get_branch_metrics(session, branch.id, MetricTimeframe.ALL)
    assert m_all.total_entries == 4
    assert m_all.timeframe == MetricTimeframe.ALL
    assert m_all.from_date is None
