from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/tasksareus"
    ANTHROPIC_API_KEY: Optional[str] = None
    CLAUDE_MODEL: str = "claude-sonnet-4-6"
    # USD per million tokens
    CLAUDE_INPUT_COST_PER_M: float = 3.0
    CLAUDE_OUTPUT_COST_PER_M: float = 15.0
    FIREBASE_SERVICE_ACCOUNT_JSON: Optional[str] = None
    FIREBASE_PROJECT_ID: Optional[str] = None

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
