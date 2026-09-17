import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from main import app
from src.database import get_session
from src.models.branch import Branch
from src.models.user import User, UserRole
from src.security import hash_password, create_access_token


@pytest.fixture(name="session")
def session_fixture():
    """In-memory SQLite database session fixture."""
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
    """FastAPI TestClient with overridden database session."""
    def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(name="sample_branch")
def sample_branch_fixture(session: Session) -> Branch:
    """Fixture to create a sample branch in memory."""
    branch = Branch(
        name="Sede Miraflores",
        street="Av. Jose Larco",
        exterior_number="1232",
        neighborhood="Miraflores",
        city="Lima",
        state="Lima",
        country="Peru",
        postal_code="15074",
    )
    session.add(branch)
    session.commit()
    session.refresh(branch)
    return branch


@pytest.fixture(name="sample_user")
def sample_user_fixture(session: Session, sample_branch: Branch) -> User:
    """Fixture to create an authenticated host user."""
    user = User(
        name="Carlos Host",
        email="carlos@mesa247.com",
        password_hash=hash_password("ValidPassword123"),
        branch_id=sample_branch.id,  # type: ignore
        role=UserRole.HOST,
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture(name="auth_headers")
def auth_headers_fixture(sample_user: User) -> dict[str, str]:
    """Bearer token authorization headers."""
    token = create_access_token(
        subject=sample_user.id,  # type: ignore
        extra_claims={"email": sample_user.email, "role": sample_user.role.value},
    )
    return {"Authorization": f"Bearer {token}"}


# ==========================================
# 1. Tests para LOGIN
# ==========================================

def test_login_usuario_incorrecto_formato(client: TestClient):
    """Email con formato inválido debe retornar 422."""
    res = client.post("/api/v1/auth/login", json={"email": "not-an-email", "password": "anypassword"})
    assert res.status_code == 422
    assert "email" in res.text


def test_login_usuario_no_encontrado(client: TestClient):
    """Usuario que no existe en la base de datos debe retornar 401."""
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@mesa247.com", "password": "ValidPassword123"},
    )
    assert res.status_code == 401
    assert "Credenciales incorrectas" in res.json()["detail"]


def test_login_contrasena_no_valida(client: TestClient, sample_user: User):
    """Usuario existe pero la contraseña no coincide debe retornar 401."""
    res = client.post(
        "/api/v1/auth/login",
        json={"email": sample_user.email, "password": "WrongPassword999!"},
    )
    assert res.status_code == 401
    assert "Credenciales incorrectas" in res.json()["detail"]


def test_login_contrasena_valida(client: TestClient, sample_user: User):
    """Credenciales correctas deben retornar 200 y el token JWT."""
    res = client.post(
        "/api/v1/auth/login",
        json={"email": sample_user.email, "password": "ValidPassword123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in_seconds"] > 0


# ==========================================
# 2. Tests para CREAR USUARIO
# ==========================================

def test_crear_usuario_datos_invalidos(client: TestClient):
    """Falta de campos requeridos o tipos inválidos debe retornar 422."""
    # Body vacío
    res_empty = client.post("/api/v1/users/", json={})
    assert res_empty.status_code == 422

    # Falta password y branch_id
    res_missing = client.post("/api/v1/users/", json={"name": "Host", "email": "host@mesa247.com"})
    assert res_missing.status_code == 422

    # branch_id con tipo incorrecto
    res_bad_type = client.post(
        "/api/v1/users/",
        json={"name": "Host", "email": "host@mesa247.com", "password": "ValidPassword123", "branch_id": "not_an_int"},
    )
    assert res_bad_type.status_code == 422


def test_crear_usuario_email_invalido(client: TestClient, sample_branch: Branch):
    """Email con formato inválido debe retornar 422."""
    invalid_emails = ["plainaddress", "@missingusername.com", "username@.com", "user@domain..com"]
    for bad_email in invalid_emails:
        res = client.post(
            "/api/v1/users/",
            json={
                "name": "Host User",
                "email": bad_email,
                "password": "SecurePassword123",
                "branch_id": sample_branch.id,
            },
        )
        assert res.status_code == 422


def test_crear_usuario_contrasena_insegura(client: TestClient, sample_branch: Branch):
    """Contraseña con menos de 8 caracteres debe retornar 422."""
    short_passwords = ["123", "abc", "short", "pass7"]
    for pwd in short_passwords:
        res = client.post(
            "/api/v1/users/",
            json={
                "name": "Host User",
                "email": "host@mesa247.com",
                "password": pwd,
                "branch_id": sample_branch.id,
            },
        )
        assert res.status_code == 422
        assert "password" in res.text.lower() or "string should have at least 8 characters" in res.text.lower()


def test_crear_usuario_sede_no_encontrada(client: TestClient):
    """Crear usuario con una sede que no existe debe retornar 404."""
    non_existent_branch_id = 999999
    res = client.post(
        "/api/v1/users/",
        json={
            "name": "Host User",
            "email": "host_lost@mesa247.com",
            "password": "SecurePassword123",
            "branch_id": non_existent_branch_id,
        },
    )
    assert res.status_code == 404
    assert f"Branch with id {non_existent_branch_id} does not exist" in res.json()["detail"]


def test_crear_usuario_rol_no_valido(client: TestClient, sample_branch: Branch):
    """Rol que no pertenece a UserRole debe retornar 422."""
    res = client.post(
        "/api/v1/users/",
        json={
            "name": "Super User",
            "email": "superuser@mesa247.com",
            "password": "SecurePassword123",
            "branch_id": sample_branch.id,
            "role": "god_mode_role",
        },
    )
    assert res.status_code == 422


def test_crear_usuario_entradas_muy_cortas_o_muy_largas(client: TestClient, sample_branch: Branch):
    """Nombres o contraseñas fuera de los límites de longitud deben retornar 422."""
    # Nombre muy corto (1 caracter)
    res_name_short = client.post(
        "/api/v1/users/",
        json={"name": "A", "email": "a@mesa247.com", "password": "SecurePassword123", "branch_id": sample_branch.id},
    )
    assert res_name_short.status_code == 422

    # Nombre muy largo (> 150 caracteres)
    res_name_long = client.post(
        "/api/v1/users/",
        json={"name": "A" * 151, "email": "long@mesa247.com", "password": "SecurePassword123", "branch_id": sample_branch.id},
    )
    assert res_name_long.status_code == 422

    # Contraseña muy larga (> 128 caracteres)
    res_pwd_long = client.post(
        "/api/v1/users/",
        json={"name": "Valid Host", "email": "valid@mesa247.com", "password": "P" * 129, "branch_id": sample_branch.id},
    )
    assert res_pwd_long.status_code == 422


# ==========================================
# 3. Tests para CREAR Y ACTUALIZAR SEDE
# ==========================================

def test_sede_no_encontrada(client: TestClient, auth_headers: dict[str, str]):
    """Consultar o actualizar una sede inexistente debe retornar 404."""
    non_existent_id = 888888

    # GET sede inexistente
    res_get = client.get(f"/api/v1/branches/{non_existent_id}")
    assert res_get.status_code == 404

    # PATCH sede inexistente
    res_patch = client.patch(f"/api/v1/branches/{non_existent_id}", json={"name": "Nuevo Nombre"})
    assert res_patch.status_code == 404

    # POST comensal a sede inexistente
    res_queue = client.post(
        f"/api/v1/branches/{non_existent_id}/queue/",
        json={"customer_name": "Diner", "phone_number": "+51987654321", "party_size": 2},
        headers=auth_headers,
    )
    assert res_queue.status_code == 404


def test_datos_invalidos_party_size_menor_a_1(client: TestClient, sample_branch: Branch, auth_headers: dict[str, str]):
    """Registrar un comensal con party_size <= 0 debe retornar 422."""
    # party_size = 0
    res_zero = client.post(
        f"/api/v1/branches/{sample_branch.id}/queue/",
        json={"customer_name": "Diner Zero", "phone_number": "+51987654321", "party_size": 0},
        headers=auth_headers,
    )
    assert res_zero.status_code == 422
    assert "party_size" in res_zero.text

    # party_size = -5
    res_negative = client.post(
        f"/api/v1/branches/{sample_branch.id}/queue/",
        json={"customer_name": "Diner Negative", "phone_number": "+51987654321", "party_size": -5},
        headers=auth_headers,
    )
    assert res_negative.status_code == 422


def test_crear_sede_longitudes_muy_cortas_o_muy_largas(client: TestClient):
    """Crear sede con campos fuera de límites debe retornar 422."""
    valid_base = {
        "name": "Sede Central",
        "street": "Calle Mayor",
        "exterior_number": "100",
        "neighborhood": "Centro",
        "city": "Lima",
        "state": "Lima",
        "country": "Peru",
    }

    # Nombre muy corto (< 2 chars)
    payload_short_name = {**valid_base, "name": "A"}
    assert client.post("/api/v1/branches/", json=payload_short_name).status_code == 422

    # Nombre muy largo (> 150 chars)
    payload_long_name = {**valid_base, "name": "A" * 151}
    assert client.post("/api/v1/branches/", json=payload_long_name).status_code == 422

    # Calle muy corta (< 2 chars)
    payload_short_street = {**valid_base, "street": "X"}
    assert client.post("/api/v1/branches/", json=payload_short_street).status_code == 422

    # Calle muy larga (> 200 chars)
    payload_long_street = {**valid_base, "street": "X" * 201}
    assert client.post("/api/v1/branches/", json=payload_long_street).status_code == 422

    # Ciudad muy larga (> 100 chars)
    payload_long_city = {**valid_base, "city": "C" * 101}
    assert client.post("/api/v1/branches/", json=payload_long_city).status_code == 422

    # País muy largo (> 100 chars)
    payload_long_country = {**valid_base, "country": "P" * 101}
    assert client.post("/api/v1/branches/", json=payload_long_country).status_code == 422


def test_actualizar_sede_longitudes_muy_cortas_o_muy_largas(client: TestClient, sample_branch: Branch):
    """Actualizar sede con campos fuera de límites debe retornar 422."""
    # Nombre muy corto en PATCH
    res_short = client.patch(f"/api/v1/branches/{sample_branch.id}", json={"name": "Z"})
    assert res_short.status_code == 422

    # Nombre muy largo en PATCH
    res_long = client.patch(f"/api/v1/branches/{sample_branch.id}", json={"name": "Z" * 151})
    assert res_long.status_code == 422

    # Calle muy larga en PATCH
    res_street_long = client.patch(f"/api/v1/branches/{sample_branch.id}", json={"street": "S" * 201})
    assert res_street_long.status_code == 422


def test_actualizar_sede_valida(client: TestClient, sample_branch: Branch):
    """Actualización exitosa de una sede existente retorna 200 con datos actualizados."""
    res = client.patch(
        f"/api/v1/branches/{sample_branch.id}",
        json={"name": "Sede Miraflores Renovada", "interior_number": "Piso 5"},
    )
    assert res.status_code == 200
    updated = res.json()
    assert updated["name"] == "Sede Miraflores Renovada"
    assert updated["interior_number"] == "Piso 5"
    assert "Piso 5" in updated["full_address"]
