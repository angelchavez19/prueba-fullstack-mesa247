import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from main import app
from src.database import get_session


@pytest.fixture(name="client")
def client_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    def override_get_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_full_api_workflow(client: TestClient):
    # 1. Health check
    health_resp = client.get("/health")
    assert health_resp.status_code == 200

    # 2. Create a Branch with segmented address
    branch_payload = {
        "name": "Sede Miraflores",
        "street": "Av. Jose Larco",
        "exterior_number": "1150",
        "interior_number": "Of. 301",
        "neighborhood": "Miraflores",
        "city": "Lima",
        "state": "Lima",
        "country": "Peru",
        "postal_code": "15074"
    }
    branch_res = client.post("/api/v1/branches/", json=branch_payload)
    assert branch_res.status_code == 201
    branch = branch_res.json()
    assert branch["id"] == 1
    assert "Lima, Peru" in branch["full_address"]

    # 3. Create a User (Host) for this branch
    user_payload = {
        "name": "Sofia Host",
        "email": "sofia@mesa247.com",
        "password": "Argon2SecurePassword2026",
        "branch_id": branch["id"],
        "role": "host"
    }
    user_res = client.post("/api/v1/users/", json=user_payload)
    assert user_res.status_code == 201
    user = user_res.json()
    assert user["email"] == "sofia@mesa247.com"
    assert user["role"] == "host"
    assert "password" not in user
    assert "password_hash" not in user

    # 4. Login with Argon2 password verification
    login_payload = {
        "email": "sofia@mesa247.com",
        "password": "Argon2SecurePassword2026"
    }
    login_res = client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    token = token_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 5. Check authenticated /me endpoint
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["name"] == "Sofia Host"

    # 6. Register comensales into queue
    diner1_payload = {
        "customer_name": "Mateo Rossi",
        "phone_number": "+51987654321",
        "party_size": 4,
        "notes": "Mesa cerca a la ventana"
    }
    d1_res = client.post(f"/api/v1/branches/{branch['id']}/queue/", json=diner1_payload, headers=headers)
    assert d1_res.status_code == 201
    diner1 = d1_res.json()
    assert diner1["status"] == "reserved"
    assert diner1["customer_name"] == "Mateo Rossi"
    assert diner1["party_size"] == 4

    diner2_payload = {
        "customer_name": "Lucia Mendez",
        "phone_number": "+51987654322",
        "party_size": 2
    }
    d2_res = client.post(f"/api/v1/branches/{branch['id']}/queue/", json=diner2_payload, headers=headers)
    assert d2_res.status_code == 201
    diner2 = d2_res.json()

    # 7. List active queue
    queue_list_res = client.get(f"/api/v1/branches/{branch['id']}/queue/?queue_status=reserved", headers=headers)
    assert queue_list_res.status_code == 200
    assert len(queue_list_res.json()) == 2

    # 8. Transition diner 1: reserved -> called -> seated
    call_res = client.patch(
        f"/api/v1/branches/{branch['id']}/queue/{diner1['id']}/status",
        json={"status": "called"},
        headers=headers
    )
    assert call_res.status_code == 200
    assert call_res.json()["status"] == "called"
    assert call_res.json()["was_called"] is True

    update_res = client.patch(
        f"/api/v1/branches/{branch['id']}/queue/{diner1['id']}/status",
        json={"status": "seated"},
        headers=headers
    )
    assert update_res.status_code == 200
    diner1_updated = update_res.json()
    assert diner1_updated["status"] == "seated"
    assert diner1_updated["seated_at"] is not None

    # 9. Verify invalid transition: seated -> cancelled should fail (HTTP 400)
    invalid_res = client.patch(
        f"/api/v1/branches/{branch['id']}/queue/{diner1['id']}/status",
        json={"status": "cancelled"},
        headers=headers
    )
    assert invalid_res.status_code == 400
    assert "no permitida" in invalid_res.json()["detail"]

    # 10. Transition diner 2: reserved -> called -> no-show (no vinieron al ser llamados)
    call_d2 = client.patch(
        f"/api/v1/branches/{branch['id']}/queue/{diner2['id']}/status",
        json={"status": "called"},
        headers=headers
    )
    assert call_d2.status_code == 200

    noshow_res = client.patch(
        f"/api/v1/branches/{branch['id']}/queue/{diner2['id']}/status",
        json={"status": "no-show"},
        headers=headers
    )
    assert noshow_res.status_code == 200
    assert noshow_res.json()["status"] == "no-show"

    # 11. Check detail with history timeline
    detail_res = client.get(f"/api/v1/branches/{branch['id']}/queue/{diner1['id']}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert len(detail["status_history"]) == 3  # reserved -> called -> seated
    assert detail["status_history"][0]["to_status"] == "reserved"
    assert detail["status_history"][1]["from_status"] == "reserved"
    assert detail["status_history"][1]["to_status"] == "called"
    assert detail["status_history"][2]["from_status"] == "called"
    assert detail["status_history"][2]["to_status"] == "seated"

    # 12. Check branch metrics
    metrics_res = client.get(f"/api/v1/branches/{branch['id']}/queue/metrics", headers=headers)
    assert metrics_res.status_code == 200
    metrics = metrics_res.json()
    # Minimum metrics
    assert metrics["joined"] == 2
    assert metrics["seated"] == 1
    assert metrics["left_without_sitting"] == 0
    assert metrics["did_not_come_when_called"] == 1
    assert "average_wait_minutes" in metrics

    # Complementary fields
    assert metrics["total_entries"] == 2
    assert metrics["currently_reserved"] == 0
    assert metrics["total_seated"] == 1
    assert metrics["total_no_show"] == 1
    assert metrics["seated_rate_percent"] == 50.0
    assert metrics["no_show_rate_percent"] == 50.0
    assert metrics["timeframe"] == "all"

    # 13. Check branch metrics with timeframe filter
    day_metrics_res = client.get(f"/api/v1/branches/{branch['id']}/queue/metrics?timeframe=day", headers=headers)
    assert day_metrics_res.status_code == 200
    day_metrics = day_metrics_res.json()
    assert day_metrics["joined"] == 2
    assert day_metrics["timeframe"] == "day"
    assert day_metrics["from_date"] is not None
