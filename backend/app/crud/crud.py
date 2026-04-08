from unicodedata import name

from sqlalchemy.orm import Session, joinedload, subqueryload
from sqlalchemy import or_, func, case
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

        query = query.filter(
            or_(
                models.ResidentProfile.last_name.ilike(word_fmt),
                models.ResidentProfile.first_name.ilike(word_fmt),
                models.ResidentProfile.resident_code.ilike(word_fmt),
                # Combined so "ALFEROS ERNESTO" can match across fields
                func.concat(
                    func.coalesce(models.ResidentProfile.last_name, ""), " ",
                    func.coalesce(models.ResidentProfile.first_name, "")
                ).ilike(word_fmt),
                func.concat(
                    func.coalesce(models.ResidentProfile.first_name, ""), " ",
                    func.coalesce(models.ResidentProfile.last_name, "")
                ).ilike(word_fmt),
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

    normalized = normalize_sector_name(sector)

    if normalized == "OTHERS":
        return query.filter(
            or_(
                func.upper(func.coalesce(models.ResidentProfile.sector_summary, "")).like("%OTHERS%"),
                func.coalesce(models.ResidentProfile.other_sector_details, "") != ""
            )
        )

    sector_variants = {
        "FARMERS": ["FARMERS", "FARMER"],
        "LGU EMPLOYEE": ["LGU EMPLOYEE", "GOV EMPLOYEE"],
        "BRGY. BNS/BHW": ["BRGY. BNS/BHW", "BRGY BNS/BHW"],
        "BRGY. OFFICIAL/EMPLOYEE": [
            "BRGY. OFFICIAL/EMPLOYEE",
            "BRGY OFFICIAL",
            "BRGY OFFICIAL/EMPLOYEE"
        ],
    }

    variants = [normalize_sector_name(v) for v in sector_variants.get(normalized, [normalized])]

    sector_table_match = models.ResidentProfile.sectors.any(
        func.upper(func.trim(models.Sector.name)).in_(variants)
    )

    normalized_summary = func.concat(
        ",",
        func.regexp_replace(
            func.upper(func.coalesce(models.ResidentProfile.sector_summary, "")),
            r"\s*,\s*",
            ",",
            "g"
        ),
        ","
    )

    summary_match = or_(*[
        normalized_summary.like(f"%,{variant},%")
        for variant in variants
    ])

    return query.filter(
        or_(
            sector_table_match,
            summary_match
        )
    )
    
def normalize_sector_name(name: str) -> str:
    normalized = " ".join((name or "").strip().upper().split())

    sector_aliases = {
        "FARMER": "FARMERS",
        "FARMERS": "FARMERS",
        "GOV EMPLOYEE": "LGU EMPLOYEE",
        "LGU EMPLOYEE": "LGU EMPLOYEE",
        "BRGY BNS/BHW": "BRGY. BNS/BHW",
        "BRGY. BNS/BHW": "BRGY. BNS/BHW",
        "BRGY OFFICIAL": "BRGY. OFFICIAL/EMPLOYEE",
        "BRGY OFFICIAL/EMPLOYEE": "BRGY. OFFICIAL/EMPLOYEE",
        "BRGY. OFFICIAL/EMPLOYEE": "BRGY. OFFICIAL/EMPLOYEE",
    }

    return sector_aliases.get(normalized, normalized)

def normalize_barangay_name_expr():
    raw = func.upper(func.trim(func.coalesce(models.ResidentProfile.barangay, "")))

    return case(
        (raw.in_(["STO NIÑO", "STO. NIÑO", "SANTO NIÑO", "SANTO NINO", "STO NINO"]), "STO NIÑO"),
        (raw.in_(["SAN RAFAEL", "SANRAFAEL"]), "SAN RAFAEL"),
        else_=raw
    )


def apply_allowed_sector_filter(query, allowed_sector_names: list[str] | None = None):
    if not allowed_sector_names:
        return query

    normalized_allowed = [normalize_sector_name(name) for name in allowed_sector_names]

    sector_table_match = models.ResidentProfile.sectors.any(
        func.upper(func.trim(models.Sector.name)).in_(normalized_allowed)
    )

    normalized_summary = func.concat(
        ",",
        func.regexp_replace(
            func.upper(func.coalesce(models.ResidentProfile.sector_summary, "")),
            r"\s*,\s*",
            ",",
            "g"
        ),
        ","
    )

    summary_match = or_(*[
        normalized_summary.like(f"%,{name},%")
        for name in normalized_allowed
    ])

    return query.filter(
        or_(
            sector_table_match,
            summary_match
        )
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
            db_resident.sector_summary = ", ".join([" ".join(s.name.strip().upper().split()) for s in sectors])
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

    raw_data = resident_data.model_dump(exclude_unset=True)

    update_data = resident_data.model_dump(
        exclude_unset=True,
        exclude={"sector_ids", "family_members", "resident_code", "barangay_id"}
    )

    for key, value in update_data.items():
        setattr(db_resident, key, value)

    for field in ["first_name", "middle_name", "last_name"]:
        value = getattr(db_resident, field)
        if value is not None:
            setattr(db_resident, field, value.strip().upper())

    if not db_resident.birthdate:
        raise ValueError("Birthdate is required.")

    existing = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id != resident_id,
        func.upper(func.coalesce(models.ResidentProfile.first_name, "")) == db_resident.first_name,
        func.upper(func.coalesce(models.ResidentProfile.middle_name, "")) == db_resident.middle_name,
        func.upper(func.coalesce(models.ResidentProfile.last_name, "")) == db_resident.last_name,
        models.ResidentProfile.birthdate == db_resident.birthdate,
        models.ResidentProfile.barangay == db_resident.barangay,
        models.ResidentProfile.is_deleted == False
    ).first()

    if existing:
        db.rollback()
        raise ValueError("Resident already registered.")

    if "sector_ids" in raw_data:
        new_sector_ids = list(set(resident_data.sector_ids or []))

        db.execute(
            models.resident_sectors.delete().where(
                models.resident_sectors.c.resident_id == resident_id
            )
        )

        if new_sector_ids:
            new_sectors = db.query(models.Sector).filter(
                models.Sector.id.in_(new_sector_ids)
            ).all()

            db_resident.sectors = new_sectors
            db_resident.sector_summary = ", ".join(
                [" ".join(s.name.strip().upper().split()) for s in new_sectors]
            )
        else:
            db_resident.sector_summary = "None"

    if "family_members" in raw_data:
        db.query(models.FamilyMember).filter(
            models.FamilyMember.profile_id == resident_id
        ).delete(synchronize_session=False)

        for fm_data in (resident_data.family_members or []):
            db.add(models.FamilyMember(**fm_data.model_dump(), profile_id=resident_id))

    try:
        db.commit()
        db.refresh(db_resident)
        return db_resident
    except IntegrityError as e:
        db.rollback()
        print("UPDATE RESIDENT INTEGRITY ERROR:", str(e))
        raise ValueError("Database constraint error while updating resident.")
    except Exception as e:
        db.rollback()
        print("UPDATE RESIDENT ERROR:", repr(e))
        raise


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
def get_resident(
    db: Session,
    resident_id: int,
    allowed_sector_names: list[str] | None = None
):
    query = (
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
    )

    query = apply_allowed_sector_filter(query, allowed_sector_names)

    return query.first()


# =====================================================
# COUNT RESIDENTS
# =====================================================
def get_resident_count(
    db: Session,
    search: str = None,
    barangay: str = None,
    sector: str = None,
    allowed_sector_names: list[str] | None = None
):
    query = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.is_deleted == False
    )

    query = apply_search_filter(query, search)
    query = apply_barangay_filter(query, barangay)
    query = apply_sector_filter(query, sector)
    query = apply_allowed_sector_filter(query, allowed_sector_names)

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
    sort_order: str = "asc",
    allowed_sector_names: list[str] | None = None
):
    query = db.query(models.ResidentProfile).options(
        subqueryload(models.ResidentProfile.family_members),
        subqueryload(models.ResidentProfile.sectors),
        subqueryload(models.ResidentProfile.assistances)
    ).filter(models.ResidentProfile.is_deleted == False)

    query = apply_search_filter(query, search)
    query = apply_barangay_filter(query, barangay)
    query = apply_sector_filter(query, sector)
    query = apply_allowed_sector_filter(query, allowed_sector_names)

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
def get_dashboard_stats(
    db: Session,
    allowed_sector_names: list[str] | None = None
):
    base_query = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.is_deleted == False
    )

    base_query = apply_allowed_sector_filter(base_query, allowed_sector_names)

    total_residents = base_query.count() or 0

    household_query = db.query(
        func.count(
            func.distinct(
                func.trim(models.ResidentProfile.barangay) +
                "-" +
                func.coalesce(func.trim(models.ResidentProfile.house_no), "")
            )
        )
    ).filter(
        models.ResidentProfile.is_deleted == False
    )

    household_query = apply_allowed_sector_filter(household_query, allowed_sector_names)
    total_households = household_query.scalar() or 0

    total_male = base_query.filter(
        func.lower(models.ResidentProfile.sex).in_(["male", "m"])
    ).count() or 0

    total_female = base_query.filter(
        func.lower(models.ResidentProfile.sex).in_(["female", "f"])
    ).count() or 0

    barangay_query = db.query(
        func.upper(func.trim(models.ResidentProfile.barangay)).label("barangay"),
        func.count(models.ResidentProfile.id)
    ).filter(
        models.ResidentProfile.is_deleted == False
    )

    barangay_query = apply_allowed_sector_filter(barangay_query, allowed_sector_names)

    normalized_barangay = normalize_barangay_name_expr()

    barangay_counts = db.query(
        normalized_barangay.label("barangay"),
        func.count(models.ResidentProfile.id)
    ).filter(
        models.ResidentProfile.is_deleted == False
    ).group_by(
        normalized_barangay
    ).all()

    stats_barangay = {b: count for b, count in barangay_counts if b}

    sector_query = db.query(
        models.ResidentProfile.sector_summary,
        func.count(models.ResidentProfile.id)
    ).filter(
        models.ResidentProfile.is_deleted == False
    )

    sector_query = apply_allowed_sector_filter(sector_query, allowed_sector_names)

    sector_counts = sector_query.group_by(
        models.ResidentProfile.sector_summary
    ).all()

    stats_sector = {}

    for summary, count in sector_counts:
        if not summary or summary.strip().lower() == "none":
            continue

        parts = [p.strip() for p in summary.split(",") if p.strip()]
        for p in parts:
            key = normalize_sector_name(p)
            stats_sector[key] = stats_sector.get(key, 0) + count

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