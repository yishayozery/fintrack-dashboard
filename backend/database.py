import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base

# Reads DATABASE_URL from environment variable (set in .env or docker-compose)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://fintrack:fintrack123@localhost:5432/fintrack"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_tables():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency — yields a DB session, closes when done."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
