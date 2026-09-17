from datetime import datetime, timezone
from enum import Enum
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from src.models.branch import Branch


class UserRole(str, Enum):
    HOST = "host"
    ADMIN = "admin"
    MANAGER = "manager"


class UserBase(SQLModel):
    name: str = Field(max_length=150)
    email: str = Field(unique=True, index=True, max_length=150)
    role: UserRole = Field(default=UserRole.HOST)
    branch_id: int = Field(foreign_key="branches.id", index=True)
    is_active: bool = Field(default=True)


class User(UserBase, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    password_hash: str = Field(max_length=255)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationship to Branch
    branch: Optional["Branch"] = Relationship(back_populates="users")
