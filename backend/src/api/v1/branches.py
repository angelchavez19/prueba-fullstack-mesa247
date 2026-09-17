from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from src.database import get_session
from src.models.branch import Branch
from src.schemas.branch import BranchCreate, BranchRead, BranchUpdate
from src.api.deps import get_current_user
from src.models.user import User

router = APIRouter(prefix="/branches", tags=["Branches (Sedes)"])


@router.post("/", response_model=BranchRead, status_code=status.HTTP_201_CREATED)
def create_branch(
    branch_in: BranchCreate,
    session: Session = Depends(get_session),
) -> Branch:
    """Create a new restaurant branch with segmented address."""
    branch = Branch.model_validate(branch_in)
    session.add(branch)
    session.commit()
    session.refresh(branch)
    return branch


@router.get("/", response_model=List[BranchRead])
def list_branches(
    session: Session = Depends(get_session),
) -> List[Branch]:
    """List all restaurant branches."""
    branches = session.exec(select(Branch)).all()
    return list(branches)


@router.get("/{branch_id}", response_model=BranchRead)
def get_branch(
    branch_id: int,
    session: Session = Depends(get_session),
) -> Branch:
    """Retrieve details of a specific branch."""
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Branch with id {branch_id} not found",
        )
    return branch
