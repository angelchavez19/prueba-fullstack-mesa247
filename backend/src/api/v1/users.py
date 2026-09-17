from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from src.database import get_session
from src.models.user import User, UserRole
from src.models.branch import Branch
from src.schemas.user import UserCreate, UserRead
from src.security import hash_password
from src.api.deps import get_current_user

router = APIRouter(prefix="/users", tags=["Users (Restaurant Staff)"])


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    session: Session = Depends(get_session),
) -> User:
    """
    Create a new restaurant user (e.g. host).
    Encrypts password using Argon2.
    """
    # Verify branch exists
    branch = session.get(Branch, user_in.branch_id)
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Branch with id {user_in.branch_id} does not exist",
        )

    # Check for email uniqueness
    existing_user = session.exec(select(User).where(User.email == user_in.email)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{user_in.email}' already exists",
        )

    # Hash password with Argon2
    hashed_pwd = hash_password(user_in.password)

    user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_pwd,
        branch_id=user_in.branch_id,
        role=user_in.role,
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.get("/", response_model=List[UserRead])
def list_users(
    branch_id: Optional[int] = None,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> List[User]:
    """List restaurant users, optionally filtered by branch."""
    statement = select(User)
    if branch_id is not None:
        statement = statement.where(User.branch_id == branch_id)
    users = session.exec(statement).all()
    return list(users)
