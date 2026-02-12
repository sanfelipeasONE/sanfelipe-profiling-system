from sqlalchemy.orm import Session, joinedload
import models, schemas
from sqlalchemy import or_, func


# ==========================================
# SINGLE RESIDENT (WITH RELATIONSHIPS)
# ==========================================
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


# ==========================================
# COUNT (FOR PAGINATION)
# ==========================================
def get_resident_count(db: Session, search: str = None, barangay: str = None):
    query = db.query(models.ResidentProfile)

    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            or_(
                models.ResidentProfile.last_name.ilike(search_fmt),
                models.ResidentProfile.first_name.ilike(search_fmt)
            )
        )

    # ✅ FIX: Case-insensitive barangay filtering
    if barangay:
        query = query.filter(
            func.replace(func.upper(models.ResidentProfile.barangay), 'Ñ', 'N') ==
            barangay.upper().replace('Ñ', 'N')
        )

    return query.count()


# ==========================================
# GET RESIDENTS (PAGINATED)
# ==========================================
def get_residents(db: Session, skip: int = 0, limit: int = 20,
                  search: str = None, barangay: str = None):

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

    # ✅ FIX: Case-insensitive barangay filtering
    if barangay:
        query = query.filter(
            func.replace(func.upper(models.ResidentProfile.barangay), 'Ñ', 'N') ==
            barangay.upper().replace('Ñ', 'N')
        )

    return (
        query
        .order_by(models.ResidentProfile.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ==========================================
# CREATE RESIDENT
# ==========================================
def create_resident(db: Session, resident: schemas.ResidentCreate):
    try:
        resident_data = resident.model_dump()

        family_members_data = resident_data.pop("family_members", [])
        sector_ids = resident_data.pop("sector_ids", [])
        resident_data.pop("sector_summary", None)

        # Normalize barangay (VERY IMPORTANT)
        if "barangay" in resident_data and resident_data["barangay"]:
            resident_data["barangay"] = resident_data["barangay"].strip().upper()

        valid_columns = {c.name for c in models.ResidentProfile.__table__.columns}
        filtered_data = {k: v for k, v in resident_data.items() if k in valid_columns}

        sector_names_list = []
        if sector_ids:
            selected_sectors = db.query(models.Sector).filter(
                models.Sector.id.in_(sector_ids)
            ).all()
            sector_names_list = [sector.name for sector in selected_sectors]

        summary_string = ", ".join(sector_names_list)

        db_resident = models.ResidentProfile(
            **filtered_data,
            sector_summary=summary_string
        )

        db.add(db_resident)
        db.commit()
        db.refresh(db_resident)

        # Associate sectors
        if sector_ids:
            db_resident.sectors = selected_sectors

        # Add family members
        valid_fm_columns = {c.name for c in models.FamilyMember.__table__.columns}

        for member_data in family_members_data:
            if isinstance(member_data, dict):
                clean_member = {
                    k: v for k, v in member_data.items()
                    if k in valid_fm_columns
                }
            else:
                clean_member = {
                    k: v for k, v in member_data.model_dump().items()
                    if k in valid_fm_columns
                }

            db_member = models.FamilyMember(
                **clean_member,
                profile_id=db_resident.id
            )
            db.add(db_member)

        db.commit()
        db.refresh(db_resident)

        return db_resident

    except Exception as e:
        db.rollback()
        raise e


# ==========================================
# UPDATE RESIDENT
# ==========================================
def update_resident(db: Session, resident_id: int,
                    resident_data: schemas.ResidentUpdate):

    db_resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not db_resident:
        return None

    update_data = resident_data.dict(exclude={'sector_ids', 'family_members'})

    # Normalize barangay
    if "barangay" in update_data and update_data["barangay"]:
        update_data["barangay"] = update_data["barangay"].strip().upper()

    for key, value in update_data.items():
        setattr(db_resident, key, value)

    # Update sectors
    db_resident.sectors.clear()
    if resident_data.sector_ids:
        new_sectors = db.query(models.Sector).filter(
            models.Sector.id.in_(resident_data.sector_ids)
        ).all()

        db_resident.sectors = new_sectors
        db_resident.sector_summary = ", ".join([s.name for s in new_sectors])

    # Update family members
    db.query(models.FamilyMember).filter(
        models.FamilyMember.profile_id == resident_id
    ).delete()

    for fm_data in resident_data.family_members or []:
        new_fm = models.FamilyMember(
            **fm_data.dict(),
            profile_id=resident_id
        )
        db.add(new_fm)

    db.commit()
    db.refresh(db_resident)
    return db_resident


# ==========================================
# DELETE RESIDENT
# ==========================================
def delete_resident(db: Session, resident_id: int):
    db_resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if db_resident:
        db.delete(db_resident)
        db.commit()

    return db_resident


# ==========================================
# DASHBOARD STATS
# ==========================================
def get_dashboard_stats(db: Session):

    total_residents = db.query(models.ResidentProfile).count()

    total_households = db.query(
        models.ResidentProfile.house_no
    ).distinct().count()

    total_male = db.query(models.ResidentProfile).filter(
        func.upper(models.ResidentProfile.sex).in_(["M", "MALE"])
    ).count()

    total_female = db.query(models.ResidentProfile).filter(
        func.upper(models.ResidentProfile.sex).in_(["F", "FEMALE"])
    ).count()

    barangay_counts = db.query(
        models.ResidentProfile.barangay,
        func.count(models.ResidentProfile.id)
    ).group_by(models.ResidentProfile.barangay).all()

    stats_barangay = {b: count for b, count in barangay_counts if b}

    sector_counts = db.query(
        models.Sector.name,
        func.count(models.resident_sectors.c.resident_id)
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
