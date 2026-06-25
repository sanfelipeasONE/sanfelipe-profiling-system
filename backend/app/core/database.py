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

# --- UPDATED CONNECTION POOL SETTINGS ---
engine = create_engine(
    DATABASE_URL, 
    pool_size=20,        # Increased from 5 to 20 to handle large imports
    max_overflow=10,     # Allow 10 extra connections during traffic spikes
    pool_timeout=60,     # Wait 60 seconds instead of 30 before timing out
    pool_recycle=1800,
    pool_pre_ping=True
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