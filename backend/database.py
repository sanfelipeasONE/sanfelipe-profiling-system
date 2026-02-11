import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load .env locally
load_dotenv()

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set.")

print("Connecting to database...")

engine = create_engine(
    DATABASE_URL, 
    pool_size=5,         # Keep only 5 connections open
    max_overflow=10,     # Allow 10 temporary extra connections
    pool_timeout=30,     # Wait 30s before giving up
    pool_recycle=1800    # Refresh connections every 30 mins
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
