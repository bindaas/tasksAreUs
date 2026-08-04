from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/tasksareus"
    FIREBASE_SERVICE_ACCOUNT_JSON: Optional[str] = None
    FIREBASE_PROJECT_ID: Optional[str] = None
    # Local/CI integration-test bypass only. Never set true in production.
    TEST_AUTH_BYPASS: bool = False

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
