from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_", extra="ignore")

    app_name: str = "Supplier Ramp"
    debug: bool = True

    db_url: str = f"sqlite:///{DATA_DIR / 'app.db'}"

    secret_key: str = "change-me-to-a-long-random-string"
    session_cookie: str = "supplier_ramp_session"
    session_ttl_days: int = 30

    admin_username: str = "admin"
    admin_password: str = "admin123456"

    upload_dir: Path = DATA_DIR / "uploads"
    max_upload_bytes: int = 25 * 1024 * 1024


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)