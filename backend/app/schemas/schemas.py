from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date, datetime  # <--- FIX: Added datetime here

# =======================
# REFERENCE DATA SCHEMAS
# =======================
class Barangay(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class Purok(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class Relationship(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class Sector(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

# =======================
# FAMILY MEMBER SCHEMAS
# =======================

class FamilyMemberBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    relationship: Optional[str] = None


class FamilyMemberCreate(FamilyMemberBase):
    pass


class FamilyMember(FamilyMemberBase):
    id: int
    profile_id: int

    class Config:
        from_attributes = True


# =======================
# RESIDENT SCHEMAS
# =======================
class ResidentBase(BaseModel):
    last_name: str
    first_name: str
    middle_name: Optional[str] = None
    ext_name: Optional[str] = None
    
    # Address
    house_no: Optional[str] = None
    purok: str
    barangay: str
    
    # Personal Info
    sex: Optional[str] = None
    birthdate: Optional[date] = None
    civil_status: Optional[str] = None
    religion: Optional[str] = None
    occupation: Optional[str] = None
    
    # Spouse/Partner Info
    spouse_last_name: Optional[str] = None
    spouse_first_name: Optional[str] = None
    spouse_middle_name: Optional[str] = None
    spouse_ext_name: Optional[str] = None
    
    # Contact / Govt IDs
    contact_no: Optional[str] = None
    precinct_no: Optional[str] = None
    
    # Summary
    sector_summary: Optional[str] = None
    other_sector_details: Optional[str] = None

class ResidentCreate(ResidentBase):
    sector_ids: List[int] = []
    family_members: List[FamilyMemberCreate] = []

class ResidentUpdate(ResidentBase):
    sector_ids: Optional[List[int]] = []
    family_members: Optional[List[FamilyMemberCreate]] = []

class Resident(ResidentBase):
    id: int
    created_at: Optional[datetime] = None
    family_members: List[FamilyMember] = []
    sectors: List[Sector] = [] # Note: Assuming Sector schema exists above

    class Config:
        from_attributes = True

class ResidentPagination(BaseModel):
    items: List[Resident]
    total: int
    page: int
    size: int
    class Config:
        from_attributes = True

# =======================
# USER SCHEMAS
# =======================
class UserBase(BaseModel):
    username: str
    role: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str

class TokenData(BaseModel):
    username: Optional[str] = None

# =======================
# DASHBOARD STATS
# =======================
class DashboardStats(BaseModel):
    total_residents: int
    total_households: int
    total_male: int
    total_female: int
    population_by_barangay: Dict[str, int] # Fix: Use Dict for type safety
    population_by_sector: Dict[str, int]