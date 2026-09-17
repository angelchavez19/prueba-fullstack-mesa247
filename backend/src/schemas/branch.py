from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from src.models.branch import BranchBase


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    street: Optional[str] = Field(default=None, min_length=2, max_length=200)
    exterior_number: Optional[str] = Field(default=None, min_length=1, max_length=50)
    interior_number: Optional[str] = Field(default=None, max_length=50)
    neighborhood: Optional[str] = Field(default=None, min_length=2, max_length=120)
    city: Optional[str] = Field(default=None, min_length=2, max_length=100)
    state: Optional[str] = Field(default=None, min_length=2, max_length=100)
    country: Optional[str] = Field(default=None, min_length=2, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=20)


class BranchRead(BranchBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_address: str
    created_at: datetime
    updated_at: datetime
