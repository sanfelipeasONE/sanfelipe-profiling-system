from unicodedata import name

from sqlalchemy.orm import Session, joinedload, subqueryload
from sqlalchemy import or_, func, case, and_
from app import models, schemas
from datetime import datetime
from app.core.audit import log_action
from sqlalchemy.exc import IntegrityError
import re
import time

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

    # This handles the generic "Show me everyone who checked 'Others'"
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

    # 1. Check the associated Sector table
    sector_table_match = models.ResidentProfile.sectors.any(
        func.upper(func.trim(models.Sector.name)).in_(variants)
    )

    # 2. Check the sector_summary column
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

    others_detail_match = or_(*[
        func.upper(func.coalesce(models.ResidentProfile.other_sector_details, "")).like(f"%{variant}%")
        for variant in variants
    ])

    # Return the query matching ANY of the three conditions
    return query.filter(
        or_(
            sector_table_match,
            summary_match,
            others_detail_match
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
        error_detail = str(e.orig) if hasattr(e, 'orig') else str(e)
        raise ValueError(f"Database constraint error: {error_detail}")


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

    # --- Break Unique Constraints Safely ---
    if resident.resident_code:
        resident.resident_code = f"{resident.resident_code[:10]}_ARC{resident.id}"
        
    if resident.contact_no:
        resident.contact_no = f"{resident.contact_no[:8]}_A{resident.id}"
        
    if resident.precinct_no:
        resident.precinct_no = f"{resident.precinct_no[:10]}_A{resident.id}"
        
    # --- NEW FIX: Break the Unique Name Constraint ---
    arc_tag = f"_ARC{resident.id}"
    if resident.last_name:
        resident.last_name = f"{resident.last_name[:30]}{arc_tag}"
    if resident.first_name:
        resident.first_name = f"{resident.first_name[:30]}{arc_tag}"
    # -----------------------------------------------

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
# Updated Residents Filter
# =====================================================
def apply_status_filter(query, filter_status: str):
    if not filter_status:
        return query

    status = filter_status.lower()

    if status == "updated":
        query = query.filter(
            models.ResidentProfile.updated_at != None,
            models.ResidentProfile.created_at != None,
            models.ResidentProfile.updated_at > models.ResidentProfile.created_at
        )
    elif status == "not_updated":
        query = query.filter(
            or_(
                models.ResidentProfile.updated_at == None,
                models.ResidentProfile.created_at == None,
                models.ResidentProfile.updated_at <= models.ResidentProfile.created_at
            )
        )
    return query


# =====================================================
# COUNT RESIDENTS
# =====================================================
def get_resident_count(
    db: Session,
    search: str = None,
    barangay: str = None,
    sector: str = None,
    filter_status: str = "all",
    allowed_sector_names: list[str] | None = None
):
    query = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.is_deleted == False
    )

    query = apply_search_filter(query, search)
    query = apply_barangay_filter(query, barangay)
    query = apply_sector_filter(query, sector)
    query = apply_status_filter(query, filter_status)
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
    filter_status: str = "all",
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
    query = apply_status_filter(query, filter_status)
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
    db_assistance = models.ResidentAssistance(
        **assistance.dict(), 
        resident_id=resident_id
    )
    db.add(db_assistance)
    db.commit()
    db.refresh(db_assistance)
    return db_assistance


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

# =====================================================
# FINANCIAL ASSISTANCE TRACKING & QR CLAIMING
# =====================================================
def get_assistance_tracking(
    db: Session, 
    sector_name: str, 
    type_of_assistance: str, 
    status_filter: str = "all"
):
    normalized_sector = normalize_sector_name(sector_name)
    
    # 1. Build the join condition dynamically using the bitwise '&' operator 
    join_condition = (models.ResidentProfile.id == models.ResidentAssistance.resident_id)
    
    if type_of_assistance and type_of_assistance.lower() != "all programs":
        join_condition = join_condition & (models.ResidentAssistance.type_of_assistance == type_of_assistance)
        
    # 2. Base query with OUTER JOIN
    query = db.query(models.ResidentProfile, models.ResidentAssistance).outerjoin(
        models.ResidentAssistance,
        join_condition
    ).filter(
        models.ResidentProfile.is_deleted == False,
        # FILTER: Only residents who have been updated (Profiled)
        models.ResidentProfile.updated_at != None,
        models.ResidentProfile.created_at != None,
        models.ResidentProfile.updated_at > models.ResidentProfile.created_at
    )
    
    # 3. ALPHABETICAL SORTING
    query = query.order_by(
        models.ResidentProfile.last_name.asc(),
        models.ResidentProfile.first_name.asc()
    )

    # 4. Apply Sector Filter
    query = apply_sector_filter(query, normalized_sector)
    
    # 5. Apply Status Filter
    if status_filter.lower() == "claimed":
        query = query.filter(models.ResidentAssistance.date_claimed != None)
    elif status_filter.lower() == "unclaimed":
        # Includes those with an unclaimed record OR those with no record at all
        query = query.filter(
            or_(
                models.ResidentAssistance.id == None,
                models.ResidentAssistance.date_claimed == None
            )
        )
        
    records = query.all()
    
    results = []
    for resident, claim in records:
        if claim:
            status = "Claimed" if claim.date_claimed else "Unclaimed"
            prog_type = claim.type_of_assistance
            date_claimed = claim.date_claimed
        else:
            status = "No Record"
            prog_type = type_of_assistance if type_of_assistance and type_of_assistance.lower() != "all programs" else "None"
            date_claimed = None
            
        results.append({
            "resident_id": resident.id,
            "resident_code": resident.resident_code,
            "full_name": f"{resident.last_name}, {resident.first_name} {resident.middle_name or ''}".strip(),
            "barangay": resident.barangay,
            "sector_summary": resident.sector_summary,
            "status": status,
            "date_claimed": date_claimed,
            "type_of_assistance": prog_type,
            "photo_url": resident.photo_url
        })
        
    return results

def process_qr_claim(db: Session, request: schemas.QRClaimRequest):
    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.resident_code == request.resident_code,
        models.ResidentProfile.is_deleted == False
    ).first()

    if not resident:
        raise ValueError("Invalid QR: Resident not found")

    existing_claim = db.query(models.ResidentAssistance).filter(
        models.ResidentAssistance.resident_id == resident.id,
        models.ResidentAssistance.type_of_assistance == request.type_of_assistance
    ).first()

    if not existing_claim:
        raise ValueError(f"{resident.first_name} {resident.last_name} has no record for this assistance.")

    if existing_claim.date_claimed:
        raise ValueError(f"Assistance already claimed by {resident.first_name} {resident.last_name}.")

    existing_claim.date_claimed = datetime.utcnow().date()
    existing_claim.amount = request.amount
    if request.implementing_office:
        existing_claim.implementing_office = request.implementing_office

    db.commit()
    return {
        "message": "Claimed successfully", 
        "resident": f"{resident.first_name} {resident.last_name}"
    }  
    
# SENIOR CITIZEN CRUD

def get_senior_by_control_no(db: Session, control_no: str):
    return db.query(models.SeniorCitizen).filter(
        models.SeniorCitizen.osca_control_no == control_no
    ).first()

def create_senior_citizen(db: Session, senior: schemas.SeniorCitizenCreate):
    # Auto-capitalize text fields for clean data entry
    db_senior = models.SeniorCitizen(
        osca_control_no=senior.osca_control_no,
        last_name=senior.last_name.strip().upper(),
        first_name=senior.first_name.strip().upper(),
        middle_name=senior.middle_name.strip().upper() if senior.middle_name else "",
        ext_name=senior.ext_name.strip().upper() if senior.ext_name else "",
        sex=senior.sex.strip().upper(),
        birthdate=senior.birthdate,
        date_issued=senior.date_issued,
        house_no=senior.house_no,
        purok=senior.purok.strip().upper(),
        barangay=senior.barangay.strip().upper(),
        civil_status=senior.civil_status,
        educational_attainment=senior.educational_attainment,
    )
    
    db.add(db_senior)
    db.commit()
    db.refresh(db_senior)
    return db_senior

def get_senior_citizens(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.SeniorCitizen).order_by(
        models.SeniorCitizen.last_name.asc(),
        models.SeniorCitizen.first_name.asc()
    ).offset(skip).limit(limit).all()
    
def apply_senior_search_filter(query, search: str):
    if not search:
        return query
    cleaned = search.strip().upper()
    word_fmt = f"%{cleaned}%"
    
    return query.filter(
        or_(
            models.SeniorCitizen.last_name.ilike(word_fmt),
            models.SeniorCitizen.first_name.ilike(word_fmt),
            models.SeniorCitizen.osca_control_no.ilike(word_fmt),
            func.concat(
                func.coalesce(models.SeniorCitizen.last_name, ""), " ",
                func.coalesce(models.SeniorCitizen.first_name, "")
            ).ilike(word_fmt),
        )
    )

def get_senior_by_control_no(db: Session, control_no: str):
    return db.query(models.SeniorCitizen).filter(
        models.SeniorCitizen.osca_control_no == control_no
    ).first()

def get_senior_count(db: Session, search: str = None, barangay: str = None):
    query = db.query(models.SeniorCitizen).filter(models.SeniorCitizen.is_active == True)
    query = apply_senior_search_filter(query, search)
    if barangay:
        query = query.filter(func.upper(models.SeniorCitizen.barangay) == barangay.upper())
    return query.count()

def get_senior_citizens(db: Session, skip: int = 0, limit: int = 20, search: str = None, barangay: str = None):
    query = db.query(models.SeniorCitizen).filter(models.SeniorCitizen.is_active == True)
    query = apply_senior_search_filter(query, search)
    if barangay:
        query = query.filter(func.upper(models.SeniorCitizen.barangay) == barangay.upper())
        
    return query.order_by(
        models.SeniorCitizen.last_name.asc(),
        models.SeniorCitizen.first_name.asc()
    ).offset(skip).limit(limit).all()
    
def get_osca_dashboard_stats(db: Session):
    # Total seniors
    total_seniors = db.query(models.SeniorCitizen).filter(models.SeniorCitizen.is_active == True).count()
    
    # Get counts grouped by barangay and sex
    stats_query = db.query(
        func.upper(func.trim(models.SeniorCitizen.barangay)).label("barangay"),
        models.SeniorCitizen.sex,
        func.count(models.SeniorCitizen.id).label("count")
    ).filter(
        models.SeniorCitizen.is_active == True
    ).group_by(
        func.upper(func.trim(models.SeniorCitizen.barangay)),
        models.SeniorCitizen.sex
    ).all()

    # Format data into a dictionary for the frontend table
    # Example format: { "FARAÑAL": { "Male": 10, "Female": 15, "Total": 25 } }
    barangay_stats = {}
    for barangay, sex, count in stats_query:
        if not barangay:
            continue
            
        if barangay not in barangay_stats:
            barangay_stats[barangay] = {"Male": 0, "Female": 0, "Total": 0}
            
        # Normalize sex to Male/Female keys
        sex_key = "Male" if sex and sex.upper() in ["M", "MALE"] else "Female"
        
        barangay_stats[barangay][sex_key] += count
        barangay_stats[barangay]["Total"] += count

    return {
        "total_seniors": total_seniors,
        "barangay_data": barangay_stats
    }

def update_senior_citizen(db: Session, senior_id: int, senior_data: schemas.SeniorCitizenCreate):
    db_senior = db.query(models.SeniorCitizen).filter(models.SeniorCitizen.id == senior_id).first()
    if not db_senior:
        return None
    
    db_senior.osca_control_no = senior_data.osca_control_no
    db_senior.last_name = senior_data.last_name.strip().upper()
    db_senior.first_name = senior_data.first_name.strip().upper()
    db_senior.middle_name = senior_data.middle_name.strip().upper() if senior_data.middle_name else ""
    db_senior.ext_name = senior_data.ext_name.strip().upper() if senior_data.ext_name else ""
    db_senior.sex = senior_data.sex
    db_senior.birthdate = senior_data.birthdate
    db_senior.date_issued = senior_data.date_issued
    db_senior.house_no = senior_data.house_no
    db_senior.purok = senior_data.purok.strip().upper()
    db_senior.barangay = senior_data.barangay.strip().upper()
    
    # NEW FIELDS ADDED HERE
    db_senior.civil_status = senior_data.civil_status
    db_senior.educational_attainment = senior_data.educational_attainment
    
    db.commit()
    db.refresh(db_senior)
    return db_senior

def archive_senior(db: Session, senior_id: int):
    senior = db.query(models.SeniorCitizen).filter(models.SeniorCitizen.id == senior_id).first()
    if not senior:
        return None
        
    senior.is_active = False # Hides them from the main list
    
    # Break the unique constraint safely so the number can be reused if needed
    if senior.osca_control_no:
        senior.osca_control_no = f"{senior.osca_control_no}_ARC{senior.id}"
        
    db.commit()
    db.refresh(senior)
    return senior

def permanently_delete_senior(db: Session, senior_id: int):
    senior = db.query(models.SeniorCitizen).filter(models.SeniorCitizen.id == senior_id).first()
    if not senior:
        return None
        
    db.delete(senior)
    db.commit()
    return True

def get_archived_senior_count(db: Session, search: str = None, barangay: str = None):
    query = db.query(models.SeniorCitizen).filter(models.SeniorCitizen.is_active == False)
    query = apply_senior_search_filter(query, search)
    if barangay:
        query = query.filter(func.upper(models.SeniorCitizen.barangay) == barangay.upper())
    return query.count()

def get_archived_seniors(db: Session, skip: int = 0, limit: int = 20, search: str = None, barangay: str = None):
    query = db.query(models.SeniorCitizen).filter(models.SeniorCitizen.is_active == False)
    query = apply_senior_search_filter(query, search)
    if barangay:
        query = query.filter(func.upper(models.SeniorCitizen.barangay) == barangay.upper())
        
    return query.order_by(
        models.SeniorCitizen.last_name.asc(),
        models.SeniorCitizen.first_name.asc()
    ).offset(skip).limit(limit).all()

def restore_senior(db: Session, senior_id: int):
    senior = db.query(models.SeniorCitizen).filter(models.SeniorCitizen.id == senior_id).first()
    if not senior:
        return None
    senior.is_active = True
    # Strip the "_ARC" tag we added when archiving to fix their control number
    if senior.osca_control_no and "_ARC" in senior.osca_control_no:
        senior.osca_control_no = senior.osca_control_no.split("_ARC")[0]
    db.commit()
    db.refresh(senior)
    return senior

