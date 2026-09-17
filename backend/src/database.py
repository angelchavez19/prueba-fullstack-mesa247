from typing import Generator
from sqlmodel import SQLModel, Session, create_engine
from src.config import get_settings

settings = get_settings()

# Using pool_pre_ping to automatically reconnect if MySQL connection drops
engine = create_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=3600,
)


def init_db() -> None:
    """Create tables if they don't exist."""
    # Ensure all models are imported so SQLModel metadata registers them
    import src.models  # noqa: F401
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency for yielding database sessions."""
    with Session(engine) as session:
        yield session
