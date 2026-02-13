from sqlalchemy import Column, Integer, String, Boolean, Date, ForeignKey, DateTime, Table, UniqueConstraint
from sqlalchemy.orm import relationship as orm_relationship
from sqlalchemy.sql import func
from database import Base

# --- ASSOCIATION TABLE (Many-to-Many) ---
resident_sectors = Table(
    'resident_sectors', Base.metadata,
    Column('resident_id', Integer, ForeignKey('resident_profiles.id')),
    Column('sector_id', Integer, ForeignKey('sectors.id'))
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="admin")

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

# --- MAIN TABLE ---
class ResidentProfile(Base):
    __tablename__ = "resident_profiles"
    
    __table_args__ = (
        UniqueConstraint(
            "last_name",
            "first_name",
            "birthdate",
            "barangay",
            name="uq_resident_identity"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    
    is_archived = Column(Boolean, default=False)
    
    is_family_head = Column(Boolean, default=True)
    
    status = Column(String, default="Active")

    # 1. PERSONAL INFO
    last_name = Column(String, index=True)
    first_name = Column(String, index=True)
    middle_name = Column(String, nullable=True)
    ext_name = Column(String, nullable=True)
    
    # 2. ADDRESS
    house_no = Column(String, nullable=True)
    purok = Column(String, index=True)
    barangay = Column(String, index=True)
    
    # 3 Spouse/Partner
    spouse_last_name = Column(String, nullable=True)
    spouse_first_name = Column(String, nullable=True)
    spouse_middle_name = Column(String, nullable=True)
    spouse_ext_name = Column(String, nullable=True)

    # 4. DEMOGRAPHICS
    birthdate = Column(Date)
    sex = Column(String)
    civil_status = Column(String, nullable=True)
    religion = Column(String, nullable=True)
    precinct_no = Column(String, nullable=True)
    
    # 5. WORK & CONTACT
    occupation = Column(String, nullable=True)
    contact_no = Column(String, nullable=True)

    # 6. SECTORS (Text Summary)
    other_sector_details = Column(String, nullable=True) 
    sector_summary = Column(String, nullable=True)

    # System Fields
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # --- RELATIONSHIPS ---
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
    relationship = Column(String) 
    
    birthdate = Column(Date, nullable=True)
    occupation = Column(String, nullable=True)
    
    is_active = Column(Boolean, default=True)
    is_family_head = Column(Boolean, default=False)
    head = orm_relationship("ResidentProfile", back_populates="family_members")