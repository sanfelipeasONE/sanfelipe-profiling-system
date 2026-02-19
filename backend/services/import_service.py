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
    print("=== ALL COLUMNS ===")
    print(df.columns.tolist())
    print("===================")
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
            family_columns = [col for col in df.columns if re.match(r"\d+\.\s", col)]

            members = {}

            for col in family_columns:
                match = re.match(r"(\d+)\.\s*(.*)", col)
                if match:
                    member_no = int(match.group(1))
                    field_name = match.group(2)

                    # Normalize field names
                    if "LAST NAME" in field_name:
                        field_name = "LAST NAME"
                    elif "FIRST NAME" in field_name:
                        field_name = "FIRST NAME"
                    elif "MIDDLE NAME" in field_name:
                        field_name = "MIDDLE NAME"
                    elif "RELATIONSHIP" in field_name:
                        field_name = "RELATIONSHIP"

                    if member_no not in members:
                        members[member_no] = {}

                    members[member_no][field_name] = col

            for member_no in sorted(members.keys()):

                cols = members[member_no]

                lname = clean_str(row.get(cols.get("LAST NAME", "")))
                fname = clean_str(row.get(cols.get("FIRST NAME", "")))
                mname = clean_str(row.get(cols.get("MIDDLE NAME", "")))
                rel = clean_str(row.get(cols.get("RELATIONSHIP", "")))

                # --- SHIFT FIX ---
                # If last name is empty but first name equals household surname,
                # and relationship looks like a name (not SON/DAUGHTER/etc),
                # then shift values left.

                if lname == "" and fname == resident.last_name:
                    lname = resident.last_name
                    fname = mname
                    mname = ""
                    rel = clean_str(row.get(cols.get("RELATIONSHIP", "")))

                if fname == "" and rel == "":
                    continue

                if lname == "":
                    lname = resident.last_name

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
