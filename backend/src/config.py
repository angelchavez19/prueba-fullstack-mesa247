from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Database
    DB_HOST: str = Field(default="127.0.0.1")
    DB_PORT: int = Field(default=3306)
    DB_USER: str = Field(default="mesa247_user")
    DB_PASSWORD: str = Field(default="mesa247_password")
    DB_NAME: str = Field(default="mesa247_queue_db")

    # Security & PyJWT
    SECRET_KEY: str = Field(default="mesa247_super_secret_jwt_key_latam_change_in_production")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=480) # Default 8h

    # Application
    APP_ENV: str = Field(default="development")
    API_V1_PREFIX: str = Field(default="/api/v1")
    PROJECT_NAME: str = Field(default="Mesa247 Restaurant Queue API")

    @property
    def database_url(self) -> str:
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"


@lru_cache
def get_settings() -> Settings:
    return Settings()
