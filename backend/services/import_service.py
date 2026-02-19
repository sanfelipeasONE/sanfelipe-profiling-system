import pandas as pd
import re
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from sqlalchemy.exc import IntegrityError
from app.models.models import ResidentProfile, FamilyMember


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
# PARSE DATE
# ===============================
def parse_date(date_val):
    if date_val is None or pd.isna(date_val):
        return None

    if isinstance(date_val, pd.Timestamp):
        return date_val.date()

    if isinstance(date_val, (int, float)):
        try:
            return pd.to_datetime(date_val, origin="1899-12-30", unit="D").date()
        except:
            return None

    try:
        return pd.to_datetime(clean_str(date_val)).date()
    except:
        return None


# ===============================
# CHECK IF RESIDENT EXISTS
# ===============================
def resident_exists(db: Session, last_name, first_name, middle_name, barangay):
    return db.query(ResidentProfile).filter(
        and_(
            func.upper(ResidentProfile.last_name) == last_name.upper(),
            func.upper(ResidentProfile.first_name) == first_name.upper(),
            func.upper(func.coalesce(ResidentProfile.middle_name, "")) == middle_name.upper(),
            ResidentProfile.barangay == barangay,
            ResidentProfile.is_deleted == False
        )
    ).first()


# ===============================
# SECTOR CHECK
# ===============================
def is_checked(value):
    val = clean_str(value).lower()
    if val in ["\\", "/", "✓", "1", "yes", "y", "true"]:
        return True
    if val != "":
        return True
    return False


# ===============================
# MAIN IMPORT FUNCTION
# ===============================
def process_excel_import(file_content, db: Session):

    df = pd.read_excel(file_content, dtype=object, engine="openpyxl")
    df = df.replace({pd.NaT: None})
    df = df.where(pd.notnull(df), None)

    # --------------------------------------------------
    # CLEAN & NORMALIZE HEADERS
    # --------------------------------------------------
    df.columns = [
        re.sub(r'\s+', ' ', col.strip().upper())
        for col in df.columns
    ]

    print("=== CLEANED COLUMNS ===")
    print(df.columns.tolist())

    success_count = 0
    skipped_duplicates = 0
    errors = []

    # --------------------------------------------------
    # IDENTIFY SPOUSE BLOCK
    # --------------------------------------------------
    spouse_index = None
    for i, col in enumerate(df.columns):
        if col == "SPOUSE/PARTNER":
            spouse_index = i
            break

    # Main head columns (fixed order)
    main_last_col = "LAST NAME"
    main_first_col = "FIRST NAME"
    main_middle_col = "MIDDLE NAME"
    main_ext_col = "EXT NAME"

    # Spouse columns (auto-detected)
    spouse_last_col = "LAST NAME.1" if "LAST NAME.1" in df.columns else None
    spouse_first_col = "FIRST NAME.1" if "FIRST NAME.1" in df.columns else None
    spouse_middle_col = "MIDDLE NAME.1" if "MIDDLE NAME.1" in df.columns else None
    spouse_ext_col = "EXT NAME.1" if "EXT NAME.1" in df.columns else None

    # --------------------------------------------------
    # SECTOR COLUMNS
    # --------------------------------------------------
    possible_sectors = [
        "INDIGENOUS PEOPLE",
        "SENIOR CITIZEN",
        "PWD",
        "BRGY OFFICIAL",
        "BRGY OFFICIAL/EMPLOYEE",
        "BRGY BNS/BHW",
        "BRGY TANOD",
        "OFW",
        "SOLO PARENT",
        "FARMER",
        "FISHERFOLK",
        "FISHERMAN/BANCA OWNER",
        "LGU EMPLOYEE",
        "TODA",
        "STUDENT",
        "LIFEGUARD",
        "OTHERS"
    ]

    sector_columns = [col for col in possible_sectors if col in df.columns]

    # --------------------------------------------------
    # PROCESS ROWS
    # --------------------------------------------------
    for index, row in df.iterrows():
        try:

            last_name = clean_str(row.get(main_last_col))
            first_name = clean_str(row.get(main_first_col))
            middle_name = clean_str(row.get(main_middle_col))
            ext_name = clean_str(row.get(main_ext_col))

            barangay = clean_str(row.get("BARANGAY"))
            birthdate = parse_date(row.get("BIRTHDATE"))

            if last_name == "" and first_name == "":
                continue

            # Duplicate check
            if resident_exists(db, last_name, first_name, middle_name, barangay):
                skipped_duplicates += 1
                continue

            # Precinct
            precinct_no = ""
            for col in df.columns:
                if col in ["PRECINT NO", "PRECINCT NO", "PRECINCT"]:
                    precinct_no = clean_str(row.get(col))
                    break

            # Sector processing
            active_sectors = []
            for col in sector_columns:
                if is_checked(row.get(col)):
                    active_sectors.append(col)

            sector_summary = ", ".join(active_sectors) if active_sectors else "None"

            # Spouse
            spouse_last = clean_str(row.get(spouse_last_col)) if spouse_last_col else ""
            spouse_first = clean_str(row.get(spouse_first_col)) if spouse_first_col else ""
            spouse_middle = clean_str(row.get(spouse_middle_col)) if spouse_middle_col else ""
            spouse_ext = clean_str(row.get(spouse_ext_col)) if spouse_ext_col else ""

            # Create Resident
            resident = ResidentProfile(
                last_name=last_name.upper(),
                first_name=first_name.upper(),
                middle_name=middle_name.upper(),
                ext_name=ext_name,
                house_no=clean_str(row.get("HOUSE NO. / STREET")),
                purok=clean_str(row.get("PUROK/SITIO")),
                barangay=barangay,
                birthdate=birthdate,
                sex=clean_str(row.get("SEX")),
                civil_status=clean_str(row.get("CIVIL STATUS")),
                religion=clean_str(row.get("RELIGION")),
                occupation=clean_str(row.get("OCCUPATION")),
                contact_no=clean_str(row.get("CONTACT")),
                precinct_no=precinct_no,
                spouse_last_name=spouse_last,
                spouse_first_name=spouse_first,
                spouse_middle_name=spouse_middle,
                spouse_ext_name=spouse_ext,
                sector_summary=sector_summary
            )

            db.add(resident)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                skipped_duplicates += 1
                continue

            # --------------------------------------------------
            # FAMILY MEMBERS (ROBUST MATCHING)
            # --------------------------------------------------
            for i in range(1, 6):

                lname = ""
                fname = ""
                mname = ""
                rel = ""

                lname_col = next((c for c in df.columns if c.startswith(f"{i}. LAST NAME")), None)
                fname_col = next((c for c in df.columns if c.startswith(f"{i}. FIRST NAME")), None)
                mname_col = next((c for c in df.columns if c.startswith(f"{i}. MIDDLE NAME")), None)
                rel_col = next((c for c in df.columns if c.startswith(f"{i}. RELATIONSHIP")), None)

                # Some Excel templates skip LAST NAME for #1
                if fname_col:
                    fname = clean_str(row.get(fname_col))
                if mname_col:
                    mname = clean_str(row.get(mname_col))
                if rel_col:
                    rel = clean_str(row.get(rel_col))
                if lname_col:
                    lname = clean_str(row.get(lname_col))

                # If no last name provided, inherit household head last name
                if lname == "":
                    lname = resident.last_name

                # Skip empty
                if fname == "" and rel == "":
                    continue

                db.add(FamilyMember(
                    profile_id=resident.id,
                    last_name=lname,
                    first_name=fname,
                    middle_name=mname,
                    relationship=rel
                ))


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
