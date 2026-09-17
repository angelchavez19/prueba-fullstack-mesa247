from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict
from src.models.user import UserRole


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    branch_id: int
    role: UserRole = UserRole.HOST


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: UserRole
    branch_id: int
    is_active: bool
    created_at: datetime


class UserLogin(BaseModel):
    email: EmailStr
    password: str
