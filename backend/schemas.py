# backend/schemas.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime

# --- REFERENCE DATA SCHEMAS (New) ---
# We use one base class because they all just have 'id' and 'name'
class ReferenceBase(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class Barangay(ReferenceBase):
    pass

class Purok(ReferenceBase):
    pass

class Relationship(ReferenceBase):
    pass

class Sector(ReferenceBase):
    pass

# --- FAMILY MEMBER SCHEMAS ---

class FamilyMemberBase(BaseModel):
    last_name: str
    first_name: str
    middle_name: Optional[str] = None
    ext_name: Optional[str] = None
    relationship: str

class FamilyMemberCreate(FamilyMemberBase):
    pass

class FamilyMember(FamilyMemberBase):
    id: int
    profile_id: int
    is_active: bool
    class Config:
        from_attributes = True

# --- RESIDENT PROFILE SCHEMAS ---

class ResidentBase(BaseModel):
    # Personal
    last_name: str
    first_name: str
    middle_name: Optional[str] = None
    ext_name: Optional[str] = None
    
    # Address
    house_no: Optional[str] = None
    purok: str
    barangay: str
    
    # Demographics
    birthdate: date
    sex: str
    civil_status: str
    religion: Optional[str] = None
    occupation: Optional[str] = None
    precinct_no: Optional[str] = None
    contact_no: Optional[str] = None
    other_sector_details: Optional[str] = None

class ResidentCreate(ResidentBase):
    # When creating, we send LISTS of things to add
    family_members: List[FamilyMemberCreate] = []
    sector_ids: List[int] = [] # e.g., [1, 3, 5]

class Resident(ResidentBase):
    # When reading, we get the FULL OBJECTS back
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    family_members: List[FamilyMember] = []
    sectors: List[Sector] = [] # Returns full sector objects (id, name)

    class Config:
        from_attributes = True