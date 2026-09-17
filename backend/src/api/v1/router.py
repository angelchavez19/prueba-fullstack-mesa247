from fastapi import APIRouter
from src.api.v1.auth import router as auth_router
from src.api.v1.branches import router as branches_router
from src.api.v1.users import router as users_router
from src.api.v1.queue import router as queue_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(branches_router)
api_router.include_router(users_router)
api_router.include_router(queue_router)
