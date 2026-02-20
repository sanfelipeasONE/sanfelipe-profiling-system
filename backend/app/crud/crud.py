from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from app import models, schemas
from datetime import datetime
from app.core.audit import log_action
from sqlalchemy.exc import IntegrityError



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

    # 🔥 Normalize identity fields
    for field in ["first_name", "middle_name", "last_name"]:
        if field in filtered_data and filtered_data[field]:
            filtered_data[field] = filtered_data[field].strip().upper()
        else:
            filtered_data[field] = ""

    # 🔥 Ensure birthdate exists
    if not filtered_data.get("birthdate"):
        raise ValueError("Birthdate is required.")

    # 🔎 Duplicate check (Full name + birthdate)
    existing = db.query(models.ResidentProfile).filter(
        func.upper(func.coalesce(models.ResidentProfile.first_name, "")) == filtered_data["first_name"],
        func.upper(func.coalesce(models.ResidentProfile.middle_name, "")) == filtered_data["middle_name"],
        func.upper(func.coalesce(models.ResidentProfile.last_name, "")) == filtered_data["last_name"],
        models.ResidentProfile.birthdate == filtered_data["birthdate"],
        models.ResidentProfile.is_deleted == False
    ).first()

    if existing:
        raise ValueError("Resident already registered.")

    # ✅ Only create if no duplicate
    db_resident = models.ResidentProfile(**filtered_data)
    db.add(db_resident)

    try:
        db.commit()
        db.refresh(db_resident)

        # 🔥 Generate resident_code based on ID
        db_resident.resident_code = f"SF-{db_resident.id:06d}"
        
        db.commit()
        db.refresh(db_resident)

    except IntegrityError:
        db.rollback()
        raise ValueError("Resident already registered.")

    # Attach sectors
    if sector_ids:
        sectors = db.query(models.Sector).filter(
            models.Sector.id.in_(sector_ids)
        ).all()

        db_resident.sectors = sectors
        sector_names = [s.name for s in sectors]
        db_resident.sector_summary = ", ".join(sector_names)
    else:
        db_resident.sector_summary = "None"

    # Add family members
    for member_data in family_members_data:
        db_member = models.FamilyMember(
            **member_data,
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

    # ------------------------------
    # 1️⃣ Update basic fields
    # ------------------------------
    update_data = resident_data.model_dump(
        exclude={"sector_ids", "family_members"}
    )

    for key, value in update_data.items():
        setattr(db_resident, key, value)

    # ------------------------------
    # 2️⃣ Normalize identity fields
    # ------------------------------
    for field in ["first_name", "middle_name", "last_name"]:
        value = getattr(db_resident, field)
        if value:
            setattr(db_resident, field, value.strip().upper())
        else:
            setattr(db_resident, field, "")

    # ------------------------------
    # 3️⃣ Ensure birthdate exists
    # ------------------------------
    if not db_resident.birthdate:
        raise ValueError("Birthdate is required.")

    # ------------------------------
    # 4️⃣ Check duplicate (exclude self)
    # ------------------------------
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

    # ------------------------------
    # 5️⃣ Update sectors
    # ------------------------------
    db_resident.sectors.clear()

    if resident_data.sector_ids:
        new_sectors = db.query(models.Sector).filter(
            models.Sector.id.in_(resident_data.sector_ids)
        ).all()

        db_resident.sectors = new_sectors
        sector_names = [s.name for s in new_sectors]
        db_resident.sector_summary = ", ".join(sector_names)
    else:
        db_resident.sector_summary = "None"

    # ------------------------------
    # 6️⃣ Update family members
    # ------------------------------
    db.query(models.FamilyMember).filter(
        models.FamilyMember.profile_id == resident_id
    ).delete(synchronize_session=False)

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
# PROMOTOE FAMILY MEMBER TO HEAD
# =====================================================
def promote_family_member_to_head(db: Session, resident_id: int, new_head_member_id: int, reason: str):
    
    current_head = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not current_head:
        return None

    # 1️⃣ Mark old head
    current_head.status = reason  # "Deceased" or "OFW"
    current_head.is_deleted = True
    current_head.is_family_head = False

    # 2️⃣ Get family member
    member = db.query(models.FamilyMember).filter(
        models.FamilyMember.id == new_head_member_id
    ).first()

    if not member:
        return None

    # 3️⃣ Convert member to new ResidentProfile
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

    # 4️⃣ Remove family member entry
    db.delete(member)

    db.commit()
    db.refresh(new_head)

    return new_head

# =====================================================
# DELETE RESIDENT
# =====================================================
def delete_resident(db: Session, resident_id: int):
    db_resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not db_resident:
        return None

    db_resident.is_deleted = True
    db_resident.deleted_at = datetime.utcnow()

    db.commit()
    db.refresh(db_resident)

    return db_resident

def soft_delete_resident(db: Session, resident_id: int):
    print("DATABASE URL:", db.bind.url)

    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not resident:
        return None

    resident.is_deleted = True
    db.commit()

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

    log_action(
        db,
        user_id,
        "Deleted assistance",
        "assistance",
        resident_id
    )

    db.commit()
    db.refresh(resident)

    return resident

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
# PERMANENT DELETE RESIDENTS
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
# COUNT RESIDENTS
# =====================================================
def get_resident_count(
    db: Session,
    search: str = None,
    barangay: str = None,
    sector: str = None
):
    query = db.query(models.ResidentProfile)
    
    query = query.filter(models.ResidentProfile.is_deleted == False)


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
        joinedload(models.ResidentProfile.sectors),
        joinedload(models.ResidentProfile.assistances)
    )
    
    query = query.filter(models.ResidentProfile.is_deleted == False)


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

    # 🔥 Base query: ONLY active residents
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
    ).filter(
        models.ResidentProfile.is_deleted == False
    ).scalar() or 0

    total_male = base_query.filter(
        func.lower(models.ResidentProfile.sex).in_(["male", "m"])
    ).count() or 0

    total_female = base_query.filter(
        func.lower(models.ResidentProfile.sex).in_(["female", "f"])
    ).count() or 0

    # ------------------------------
    # POPULATION BY BARANGAY
    # ------------------------------
    barangay_counts = db.query(
        func.upper(func.trim(models.ResidentProfile.barangay)).label("barangay"),
        func.count(models.ResidentProfile.id)
    ).filter(
        models.ResidentProfile.is_deleted == False
    ).group_by(
        func.upper(func.trim(models.ResidentProfile.barangay))
    ).all()

    stats_barangay = {b: count for b, count in barangay_counts if b}

    # ------------------------------
    # POPULATION BY SECTOR
    # ------------------------------
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

# ----------------------
# ADD ASSISTANCE
# ----------------------

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

    update_data = data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
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


    # ------------------------------
    # TOTAL RESIDENTS
    # ------------------------------
    total_residents = base_query.count() or 0

    # ------------------------------
    # TOTAL HOUSEHOLDS
    # ------------------------------
    total_households = db.query(
        func.count(
            func.distinct(
                func.trim(models.ResidentProfile.barangay) +
                "-" +
                func.coalesce(func.trim(models.ResidentProfile.house_no), "")
            )
        )
    ).filter(
        models.ResidentProfile.is_deleted == False
    ).scalar() or 0

    # ------------------------------
    # TOTAL MALE
    # ------------------------------
    total_male = db.query(
        func.count(models.ResidentProfile.id)
    ).filter(
        models.ResidentProfile.is_deleted == False,
        func.lower(models.ResidentProfile.sex).in_(["male", "m"])
    ).scalar() or 0

    # ------------------------------
    # TOTAL FEMALE
    # ------------------------------
    total_female = db.query(
        func.count(models.ResidentProfile.id)
    ).filter(
        models.ResidentProfile.is_deleted == False,
        func.lower(models.ResidentProfile.sex).in_(["female", "f"])
    ).scalar() or 0

    # ------------------------------
    # POPULATION BY BARANGAY
    # ------------------------------
    barangay_counts = db.query(
        func.upper(func.trim(models.ResidentProfile.barangay)).label("barangay"),
        func.count(models.ResidentProfile.id)
    ).filter(
        models.ResidentProfile.is_deleted == False,
        models.ResidentProfile.barangay.isnot(None)
    ).group_by(
        func.upper(func.trim(models.ResidentProfile.barangay))
    ).all()

    stats_barangay = {b: count for b, count in barangay_counts if b}

    # ------------------------------
    # POPULATION BY SECTOR
    # ------------------------------
    sector_counts = db.query(
        models.ResidentProfile.sector_summary,
        func.count(models.ResidentProfile.id)
    ).filter(
        models.ResidentProfile.is_deleted == False,
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