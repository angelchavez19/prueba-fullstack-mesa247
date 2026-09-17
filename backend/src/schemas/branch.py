from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from src.models.branch import BranchBase


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    street: Optional[str] = None
    exterior_number: Optional[str] = None
    interior_number: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None


class BranchRead(BranchBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_address: str
    created_at: datetime
    updated_at: datetime
