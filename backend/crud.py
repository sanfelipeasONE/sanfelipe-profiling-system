# backend/crud.py
from sqlalchemy.orm import Session
import models, schemas
import json

# --- READ (GET) ---

def get_resident(db: Session, resident_id: int):
    return db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id, 
        models.ResidentProfile.is_active == True
    ).first()

def get_residents(db: Session, skip: int = 0, limit: int = 100, search: str = None):
    query = db.query(models.ResidentProfile).filter(models.ResidentProfile.is_active == True)
    if search:
        query = query.filter(models.ResidentProfile.last_name.ilike(f"%{search}%"))
    return query.offset(skip).limit(limit).all()

# --- CREATE (POST) - DEBUGGED ---

def create_resident(db: Session, resident: schemas.ResidentCreate):
    try:
        resident_data = resident.model_dump()
        
        # 1. Extract List Data
        family_members_data = resident_data.pop("family_members", [])
        sector_ids = resident_data.pop("sector_ids", [])
        
        # 2. Create Resident Head
        db_resident = models.ResidentProfile(**resident_data)
        
        # 3. Associate Sectors
        if sector_ids:
            sectors = db.query(models.Sector).filter(models.Sector.id.in_(sector_ids)).all()
            db_resident.sectors = sectors

        db.add(db_resident)
        db.commit()
        db.refresh(db_resident)
        
        # 4. Create Family Members
        for member_data in family_members_data:
            db_member = models.FamilyMember(**member_data, profile_id=db_resident.id)
            db.add(db_member)
        
        db.commit()
        db.refresh(db_resident)
        return db_resident

    except Exception as e:
        db.rollback()
        raise e

# --- DELETE ---

def delete_resident(db: Session, resident_id: int):
    db_resident = get_resident(db, resident_id)
    if db_resident:
        db_resident.is_active = False
        db.commit()
    return db_resident