from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
import models, schemas


# =====================================================
# HELPER: SAFE BARANGAY FILTER
# =====================================================

def apply_barangay_filter(query, barangay: str):
    if barangay:
        query = query.filter(
            func.lower(models.ResidentProfile.barangay)
            .like(f"%{barangay.lower()}%")
        )
    return query


# =====================================================
# HELPER: SECTOR FILTER
# =====================================================

def apply_sector_filter(query, sector: str):
    if not sector:
        return query

    return query.join(models.ResidentProfile.sectors).filter(
        func.lower(models.Sector.name) == sector.strip().lower()
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
# GET RESIDENT LIST
# =====================================================

def get_residents(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    search: str = None,
    barangay: str = None,
    sector: str = None
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

    return (
        query.order_by(models.ResidentProfile.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# =====================================================
# DASHBOARD STATS (POSTGRES SAFE)
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

    return {
        "total_residents": total_residents,
        "total_households": total_households,
        "total_male": total_male,
        "total_female": total_female,
        "population_by_barangay": stats_barangay,
        "population_by_sector": {}
    }
