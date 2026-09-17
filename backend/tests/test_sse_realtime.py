import json
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from main import app
from src.database import get_session
from src.models.branch import Branch
from src.models.queue import QueueEntry, QueueStatus
from src.schemas.queue import QueueEntryCreate
from src.services.queue_service import QueueService
from src.services.sse_broadcaster import broadcaster


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(name="branch")
def branch_fixture(session: Session) -> Branch:
    branch = Branch(
        name="Sede Realtime San Isidro",
        street="Av. Conquistadores",
        exterior_number="450",
        neighborhood="San Isidro",
        city="Lima",
        state="Lima",
        country="Peru",
    )
    session.add(branch)
    session.commit()
    session.refresh(branch)
    return branch


def test_diner_queue_position_order_numbers(session: Session, branch: Branch):
    """Test that queue order number correctly reflects position and updates dynamically."""
    now = datetime.now(timezone.utc)

    # 3 diners enter the queue at different times
    diner1 = QueueEntry(
        branch_id=branch.id,
        customer_name="Primero",
        phone_number="+51987654301",
        party_size=2,
        check_in_time=now - timedelta(minutes=15),
        status=QueueStatus.RESERVED,
    )
    diner2 = QueueEntry(
        branch_id=branch.id,
        customer_name="Segundo",
        phone_number="+51987654302",
        party_size=4,
        check_in_time=now - timedelta(minutes=10),
        status=QueueStatus.RESERVED,
    )
    diner3 = QueueEntry(
        branch_id=branch.id,
        customer_name="Tercero",
        phone_number="+51987654303",
        party_size=2,
        check_in_time=now - timedelta(minutes=5),
        status=QueueStatus.RESERVED,
    )
    session.add_all([diner1, diner2, diner3])
    session.commit()

    # Check order numbers
    pos1 = QueueService.get_diner_queue_position(session, branch.id, diner1.id)
    assert pos1.order_number == 1
    assert pos1.people_ahead == 0
    assert "siguiente" in pos1.message

    pos2 = QueueService.get_diner_queue_position(session, branch.id, diner2.id)
    assert pos2.order_number == 2
    assert pos2.people_ahead == 1
    assert "puesto #2" in pos2.message or "#2" in pos2.message

    pos3 = QueueService.get_diner_queue_position(session, branch.id, diner3.id)
    assert pos3.order_number == 3
    assert pos3.people_ahead == 2

    # Now diner 1 is called
    QueueService.transition_status(session, diner1, QueueStatus.CALLED)
    pos1_called = QueueService.get_diner_queue_position(session, branch.id, diner1.id)
    assert pos1_called.status == QueueStatus.CALLED
    assert pos1_called.order_number == 0
    assert "turno" in pos1_called.message

    # Diner 2 moves up to position #1 with 0 ahead!
    pos2_updated = QueueService.get_diner_queue_position(session, branch.id, diner2.id)
    assert pos2_updated.order_number == 1
    assert pos2_updated.people_ahead == 0

    # Diner 3 moves up to position #2 with 1 ahead!
    pos3_updated = QueueService.get_diner_queue_position(session, branch.id, diner3.id)
    assert pos3_updated.order_number == 2
    assert pos3_updated.people_ahead == 1


def test_public_position_endpoint(client: TestClient, session: Session, branch: Branch):
    """Diners can query their position via public endpoint without authentication."""
    diner = QueueService.add_diner_to_queue(
        session,
        branch.id,
        QueueEntryCreate(customer_name="Comensal Publico", phone_number="+51999888777", party_size=3),
    )

    res = client.get(f"/api/v1/branches/{branch.id}/queue/{diner.id}/position")
    assert res.status_code == 200
    data = res.json()
    assert data["entry_id"] == diner.id
    assert data["order_number"] == 1
    assert data["people_ahead"] == 0
    assert data["status"] == "reserved"


def test_sse_realtime_initial_event_and_structure(client: TestClient, session: Session, branch: Branch):
    """Test that connecting to SSE endpoint yields valid event stream data."""
    diner = QueueService.add_diner_to_queue(
        session,
        branch.id,
        QueueEntryCreate(customer_name="Comensal SSE", phone_number="+51999888776", party_size=2),
    )

    with client.stream("GET", f"/api/v1/branches/{branch.id}/queue/{diner.id}/live?max_events=1") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        content = response.read().decode("utf-8")
        assert "event: queue_update" in content
        assert f'"entry_id":{diner.id}' in content or f'"entry_id": {diner.id}' in content
        assert '"order_number":1' in content or '"order_number": 1' in content
        assert '"status":"reserved"' in content or '"status": "reserved"' in content
