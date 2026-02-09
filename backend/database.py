from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


# Getting Database URL
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:root1234@localhost:5432/sfz_db"

print(f"Connecting to: {SQLALCHEMY_DATABASE_URL}")

# Safety Check
if not SQLALCHEMY_DATABASE_URL:
    raise ValueError("DATABASE_URL is not set. Please check your .env file.")

# Creating the engine
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Creating the session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()