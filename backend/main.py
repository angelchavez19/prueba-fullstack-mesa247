from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.config import get_settings
from src.database import init_db
from src.api.v1.router import api_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mesa247-backend")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and shutdown events."""
    logger.info("Starting up Mesa247 Restaurant Queue API...")
    try:
        init_db()
        logger.info("Database initialized successfully.")
    except Exception as exc:
        logger.warning(
            f"Could not connect to database on startup: {exc}. "
            "Ensure MySQL is running via `docker compose up -d`."
        )
    yield
    logger.info("Shutting down Mesa247 Restaurant Queue API...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Sistema de colas para restaurantes con sedes en LATAM",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "version": "1.0.0",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}
