from sqlalchemy.orm import Session, joinedload, subqueryload
from sqlalchemy import or_, func
from app import models, schemas
from datetime import datetime
from app.core.audit import log_action
from sqlalchemy.exc import IntegrityError
import re


# =====================================================
# SEARCH HELPER
# =====================================================
def apply_search_filter(query, search: str):
    if not search:
        return query

    cleaned = re.sub(r"[^\w\s]", " ", search.strip().upper())
    words = cleaned.split()

    for word in words:
        word_fmt = f"%{word}%"
        full_name = func.concat(
            func.coalesce(models.ResidentProfile.first_name, ""), " ",
            func.coalesce(models.ResidentProfile.middle_name, ""), " ",
            func.coalesce(models.ResidentProfile.last_name, "")
        )
        query = query.filter(
            or_(
                models.ResidentProfile.first_name.ilike(word_fmt),
                models.ResidentProfile.middle_name.ilike(word_fmt),
                models.ResidentProfile.last_name.ilike(word_fmt),
                models.ResidentProfile.resident_code.ilike(word_fmt),
                full_name.ilike(word_fmt),
            )
        )

    return query


# =====================================================
# FILTER HELPERS
# =====================================================
def apply_barangay_filter(query, barangay: str):
    if barangay:
        query = query.filter(
            func.lower(models.ResidentProfile.barangay).like(f"%{barangay.lower()}%")
        )
    return query


def apply_sector_filter(query, sector: str):
    if not sector:
        return query

    normalized = sector.strip().lower()

    if normalized == "others":
        return query.filter(
            or_(
                func.lower(func.coalesce(models.ResidentProfile.sector_summary, "")).like("%others%"),
                func.coalesce(models.ResidentProfile.other_sector_details, "") != ""
            )
        )

    return query.filter(
        func.lower(func.coalesce(models.ResidentProfile.sector_summary, "")).like(f"%{normalized}%")
    )


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
    filtered_data.pop("resident_code", None)

    for field in ["first_name", "middle_name", "last_name"]:
        filtered_data[field] = filtered_data[field].strip().upper() if filtered_data.get(field) else ""

    if not filtered_data.get("birthdate"):
        raise ValueError("Birthdate is required.")

    existing = db.query(models.ResidentProfile).filter(
        func.upper(func.coalesce(models.ResidentProfile.first_name, "")) == filtered_data["first_name"],
        func.upper(func.coalesce(models.ResidentProfile.middle_name, "")) == filtered_data["middle_name"],
        func.upper(func.coalesce(models.ResidentProfile.last_name, "")) == filtered_data["last_name"],
        models.ResidentProfile.birthdate == filtered_data["birthdate"],
        models.ResidentProfile.is_deleted == False
    ).first()

    if existing:
        raise ValueError("Resident already registered.")

    try:
        db_resident = models.ResidentProfile(**filtered_data)
        db_resident.resident_code = "TEMP"
        db.add(db_resident)
        db.flush()

        db_resident.resident_code = f"SF-{db_resident.id:06d}"

        if sector_ids:
            sectors = db.query(models.Sector).filter(models.Sector.id.in_(sector_ids)).all()
            db_resident.sectors = sectors
            db_resident.sector_summary = ", ".join([s.name for s in sectors])
        else:
            db_resident.sector_summary = "None"

        valid_fm_columns = {c.name for c in models.FamilyMember.__table__.columns}
        for member_data in family_members_data:
            filtered_member = {k: v for k, v in member_data.items() if k in valid_fm_columns}
            db.add(models.FamilyMember(**filtered_member, profile_id=db_resident.id))

        db.commit()
        db.refresh(db_resident)
        return db_resident

    except IntegrityError as e:
        db.rollback()
        raise ValueError("Database constraint error.")


# =====================================================
# UPDATE RESIDENT
# =====================================================
def update_resident(db: Session, resident_id: int, resident_data: schemas.ResidentUpdate):
    db_resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not db_resident:
        return None

    update_data = resident_data.model_dump(exclude={"sector_ids", "family_members", "resident_code"})
    for key, value in update_data.items():
        setattr(db_resident, key, value)

    for field in ["first_name", "middle_name", "last_name"]:
        value = getattr(db_resident, field)
        setattr(db_resident, field, value.strip().upper() if value else "")

    if not db_resident.birthdate:
        raise ValueError("Birthdate is required.")

    existing = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id != resident_id,
        func.upper(func.coalesce(models.ResidentProfile.first_name, "")) == db_resident.first_name,
        func.upper(func.coalesce(models.ResidentProfile.middle_name, "")) == db_resident.middle_name,
        func.upper(func.coalesce(models.ResidentProfile.last_name, "")) == db_resident.last_name,
        models.ResidentProfile.birthdate == db_resident.birthdate,
        models.ResidentProfile.is_deleted == False
    ).first()

    if existing:
        db.rollback()
        raise ValueError("Resident already registered.")

    db_resident.sectors.clear()
    if resident_data.sector_ids:
        new_sectors = db.query(models.Sector).filter(models.Sector.id.in_(resident_data.sector_ids)).all()
        db_resident.sectors = new_sectors
        db_resident.sector_summary = ", ".join([s.name for s in new_sectors])
    else:
        db_resident.sector_summary = "None"

    db.query(models.FamilyMember).filter(
        models.FamilyMember.profile_id == resident_id
    ).delete(synchronize_session=False)

    if resident_data.family_members:
        for fm_data in resident_data.family_members:
            db.add(models.FamilyMember(**fm_data.model_dump(), profile_id=resident_id))

    db.commit()
    db.refresh(db_resident)
    return db_resident


# =====================================================
# PROMOTE FAMILY MEMBER TO HEAD
# =====================================================
def promote_family_member_to_head(db: Session, resident_id: int, new_head_member_id: int, reason: str):
    current_head = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not current_head:
        return None

    current_head.status = reason
    current_head.is_deleted = True
    current_head.is_family_head = False

    member = db.query(models.FamilyMember).filter(
        models.FamilyMember.id == new_head_member_id
    ).first()

    if not member:
        return None

    new_head = models.ResidentProfile(
        first_name=member.first_name,
        last_name=member.last_name,
        barangay=current_head.barangay,
        house_no=current_head.house_no,
        purok=current_head.purok,
        is_family_head=True,
        status="Active"
    )

    db.add(new_head)
    db.delete(member)
    db.commit()
    db.refresh(new_head)
    return new_head


# =====================================================
# SOFT DELETE RESIDENT
# =====================================================
def soft_delete_resident(db: Session, resident_id: int):
    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not resident:
        return None

    resident.is_deleted = True
    resident.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(resident)
    return resident


# =====================================================
# RESTORE RESIDENT
# =====================================================
def restore_resident(db: Session, resident_id: int):
    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not resident:
        return None

    resident.is_deleted = False
    resident.deleted_at = None
    db.commit()
    db.refresh(resident)
    return resident


# =====================================================
# ARCHIVE RESIDENT
# =====================================================
def archive_resident(db: Session, resident_id: int, user_id: int):
    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not resident:
        return None

    resident.is_deleted = True
    resident.is_archived = True

    log_action(db, user_id, "Archived resident", "resident", resident_id)

    db.commit()
    db.refresh(resident)
    return resident


# =====================================================
# PERMANENT DELETE RESIDENT
# =====================================================
def permanently_delete_resident(db: Session, resident_id: int):
    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not resident:
        return None

    db.delete(resident)
    db.commit()
    return True


# =====================================================
# GET SINGLE RESIDENT
# =====================================================
def get_resident(db: Session, resident_id: int):
    return (
        db.query(models.ResidentProfile)
        .options(
            joinedload(models.ResidentProfile.family_members),
            joinedload(models.ResidentProfile.sectors),
            joinedload(models.ResidentProfile.assistances)
        )
        .filter(
            models.ResidentProfile.id == resident_id,
            models.ResidentProfile.is_deleted == False
        )
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
    query = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.is_deleted == False
    )

    query = apply_search_filter(query, search)
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
    sector: str = None,
    sort_by: str = "last_name",
    sort_order: str = "asc"
):
    query = db.query(models.ResidentProfile).options(
        subqueryload(models.ResidentProfile.family_members),
        subqueryload(models.ResidentProfile.sectors),
        subqueryload(models.ResidentProfile.assistances)
    ).filter(models.ResidentProfile.is_deleted == False)

    query = apply_search_filter(query, search)
    query = apply_barangay_filter(query, barangay)
    query = apply_sector_filter(query, sector)

    if sort_order.lower() == "desc":
        query = query.order_by(
            func.upper(models.ResidentProfile.last_name).desc(),
            func.upper(models.ResidentProfile.first_name).desc()
        )
    else:
        query = query.order_by(
            func.upper(models.ResidentProfile.last_name).asc(),
            func.upper(models.ResidentProfile.first_name).asc()
        )

    return query.offset(skip).limit(limit).all()


# =====================================================
# DASHBOARD STATS
# =====================================================
def get_dashboard_stats(db: Session):
    base_query = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.is_deleted == False
    )

    total_residents = base_query.count() or 0

    total_households = db.query(
        func.count(
            func.distinct(
                func.trim(models.ResidentProfile.barangay) +
                "-" +
                func.coalesce(func.trim(models.ResidentProfile.house_no), "")
            )
        )
    ).filter(models.ResidentProfile.is_deleted == False).scalar() or 0

    total_male = base_query.filter(
        func.lower(models.ResidentProfile.sex).in_(["male", "m"])
    ).count() or 0

    total_female = base_query.filter(
        func.lower(models.ResidentProfile.sex).in_(["female", "f"])
    ).count() or 0

    barangay_counts = db.query(
        func.upper(func.trim(models.ResidentProfile.barangay)).label("barangay"),
        func.count(models.ResidentProfile.id)
    ).filter(
        models.ResidentProfile.is_deleted == False
    ).group_by(
        func.upper(func.trim(models.ResidentProfile.barangay))
    ).all()

    stats_barangay = {b: count for b, count in barangay_counts if b}

    sector_counts = db.query(
        models.ResidentProfile.sector_summary,
        func.count(models.ResidentProfile.id)
    ).filter(
        models.ResidentProfile.is_deleted == False
    ).group_by(
        models.ResidentProfile.sector_summary
    ).all()

    stats_sector = {}
    for sector_summary, count in sector_counts:
        if not sector_summary or sector_summary.lower() == "none":
            continue
        for s in [s.strip() for s in sector_summary.split(",")]:
            stats_sector[s] = stats_sector.get(s, 0) + count

    return {
        "total_residents": total_residents,
        "total_households": total_households,
        "total_male": total_male,
        "total_female": total_female,
        "population_by_barangay": stats_barangay,
        "population_by_sector": stats_sector
    }


# =====================================================
# ASSISTANCE
# =====================================================
def add_assistance(db: Session, resident_id: int, assistance: schemas.AssistanceCreate):
    new_assistance = models.ResidentAssistance(
        resident_id=resident_id,
        **assistance.model_dump()
    )
    db.add(new_assistance)
    db.commit()
    db.refresh(new_assistance)
    return new_assistance


def update_assistance(db: Session, assistance_id: int, data: schemas.AssistanceUpdate):
    assistance = db.query(models.ResidentAssistance).filter(
        models.ResidentAssistance.id == assistance_id
    ).first()

    if not assistance:
        return None

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(assistance, key, value)

    db.commit()
    db.refresh(assistance)
    return assistance


def delete_assistance(db: Session, assistance_id: int):
    assistance = db.query(models.ResidentAssistance).filter(
        models.ResidentAssistance.id == assistance_id
    ).first()

    if not assistance:
        return None

    db.delete(assistance)
    db.commit()
    return True