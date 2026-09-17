from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from src.database import get_session
from src.models.user import User
from src.schemas.user import UserLogin, UserRead
from src.schemas.auth import Token
from src.security import verify_password, create_access_token
from src.config import get_settings
from src.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/login", response_model=Token)
def login(login_data: UserLogin, session: Session = Depends(get_session)) -> Token:
    """Authenticate a restaurant user via email and password."""
    statement = select(User).where(User.email == login_data.email)
    user = session.exec(statement).first()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas (correo o contraseña)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario se encuentra inactivo",
        )

    access_token = create_access_token(
        subject=user.id,
        extra_claims={
            "email": user.email,
            "role": user.role.value,
            "branch_id": user.branch_id,
        },
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserRead)
def get_authenticated_user_profile(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the currently authenticated restaurant staff user."""
    return current_user
