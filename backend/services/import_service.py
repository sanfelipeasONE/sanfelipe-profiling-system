import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models import ResidentProfile, FamilyMember
from datetime import datetime


# ===============================
# CLEAN STRING
# ===============================
def clean_str(val):
    if val is None:
        return ""
    text = str(val).strip()
    if text.lower() in ["nan", "none", "null", "-", "na", "n/a"]:
        return ""
    return text


# ===============================
# PARSE DATE (ROBUST)
# ===============================
def parse_date(date_val):
    if date_val is None:
        return None

    if pd.isna(date_val):
        return None

    if isinstance(date_val, pd.Timestamp):
        return date_val.date()

    if isinstance(date_val, (int, float)):
        try:
            return pd.to_datetime(date_val, origin="1899-12-30", unit="D").date()
        except:
            return None

    text_val = clean_str(date_val)
    if text_val == "":
        return None

    try:
        return pd.to_datetime(text_val).date()
    except:
        return None


# ===============================
# CHECK IF RESIDENT EXISTS
# ===============================
def resident_exists(db: Session, last_name, first_name, middle_name, barangay):
    return db.query(ResidentProfile).filter(
        and_(
            ResidentProfile.last_name == last_name,
            ResidentProfile.first_name == first_name,
            ResidentProfile.middle_name == middle_name,
            ResidentProfile.barangay == barangay
        )
    ).first()


# ===============================
# CHECK IF FAMILY MEMBER EXISTS
# ===============================
def family_member_exists(db: Session, profile_id, lname, fname, rel):
    return db.query(FamilyMember).filter(
        and_(
            FamilyMember.profile_id == profile_id,
            FamilyMember.last_name == lname,
            FamilyMember.first_name == fname,
            FamilyMember.relationship == rel
        )
    ).first()


# ===============================
# MAIN IMPORT FUNCTION
# ===============================
def process_excel_import(file_content, db: Session):

    df = pd.read_excel(file_content, dtype=object, engine="openpyxl")
    df = df.replace({pd.NaT: None})
    df = df.where(pd.notnull(df), None)

    success_count = 0
    skipped_duplicates = 0
    errors = []

    sector_columns = [
        "FISHERFOLK",
        "FISHERMAN/BANCA OWNER",
        "TODA",
        "BRGY BNS/BHW",
        "BRGY TANOD",
        "BRGY OFFICIAL",
        "LGU EMPLOYEE",
        "INDIGENOUS PEOPLE",
        "PWD",
        "OFW",
        "STUDENT",
        "SENIOR CITIZEN",
        "LIFEGUARD",
        "SOLO PARENT"
    ]

    relationship_keywords = {
        "SON", "DAUGHTER", "FATHER", "MOTHER",
        "NIECE", "NEPHEW", "BROTHER", "SISTER",
        "GRANDSON", "GRANDDAUGHTER", "GRANDFATHER", "GRANDMOTHER",
        "UNCLE", "AUNT", "COUSIN", "HUSBAND", "WIFE", "PARTNER"
    }

    for index, row in df.iterrows():
        try:
            last_name = clean_str(row.get("LAST NAME.1"))
            first_name = clean_str(row.get("FIRST NAME"))
            middle_name = clean_str(row.get("MIDDLE NAME"))
            barangay = clean_str(row.get("BARANGAY"))

            if last_name == "" and first_name == "":
                continue

            # 🔒 DUPLICATE CHECK
            existing_resident = resident_exists(
                db,
                last_name,
                first_name,
                middle_name,
                barangay
            )

            if existing_resident:
                skipped_duplicates += 1
                continue

            birthdate = parse_date(row.get("BIRTHDATE"))

            # -------- SECTORS --------
            active_sectors = []
            for col in sector_columns:
                if clean_str(row.get(col)) == "\\":
                    active_sectors.append(col)

            sector_summary = ", ".join(active_sectors) if active_sectors else "None"

            # -------- SPOUSE --------
            spouse_last = clean_str(row.get("LAST NAME.2"))
            spouse_first = clean_str(row.get("FIRST NAME.1"))
            spouse_middle = clean_str(row.get("MIDDLE NAME.1"))

            if spouse_last == "" and spouse_first == "":
                spouse_full = clean_str(row.get("SPOUSE/PARTNER"))
                if spouse_full:
                    parts = spouse_full.split()
                    if len(parts) >= 2:
                        spouse_first = parts[0]
                        spouse_last = parts[-1]
                        if len(parts) > 2:
                            spouse_middle = " ".join(parts[1:-1])

            # -------- CREATE RESIDENT --------
            resident = ResidentProfile(
                last_name=last_name,
                first_name=first_name,
                middle_name=middle_name,
                ext_name=clean_str(row.get("EXT NAME")),
                house_no=clean_str(row.get("HOUSE NO. / STREET")),
                purok=clean_str(row.get("PUROK")),
                barangay=barangay,
                birthdate=birthdate,
                sex=clean_str(row.get("SEX")),
                civil_status=clean_str(row.get("CIVIL STATUS")),
                religion=clean_str(row.get("RELIGION")),
                occupation=clean_str(row.get("OCCUPATION")),
                contact_no=clean_str(row.get("CONTACT NUMBER")),
                spouse_last_name=spouse_last,
                spouse_first_name=spouse_first,
                spouse_middle_name=spouse_middle,
                sector_summary=sector_summary
            )

            db.add(resident)
            db.flush()  # Get ID without full commit

            # -------- FAMILY MEMBERS --------
            for i in range(1, 6):

                lname = clean_str(row.get(f"{i}. LAST NAME"))
                fname = clean_str(row.get(f"{i}. FIRST NAME"))
                mname = clean_str(row.get(f"{i}. MIDDLE NAME (IF NOT APPLICABLE, LEAVE IT BLANK)"))
                rel = clean_str(row.get(f"{i}. RELATIONSHIP"))

                # Fix shifted relationship issue
                if lname.upper() in relationship_keywords and rel == "":
                    rel = lname
                    lname = fname
                    fname = mname
                    mname = ""

                if lname == "" and fname == "" and rel == "":
                    continue

                # 🔒 FAMILY DUPLICATE CHECK
                if family_member_exists(db, resident.id, lname, fname, rel):
                    continue

                new_member = FamilyMember(
                    profile_id=resident.id,
                    last_name=lname,
                    first_name=fname,
                    middle_name=mname,
                    relationship=rel
                )

                db.add(new_member)

            success_count += 1

        except Exception as e:
            errors.append(f"Row {index+2}: {str(e)}")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"added": 0, "errors": [str(e)]}

    return {
        "added": success_count,
        "skipped_duplicates": skipped_duplicates,
        "errors": errors
    }
