from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from src.models.user import User
    from src.models.queue import QueueEntry


class BranchBase(SQLModel):
    name: str = Field(index=True, min_length=2, max_length=150)

    # Segmented address fields
    street: str = Field(min_length=2, max_length=200, description="Street, avenue or main roadway")
    exterior_number: str = Field(min_length=1, max_length=50, description="Exterior number or building identifier")
    interior_number: Optional[str] = Field(default=None, max_length=50, description="Interior, suite, or apartment number")
    neighborhood: str = Field(min_length=2, max_length=120, description="Neighborhood, district, or colonia")
    city: str = Field(min_length=2, max_length=100, description="City")
    state: str = Field(min_length=2, max_length=100, description="State, province, or department")
    country: str = Field(min_length=2, max_length=100, description="Country in LATAM (e.g. Peru, Mexico, Colombia, Chile, Argentina)")
    postal_code: Optional[str] = Field(default=None, max_length=20, description="Postal/ZIP code")


class Branch(BranchBase, table=True):
    __tablename__ = "branches"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    users: List["User"] = Relationship(back_populates="branch")
    queue_entries: List["QueueEntry"] = Relationship(back_populates="branch")

    @property
    def full_address(self) -> str:
        int_part = f", Int {self.interior_number}" if self.interior_number else ""
        pc_part = f", CP {self.postal_code}" if self.postal_code else ""
        return f"{self.street} {self.exterior_number}{int_part}, {self.neighborhood}, {self.city}, {self.state}, {self.country}{pc_part}"
