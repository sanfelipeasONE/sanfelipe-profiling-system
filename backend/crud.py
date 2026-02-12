from sqlalchemy.orm import Session, joinedload
import models, schemas
from sqlalchemy import or_, func

def get_resident(db: Session, resident_id: int):
    return (
        db.query(models.ResidentProfile)
        .options(
            joinedload(models.ResidentProfile.family_members),
            joinedload(models.ResidentProfile.sectors)
        )
        .filter(models.ResidentProfile.id == resident_id)
        .first()
    )


# --- FIX: Added Count Function for Pagination ---
def get_resident_count(db: Session, search: str = None, barangay: str = None):
    query = db.query(models.ResidentProfile)
    
    # Apply Search Filter
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            or_(
                models.ResidentProfile.last_name.ilike(search_fmt),
                models.ResidentProfile.first_name.ilike(search_fmt)
            )
        )
    
    # Apply Barangay Filter
    if barangay:
        query = query.filter(
            func.lower(models.ResidentProfile.barangay) == barangay.lower()
        )

    return query.count()

# --- FIX: Updated Fetcher with Pagination & Strict Filtering ---
def get_residents(db: Session, skip: int = 0, limit: int = 20, search: str = None, barangay: str = None):
    query = db.query(models.ResidentProfile).options(
        joinedload(models.ResidentProfile.family_members),
        joinedload(models.ResidentProfile.sectors)
    )

    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            or_(
                models.ResidentProfile.last_name.ilike(search_fmt),
                models.ResidentProfile.first_name.ilike(search_fmt)
            )
        )

    if barangay:
        query = query.filter(models.ResidentProfile.barangay == barangay)

    return query.order_by(models.ResidentProfile.id.desc()).offset(skip).limit(limit).all()

def create_resident(db: Session, resident: schemas.ResidentCreate):
    try:
        resident_data = resident.model_dump()
        
        # 1. Extract List Data
        family_members_data = resident_data.pop("family_members", [])
        sector_ids = resident_data.pop("sector_ids", [])
        resident_data.pop("sector_summary", None)

        # 2. SAFETY FILTER: Remove keys that don't exist in the DB Model
        # This prevents "invalid keyword argument" errors if schema and model don't match
        valid_columns = {c.name for c in models.ResidentProfile.__table__.columns}
        filtered_data = {k: v for k, v in resident_data.items() if k in valid_columns}

        # 3. Create the "sector_summary" string
        sector_names_list = []
        if sector_ids:
            selected_sectors = db.query(models.Sector).filter(models.Sector.id.in_(sector_ids)).all()
            sector_names_list = [sector.name for sector in selected_sectors]
            
        summary_string = ", ".join(sector_names_list)
        
        # 4. Create Resident Object using FILTERED data
        db_resident = models.ResidentProfile(
            **filtered_data,  # <--- WE USE THE CLEAN DATA HERE
            sector_summary=summary_string
        )
        
        db.add(db_resident)
        db.commit()
        db.refresh(db_resident)

        # 5. Associate Sectors
        if sector_ids:
            sectors = db.query(models.Sector).filter(models.Sector.id.in_(sector_ids)).all()
            db_resident.sectors = sectors
        
        # 6. Create Family Members
        # We also filter family member data just in case
        valid_fm_columns = {c.name for c in models.FamilyMember.__table__.columns}
        
        for member_data in family_members_data:
            # Clean the member data too
            clean_member_data = {k: v for k, v in member_data.items() if k in valid_fm_columns}
            if isinstance(member_data, dict): # Ensure it's a dict
                 db_member = models.FamilyMember(**clean_member_data, profile_id=db_resident.id)
                 db.add(db_member)
            else:
                 # Fallback if Pydantic object
                 clean_member_dict = member_data.model_dump()
                 final_member_data = {k: v for k, v in clean_member_dict.items() if k in valid_fm_columns}
                 db_member = models.FamilyMember(**final_member_data, profile_id=db_resident.id)
                 db.add(db_member)
        
        db.commit()
        db.refresh(db_resident)
        return db_resident

    except Exception as e:
        db.rollback()
        raise e
    
def update_resident(db: Session, resident_id: int, resident_data: schemas.ResidentUpdate):
    # 1. Get the existing resident
    db_resident = db.query(models.ResidentProfile).filter(models.ResidentProfile.id == resident_id).first()
    if not db_resident:
        return None

    # 2. Update Basic Fields
    # Convert input data to dictionary, excluding complex lists
    update_data = resident_data.dict(exclude={'sector_ids', 'family_members'})
    
    for key, value in update_data.items():
        setattr(db_resident, key, value) 

    # 3. Update Sectors (Clear old, Add new)
    db_resident.sectors.clear() 
    if resident_data.sector_ids:
        new_sectors = db.query(models.Sector).filter(models.Sector.id.in_(resident_data.sector_ids)).all()
        db_resident.sectors = new_sectors

        # Update summary string
        db_resident.sector_summary = ", ".join([s.name for s in new_sectors])

    # 4. Update Family Members (Delete old, Add new)
    db.query(models.FamilyMember).filter(models.FamilyMember.profile_id == resident_id).delete()
    
    for fm_data in resident_data.family_members:
        new_fm = models.FamilyMember(
            **fm_data.dict(),
            profile_id=resident_id 
        )
        db.add(new_fm)

    # 5. Save Changes
    db.commit()
    db.refresh(db_resident)
    return db_resident

def delete_resident(db: Session, resident_id: int):
    db_resident = db.query(models.ResidentProfile).filter(models.ResidentProfile.id == resident_id).first()
    if db_resident:
        db.delete(db_resident)
        db.commit()
    return db_resident

def get_dashboard_stats(db: Session):
    # 1. Basic Counts
    total_residents = db.query(models.ResidentProfile).count()
    
    # Count Unique House Numbers
    total_households = db.query(models.ResidentProfile.house_no).distinct().count()

    # 2. Gender Split
    total_male = db.query(models.ResidentProfile).filter(models.ResidentProfile.sex == "Male").count()
    total_female = db.query(models.ResidentProfile).filter(models.ResidentProfile.sex == "Female").count()

    # 3. Count by Barangay (Group By)
    barangay_counts = db.query(
        models.ResidentProfile.barangay, func.count(models.ResidentProfile.id)
    ).group_by(models.ResidentProfile.barangay).all()
    
    stats_barangay = {b: count for b, count in barangay_counts if b}

    # 4. Count by Sector (Group By)
    sector_counts = db.query(
        models.Sector.name, func.count(models.resident_sectors.c.resident_id)
    ).join(models.resident_sectors).group_by(models.Sector.name).all()
    
    stats_sector = {s: count for s, count in sector_counts if s}

    return {
        "total_residents": total_residents,
        "total_households": total_households,
        "total_male": total_male,
        "total_female": total_female,
        "population_by_barangay": stats_barangay,
        "population_by_sector": stats_sector
    }