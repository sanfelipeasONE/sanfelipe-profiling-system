from sqlalchemy.orm import Session
import models, schemas
from sqlalchemy import or_, func

def get_resident(db: Session, resident_id: int):
    return db.query(models.ResidentProfile).filter(models.ResidentProfile.id == resident_id).first()

def get_residents(db: Session, skip: int = 0, limit: int = 100, search: str = None, barangay: str = None):
    query = db.query(models.ResidentProfile)
    
    # 1. Apply Search Filter (Last Name or First Name)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            or_(
                models.ResidentProfile.last_name.ilike(search_fmt),
                models.ResidentProfile.first_name.ilike(search_fmt)
            )
        )
    
    # 2. NEW: Apply Barangay Filter
    if barangay:
        # This matches the exact name from your dropdown (e.g., "Rosete")
        query = query.filter(models.ResidentProfile.barangay == barangay)
    
    return query.offset(skip).limit(limit).all()

def create_resident(db: Session, resident: schemas.ResidentCreate):
    try:
        resident_data = resident.model_dump()
        
        # Extract List Data
        family_members_data = resident_data.pop("family_members", [])
        sector_ids = resident_data.pop("sector_ids", [])
        resident_data.pop("sector_summary", None)
        
        # Create the "sector_summary" string
        sector_names_list = []
        if sector_ids:
            selected_sectors = db.query(models.Sector).filter(models.Sector.id.in_(sector_ids)).all()
            sector_names_list = [sector.name for sector in selected_sectors]
            
        summary_string = ", ".join(sector_names_list)
        
        # Create Resident Object
        db_resident = models.ResidentProfile(
            **resident_data,
            sector_summary=summary_string
        )
        
        db.add(db_resident)
        db.commit()
        db.refresh(db_resident)

        # Associate Sectors
        if sector_ids:
            sectors = db.query(models.Sector).filter(models.Sector.id.in_(sector_ids)).all()
            db_resident.sectors = sectors
        
        # Create Family Members
        for member_data in family_members_data:
            db_member = models.FamilyMember(**member_data, profile_id=db_resident.id)
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
    # We convert the input data to a dictionary, excluding the complex lists
    update_data = resident_data.dict(exclude={'sector_ids', 'family_members'})
    
    for key, value in update_data.items():
        setattr(db_resident, key, value) # Update the field

    # 3. Update Sectors (Clear old, Add new)
    db_resident.sectors.clear() # Remove all existing sectors
    for s_id in resident_data.sector_ids:
        sector = db.query(models.Sector).filter(models.Sector.id == s_id).first()
        if sector:
            db_resident.sectors.append(sector)

    # 4. Update Family Members (Delete old, Add new)
    # First, delete all existing family members for this person
    db.query(models.FamilyMember).filter(models.FamilyMember.profile_id == resident_id).delete()
    
    # Then add the new list
    for fm_data in resident_data.family_members:
        new_fm = models.FamilyMember(
            **fm_data.dict(),
            profile_id=resident_id # Link to this resident
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
    
    # Convert list of tuples to dictionary { "Amagna": 150, "Apostol": 200 }
    stats_barangay = {b: count for b, count in barangay_counts if b}

    # 4. Count by Sector (Group By)
    # This is trickier because it's a Many-to-Many relationship. 
    # We query the link table directly or join.
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