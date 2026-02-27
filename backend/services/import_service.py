import pandas as pd
import re
import uuid
from sqlalchemy.orm import Session
from app.models.models import ResidentProfile


# ============================================
# Generate Resident Code
# ============================================
def generate_resident_code():
    return "RES-" + uuid.uuid4().hex[:8].upper()


# ============================================
# Clean String
# ============================================
def clean_str(val):
    if val is None:
        return ""
    text = str(val).strip()
    if text.lower() in ["nan", "none", "null", "-", "na", "n/a"]:
        return ""
    return text


# ============================================
# Parse Date
# ============================================
def parse_date(date_val):
    if date_val is None or pd.isna(date_val):
        return None
    try:
        return pd.to_datetime(date_val).date()
    except:
        return None


# ============================================
# Normalize Column Names (OLD + NEW FORMAT)
# ============================================
def normalize_columns(df: pd.DataFrame):

    new_columns = []

    for col in df.columns:
        col = col.strip().upper()

        # Remove extra Google Form text
        col = re.sub(r"\s*\(.*\)", "", col)
        col = col.replace("\n", " ").strip()

        # Standardize variations
        col = col.replace("EXT NAME", "EXTENSION NAME")
        col = col.replace("PRECINT NO", "PRECINCT NUMBER")
        col = col.replace("CONTACT", "PHONE NUMBER")

        new_columns.append(col)

    df.columns = new_columns
    return df


# ============================================
# Safe Column Getter
# ============================================
def get_column(row, possible_names):
    for name in possible_names:
        if name in row:
            return row.get(name)
    return None


# ============================================
# MAIN IMPORT FUNCTION
# ============================================
def process_excel_import(file_content, filename: str, db: Session):

    # Detect file type
    if filename.lower().endswith(".csv"):
        df = pd.read_csv(file_content)
    elif filename.lower().endswith(".xlsx"):
        df = pd.read_excel(file_content, dtype=object, engine="openpyxl")
    else:
        raise ValueError("Unsupported file format")

    df = df.replace({pd.NaT: None})
    df = df.where(pd.notnull(df), None)
    df = normalize_columns(df)

    success_count = 0
    skipped_duplicates = 0
    errors = []

    # ============================================
    # Fetch Existing Residents (1 Query Only)
    # UniqueConstraint:
    # last_name + first_name + birthdate + barangay
    # ============================================
    existing_residents = {
        (
            r.last_name.upper(),
            r.first_name.upper(),
            r.birthdate,
            r.barangay
        )
        for r in db.query(
            ResidentProfile.last_name,
            ResidentProfile.first_name,
            ResidentProfile.birthdate,
            ResidentProfile.barangay
        ).filter(ResidentProfile.is_deleted == False).all()
    }

    residents_to_add = []

    # ============================================
    # PROCESS ROWS
    # ============================================
    for index, row in df.iterrows():
        try:
            last_name = clean_str(get_column(row, ["LAST NAME"])).upper()
            first_name = clean_str(get_column(row, ["FIRST NAME"])).upper()
            middle_name = clean_str(get_column(row, ["MIDDLE NAME"])).upper()

            barangay = clean_str(get_column(row, ["BARANGAY"]))
            birthdate = parse_date(get_column(row, ["BIRTHDATE"]))

            if not last_name or not first_name:
                continue

            key = (last_name, first_name, birthdate, barangay)

            if key in existing_residents:
                skipped_duplicates += 1
                continue

            resident = ResidentProfile(
                resident_code=generate_resident_code(),

                # System
                is_deleted=False,
                is_archived=False,
                is_family_head=True,
                is_active=True,
                status="Active",

                # Personal
                last_name=last_name,
                first_name=first_name,
                middle_name=middle_name,
                ext_name=clean_str(get_column(row, ["EXTENSION NAME"])),

                # Address
                house_no=clean_str(get_column(row, ["HOUSE NO. / STREET"])),
                purok=clean_str(get_column(row, ["PUROK/SITIO"])),
                barangay=barangay,

                # Spouse (optional)
                spouse_last_name=None,
                spouse_first_name=None,
                spouse_middle_name=None,
                spouse_ext_name=None,

                # Demographics
                birthdate=birthdate,
                sex=clean_str(get_column(row, ["SEX"])),
                civil_status=clean_str(get_column(row, ["CIVIL STATUS"])),
                religion=clean_str(get_column(row, ["RELIGION"])),
                precinct_no=clean_str(get_column(row, ["PRECINCT NUMBER"])),

                # Work
                occupation=clean_str(get_column(row, ["OCCUPATION"])),
                contact_no=clean_str(get_column(row, ["PHONE NUMBER"])),

                # Sector
                sector_summary=None,
                other_sector_details=None,

                # Photo
                photo_url=None
            )

            residents_to_add.append(resident)
            existing_residents.add(key)
            success_count += 1

        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")

    # ============================================
    # BULK INSERT
    # ============================================
    if residents_to_add:
        db.bulk_save_objects(residents_to_add)
        db.commit()

    return {
        "added": success_count,
        "skipped_duplicates": skipped_duplicates,
        "errors": errors
    }