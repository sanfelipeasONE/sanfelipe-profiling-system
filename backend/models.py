from sqlalchemy import Column, Integer, String, Boolean, Date, ForeignKey, DateTime, Table
from sqlalchemy.orm import relationship as orm_relationship # <--- RENAMED HERE TO AVOID CONFLICT
from sqlalchemy.sql import func
from database import Base

# --- ASSOCIATION TABLE ---
resident_sectors = Table(
    'resident_sectors', Base.metadata,
    Column('resident_id', Integer, ForeignKey('resident_profiles.id')),
    Column('sector_id', Integer, ForeignKey('sectors.id'))
)

# --- REFERENCE TABLES ---
class Barangay(Base):
    __tablename__ = "barangays"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

class Purok(Base):
    __tablename__ = "puroks"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

class Relationship(Base):
    __tablename__ = "relationships"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

class Sector(Base):
    __tablename__ = "sectors"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

# --- MAIN TABLES ---
class ResidentProfile(Base):
    __tablename__ = "resident_profiles"

    id = Column(Integer, primary_key=True, index=True)
    
    # Personal & Address
    last_name = Column(String, index=True)
    first_name = Column(String, index=True)
    middle_name = Column(String, nullable=True)
    ext_name = Column(String, nullable=True)
    
    house_no = Column(String, nullable=True)
    purok = Column(String, index=True)
    barangay = Column(String, index=True)

    # Demographics
    birthdate = Column(Date)
    sex = Column(String)
    civil_status = Column(String)
    religion = Column(String, nullable=True)
    occupation = Column(String, nullable=True)
    precinct_no = Column(String, nullable=True)
    contact_no = Column(String, nullable=True)
    other_sector_details = Column(String, nullable=True)

    # System Fields
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # --- RELATIONSHIPS (LINKS) ---
    # We use 'orm_relationship' here so it doesn't clash with any column names
    family_members = orm_relationship("FamilyMember", back_populates="head", cascade="all, delete-orphan")
    sectors = orm_relationship("Sector", secondary=resident_sectors, backref="residents")

class FamilyMember(Base):
    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("resident_profiles.id"))
    
    last_name = Column(String)
    first_name = Column(String)
    middle_name = Column(String, nullable=True)
    ext_name = Column(String, nullable=True)
    
    # This column caused the crash before because it was named the same as the function
    relationship = Column(String) 
    
    is_active = Column(Boolean, default=True)
    
    # LINK BACK
    head = orm_relationship("ResidentProfile", back_populates="family_members")