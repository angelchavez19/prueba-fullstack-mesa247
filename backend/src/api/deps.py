from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlmodel import Session, select
from src.database import get_session
from src.models.user import User
from src.security import decode_access_token

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session),
) -> User:
    """Dependency that decodes PyJWT token and verifies active authenticated user."""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id_str: str = payload.get("sub")  # type: ignore
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account",
        )
    return user


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    session: Session = Depends(get_session),
) -> User | None:
    """Dependency that returns active authenticated user if token is present and valid, or None."""
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user_id_str: str = payload.get("sub")  # type: ignore
        if user_id_str is None:
            return None
        user = session.get(User, int(user_id_str))
        if user and user.is_active:
            return user
    except Exception:
        return None
    return None

