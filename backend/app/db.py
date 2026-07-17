from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


engine = create_engine(
    settings.db_url,
    connect_args={"check_same_thread": False} if settings.db_url.startswith("sqlite") else {},
    echo=False,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from .models import expansion, risk, supplier, task  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _run_idempotent_migrations()


def _run_idempotent_migrations() -> None:
    """对已存在的 SQLite 表补齐新增列（CREATE TABLE 不会加列）"""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "risk" in inspector.get_table_names():
        existing = {c["name"] for c in inspector.get_columns("risk")}
        stmts = []
        if "sourceKind" not in existing:
            stmts.append("ALTER TABLE risk ADD COLUMN sourceKind VARCHAR")
        if "sourceId" not in existing:
            stmts.append("ALTER TABLE risk ADD COLUMN sourceId INTEGER")
        if "sourcePlanId" not in existing:
            stmts.append("ALTER TABLE risk ADD COLUMN sourcePlanId VARCHAR")
        if "ix_risk_sourceKind" not in {ix["name"] for ix in inspector.get_indexes("risk")}:
            stmts.append("CREATE INDEX ix_risk_sourceKind ON risk (sourceKind)")
        if "ix_risk_sourceId" not in {ix["name"] for ix in inspector.get_indexes("risk")}:
            stmts.append("CREATE INDEX ix_risk_sourceId ON risk (sourceId)")
        if "ix_risk_sourcePlanId" not in {ix["name"] for ix in inspector.get_indexes("risk")}:
            stmts.append("CREATE INDEX ix_risk_sourcePlanId ON risk (sourcePlanId)")
        if stmts:
            with engine.begin() as conn:
                for s in stmts:
                    conn.execute(text(s))