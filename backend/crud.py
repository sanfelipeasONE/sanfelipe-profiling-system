from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
import models, schemas


# =====================================================
# CREATE RESIDENT
# =====================================================
def create_resident(db: Session, resident: schemas.ResidentCreate):
    resident_data = resident.model_dump()

    family_members_data = resident_data.pop("family_members", [])
    sector_ids = resident_data.pop("sector_ids", [])
    resident_data.pop("sector_summary", None)

    valid_columns = {c.name for c in models.ResidentProfile.__table__.columns}
    filtered_data = {k: v for k, v in resident_data.items() if k in valid_columns}

    db_resident = models.ResidentProfile(**filtered_data)
    db.add(db_resident)
    db.commit()
    db.refresh(db_resident)

    # Attach sectors
    if sector_ids:
        sectors = db.query(models.Sector).filter(
            models.Sector.id.in_(sector_ids)
        ).all()
        db_resident.sectors = sectors

    # Add family members
    for member_data in family_members_data:
        db_member = models.FamilyMember(
            **member_data.model_dump(),
            profile_id=db_resident.id
        )
        db.add(db_member)

    db.commit()
    db.refresh(db_resident)

    return db_resident


# =====================================================
# UPDATE RESIDENT
# =====================================================
def update_resident(db: Session, resident_id: int, resident_data: schemas.ResidentUpdate):
    db_resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not db_resident:
        return None

    update_data = resident_data.model_dump(
        exclude={"sector_ids", "family_members"}
    )

    for key, value in update_data.items():
        setattr(db_resident, key, value)

    # Update sectors
    db_resident.sectors.clear()
    if resident_data.sector_ids:
        new_sectors = db.query(models.Sector).filter(
            models.Sector.id.in_(resident_data.sector_ids)
        ).all()
        db_resident.sectors = new_sectors

    # Update family members
    db.query(models.FamilyMember).filter(
        models.FamilyMember.profile_id == resident_id
    ).delete()

    if resident_data.family_members:
        for fm_data in resident_data.family_members:
            new_fm = models.FamilyMember(
                **fm_data.model_dump(),
                profile_id=resident_id
            )
            db.add(new_fm)

    db.commit()
    db.refresh(db_resident)
    return db_resident


# =====================================================
# DELETE RESIDENT
# =====================================================
def delete_resident(db: Session, resident_id: int):
    db_resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not db_resident:
        return None

    db.delete(db_resident)
    db.commit()
    return db_resident


# =====================================================
# FILTER HELPERS
# =====================================================
def apply_barangay_filter(query, barangay: str):
    if barangay:
        query = query.filter(
            func.lower(models.ResidentProfile.barangay)
            .like(f"%{barangay.lower()}%")
        )
    return query


def apply_sector_filter(query, sector: str):
    if not sector:
        return query

    normalized = sector.strip().lower()

    if normalized == "others":
        return query.filter(
            or_(
                func.lower(
                    func.coalesce(models.ResidentProfile.sector_summary, "")
                ).like("%others%"),
                func.coalesce(models.ResidentProfile.other_sector_details, "") != ""
            )
        )

    return query.filter(
        func.lower(
            func.coalesce(models.ResidentProfile.sector_summary, "")
        ).like(f"%{normalized}%")
    )


# =====================================================
# GET SINGLE RESIDENT
# =====================================================
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


# =====================================================
# COUNT RESIDENTS
# =====================================================
def get_resident_count(
    db: Session,
    search: str = None,
    barangay: str = None,
    sector: str = None
):
    query = db.query(models.ResidentProfile)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.ResidentProfile.last_name.ilike(search_fmt),
                models.ResidentProfile.first_name.ilike(search_fmt)
            )
        )

    query = apply_barangay_filter(query, barangay)
    query = apply_sector_filter(query, sector)

    return query.count()


# =====================================================
# GET RESIDENT LIST (WITH DYNAMIC SORTING)
# =====================================================
def get_residents(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    search: str = None,
    barangay: str = None,
    sector: str = None,
    sort_by: str = "last_name",
    sort_order: str = "asc"
):
    query = db.query(models.ResidentProfile).options(
        joinedload(models.ResidentProfile.family_members),
        joinedload(models.ResidentProfile.sectors)
    )

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.ResidentProfile.last_name.ilike(search_fmt),
                models.ResidentProfile.first_name.ilike(search_fmt)
            )
        )

    query = apply_barangay_filter(query, barangay)
    query = apply_sector_filter(query, sector)

    valid_columns = {
        "last_name": models.ResidentProfile.last_name,
        "first_name": models.ResidentProfile.first_name,
        "barangay": models.ResidentProfile.barangay,
        "purok": models.ResidentProfile.purok,
        "created_at": models.ResidentProfile.created_at,
        "birthdate": models.ResidentProfile.birthdate
    }

    column = valid_columns.get(sort_by, models.ResidentProfile.last_name)

    if sort_order.lower() == "desc":
        query = query.order_by(func.lower(column).desc())
    else:
        query = query.order_by(func.lower(column).asc())

    return query.offset(skip).limit(limit).all()


# =====================================================
# DASHBOARD STATS
# =====================================================
def get_dashboard_stats(db: Session):

    total_residents = db.query(
        func.count(models.ResidentProfile.id)
    ).scalar() or 0

    total_households = db.query(
        func.count(
            func.distinct(
                func.trim(models.ResidentProfile.barangay) +
                "-" +
                func.coalesce(func.trim(models.ResidentProfile.house_no), "")
            )
        )
    ).scalar() or 0

    total_male = db.query(
        func.count(models.ResidentProfile.id)
    ).filter(
        func.lower(models.ResidentProfile.sex).in_(["male", "m"])
    ).scalar() or 0

    total_female = db.query(
        func.count(models.ResidentProfile.id)
    ).filter(
        func.lower(models.ResidentProfile.sex).in_(["female", "f"])
    ).scalar() or 0

    barangay_counts = db.query(
        func.trim(models.ResidentProfile.barangay),
        func.count(models.ResidentProfile.id)
    ).group_by(
        func.trim(models.ResidentProfile.barangay)
    ).all()

    stats_barangay = {b: count for b, count in barangay_counts if b}

    sector_counts = db.query(
        models.ResidentProfile.sector_summary,
        func.count(models.ResidentProfile.id)
    ).filter(
        models.ResidentProfile.sector_summary.isnot(None)
    ).group_by(
        models.ResidentProfile.sector_summary
    ).all()

    stats_sector = {}
    for sector_summary, count in sector_counts:
        if not sector_summary or sector_summary.lower() == "none":
            continue

        sectors = [s.strip() for s in sector_summary.split(",")]

        for s in sectors:
            stats_sector[s] = stats_sector.get(s, 0) + count

    return {
        "total_residents": total_residents,
        "total_households": total_households,
        "total_male": total_male,
        "total_female": total_female,
        "population_by_barangay": stats_barangay,
        "population_by_sector": stats_sector
    }
