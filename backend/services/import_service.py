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
# NORMALIZE COLUMN HEADERS
# Strips everything from the first newline or parenthesis onward,
# so multiline Google Form headers are reduced to their core label.
# e.g. "MIDDLE NAME\n(If not applicable...)" → "MIDDLE NAME"
#      "PUROK/SITIO \n(Ex. 1, 2, 3...)"      → "PUROK/SITIO"
# ===============================
def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [
        re.sub(r'\s*[\(\n].*', '', col).strip().upper()
        for col in df.columns
    ]
    return df


# ===============================
# MAIN IMPORT FUNCTION
# ===============================
def process_excel_import(file_content, db: Session):

    df = pd.read_excel(file_content, dtype=object, engine="openpyxl")
    df = df.replace({pd.NaT: None})
    df = df.where(pd.notnull(df), None)

    # Normalize headers
    df = normalize_columns(df)

    print("=== CLEANED COLUMNS ===")
    print(df.columns.tolist())
    print("=======================")

    success_count = 0
    skipped_duplicates = 0
    errors = []

    # --------------------------------------------------
    # SECTOR COLUMNS (if present in this file)
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
            # ── Core fields ──────────────────────────────────
            last_name   = clean_str(row.get("LAST NAME"))
            first_name  = clean_str(row.get("FIRST NAME"))
            middle_name = clean_str(row.get("MIDDLE NAME"))
            ext_name    = clean_str(row.get("EXTENSION NAME"))   # was EXT NAME
            barangay    = clean_str(row.get("BARANGAY"))
            birthdate   = parse_date(row.get("BIRTHDATE"))

            # Skip completely empty rows
            if last_name == "" and first_name == "":
                continue

            # Duplicate check
            if resident_exists(db, last_name, first_name, middle_name, barangay):
                skipped_duplicates += 1
                continue

            # ── Optional / renamed fields ─────────────────────
            purok       = clean_str(row.get("PUROK/SITIO"))      # long header → normalized
            contact_no  = clean_str(row.get("PHONE NUMBER"))     # was CONTACT
            precinct_no = clean_str(row.get("PRECINCT NUMBER"))  # was PRECINT NO / PRECINCT NO

            # ── Sector processing ─────────────────────────────
            active_sectors = [col for col in sector_columns if is_checked(row.get(col))]
            sector_summary = ", ".join(active_sectors) if active_sectors else "None"

            # ── Spouse – extracted from family member rows ────
            # This Excel has no separate spouse block; the spouse appears
            # as a family member entry with RELATIONSHIP == "SPOUSE".
            # We'll capture it below when processing family members.
            spouse_last   = ""
            spouse_first  = ""
            spouse_middle = ""
            spouse_ext    = ""

            # ── Create Resident ───────────────────────────────
            resident = ResidentProfile(
                last_name=last_name.upper(),
                first_name=first_name.upper(),
                middle_name=middle_name.upper(),
                ext_name=ext_name,
                house_no="",                             # not in this form
                purok=purok,
                barangay=barangay,
                birthdate=birthdate,
                sex=clean_str(row.get("SEX")),
                civil_status=clean_str(row.get("CIVIL STATUS")),
                religion="",                             # not in this form
                occupation="",                           # not in this form
                contact_no=contact_no,
                precinct_no=precinct_no,
                spouse_last_name=spouse_last,
                spouse_first_name=spouse_first,
                spouse_middle_name=spouse_middle,
                spouse_ext_name=spouse_ext,
                sector_summary=sector_summary,
            )

            db.add(resident)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                skipped_duplicates += 1
                continue

            # --------------------------------------------------
            # FAMILY MEMBERS
            # Columns are already normalized to:
            #   "1. LAST NAME", "1. FIRST NAME", "1. MIDDLE NAME",
            #   "1. EXTENSION NAME", "1. RELATIONSHIP"  … up to 5
            # --------------------------------------------------
            family_columns = [col for col in df.columns if re.match(r"^\d+\.\s", col)]

            members: dict[int, dict] = {}
            for col in family_columns:
                match = re.match(r"^(\d+)\.\s*(.*)", col)
                if match:
                    member_no  = int(match.group(1))
                    field_name = match.group(2).strip()

                    # Normalize field label
                    if "LAST NAME" in field_name:
                        field_name = "LAST NAME"
                    elif "FIRST NAME" in field_name:
                        field_name = "FIRST NAME"
                    elif "MIDDLE NAME" in field_name:
                        field_name = "MIDDLE NAME"
                    elif "EXTENSION NAME" in field_name:
                        field_name = "EXTENSION NAME"
                    elif "RELATIONSHIP" in field_name:
                        field_name = "RELATIONSHIP"

                    members.setdefault(member_no, {})[field_name] = col

            for member_no in sorted(members.keys()):
                cols = members[member_no]

                lname = clean_str(row.get(cols.get("LAST NAME", "")))
                fname = clean_str(row.get(cols.get("FIRST NAME", "")))
                mname = clean_str(row.get(cols.get("MIDDLE NAME", "")))
                ext   = clean_str(row.get(cols.get("EXTENSION NAME", "")))
                rel   = clean_str(row.get(cols.get("RELATIONSHIP", "")))

                # Skip blank entries
                if fname == "" and rel == "":
                    continue

                # Default last name to household surname if blank
                if lname == "":
                    lname = resident.last_name

                # Populate spouse fields on the resident record if not yet set
                if rel.upper() == "SPOUSE" and resident.spouse_first_name == "":
                    resident.spouse_last_name   = lname
                    resident.spouse_first_name  = fname
                    resident.spouse_middle_name = mname
                    resident.spouse_ext_name    = ext

                db.add(FamilyMember(
                    profile_id=resident.id,
                    last_name=lname,
                    first_name=fname,
                    middle_name=mname,
                    relationship=rel,
                ))

            success_count += 1

        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")

    # --------------------------------------------------
    # COMMIT
    # --------------------------------------------------
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"added": 0, "skipped_duplicates": 0, "errors": [str(e)]}

    return {
        "added": success_count,
        "skipped_duplicates": skipped_duplicates,
        "errors": errors,
    }