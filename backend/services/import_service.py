import pandas as pd
from sqlalchemy.orm import Session
from models import ResidentProfile, FamilyMember
from datetime import datetime
import io

def clean_str(val):
    if pd.isna(val) or val is None:
        return ""
    text = str(val).strip()
    if text.lower() in ["nan", "none", "null", "0", "0.0"]:
        return ""
    return text

def parse_date(date_val):
    if pd.isna(date_val) or date_val is None or str(date_val).strip() == "":
        return None

    # Pandas/Excel timestamps
    if isinstance(date_val, (pd.Timestamp, datetime)):
        return date_val.date()

    text_val = str(date_val).strip()
    if text_val.lower() in ["nan", "none", "null", "-", "na", "n/a"]:
        return None

    formats = [
        "%m/%d/%Y", "%Y-%m-%d", "%d-%b-%y", "%m-%d-%Y",
        "%Y/%m/%d", "%d/%m/%Y", "%B %d, %Y", "%d-%m-%Y"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(text_val, fmt).date()
        except ValueError:
            continue
    return None

def get_column_value(row, col_name_start: str) -> str:
    """
    Returns the FIRST NON-EMPTY value among columns whose header starts with col_name_start.
    Handles:
      - duplicate columns like 'CIVIL STATUS' and 'CIVIL STATUS.1'
      - headers with newlines/spaces
    """
    matches = []
    for col in row.index:
        col_clean = " ".join(str(col).replace("\n", " ").split())
        if col_clean.upper().startswith(col_name_start.upper()):
            matches.append(col)

    for col in matches:
        val = clean_str(row.get(col))
        if val != "":
            return val

    return ""

def get_sectors(row):
    active_sectors = []
    possible_sectors = [
        "FARMER", "FISHERFOLK", "FISHERMAN/BANCA OWNER", "TODA",
        "BRGY BNS/BHW", "BRGY TANOD", "BRGY OFFICIAL", "LGU EMPLOYEE",
        "INDIGENOUS PEOPLE", "PWD", "OFW", "STUDENT",
        "SENIOR CITIZEN", "LIFEGUARD", "SOLO PARENT"
    ]

    for sector in possible_sectors:
        val = get_column_value(row, sector)
        if val != "":
            active_sectors.append(sector)

    other_val = get_column_value(row, "OTHERS")
    other_details = None
    if other_val != "":
        active_sectors.append("Others")
        if len(other_val) > 1:
            other_details = other_val

    summary = ", ".join(active_sectors) if active_sectors else "None"
    return summary, other_details

def process_excel_import(file_content, db: Session):
    # ---------- PHASE 1: READ FILE ----------
    try:
        df = pd.read_excel(file_content, header=None, dtype=str, engine="openpyxl")
    except Exception as e:
        file_content.seek(0)
        try:
            df = pd.read_csv(file_content, header=None, dtype=str, encoding="cp1252")
        except Exception:
            return {"added": 0, "errors": [f"File Read Error: {str(e)}"]}

    # ---------- PHASE 2: FIND HEADER ROW ----------
    header_index = -1
    for i in range(min(20, len(df))):
        row_values = [str(x).strip().upper() for x in df.iloc[i].values]
        if "LAST NAME" in row_values and "FIRST NAME" in row_values:
            header_index = i

            df.columns = df.iloc[i].values
            df.columns = [str(c).strip().upper() for c in df.columns]

            # Force unique headers like Pandas (CIVIL STATUS, CIVIL STATUS.1, etc.)
            new_cols = []
            seen = {}
            for c in df.columns:
                if c in seen:
                    seen[c] += 1
                    new_cols.append(f"{c}.{seen[c]}")
                else:
                    seen[c] = 0
                    new_cols.append(c)
            df.columns = new_cols

            df = df.iloc[i + 1:].reset_index(drop=True)
            break

    if header_index == -1:
        return {"added": 0, "errors": ["Could not find 'LAST NAME' and 'FIRST NAME' header row."]}

    # ---------- PHASE 3: IDENTIFY THE REAL LAST NAME COLUMN ----------
    target_lname_col = "LAST NAME"
    count_ln0 = df["LAST NAME"].notna().sum() if "LAST NAME" in df.columns else 0
    count_ln1 = df["LAST NAME.1"].notna().sum() if "LAST NAME.1" in df.columns else 0
    if count_ln1 > count_ln0:
        target_lname_col = "LAST NAME.1"

    # ---------- PHASE 4: PROCESS ROWS ----------
    df = df.where(pd.notnull(df), None)
    success_count = 0
    errors = []

    for index, row in df.iterrows():
        try:
            lname = clean_str(row.get(target_lname_col))
            if not lname:
                continue

            bday = parse_date(
                row.get("BIRTHDATE") if "BIRTHDATE" in df.columns else get_column_value(row, "BIRTHDATE")
            )

            sector_str, other_str = get_sectors(row)

            # Civil Status FIX: use get_column_value so it can read CIVIL STATUS.1 when CIVIL STATUS is empty
            civil_status_val = get_column_value(row, "CIVIL STATUS")

            resident = ResidentProfile(
                last_name=lname,
                first_name=clean_str(row.get("FIRST NAME")),
                middle_name=clean_str(row.get("MIDDLE NAME")),
                ext_name=clean_str(row.get("EXT NAME")),

                house_no=clean_str(row.get("HOUSE NO. / STREET")) or get_column_value(row, "HOUSE"),
                purok=clean_str(row.get("PUROK/SITIO")) or clean_str(row.get("PUROK")) or get_column_value(row, "PUROK"),
                barangay=clean_str(row.get("BARANGAY")) or get_column_value(row, "BARANGAY"),

                sex=clean_str(row.get("SEX")) or get_column_value(row, "SEX"),
                birthdate=bday,
                civil_status=civil_status_val,
                religion=clean_str(row.get("RELIGION")) or get_column_value(row, "RELIGION"),
                occupation=clean_str(row.get("OCCUPATION")) or get_column_value(row, "OCCUPATION"),
                contact_no=clean_str(row.get("CONTACT")) or clean_str(row.get("CONTACT NUMBER")) or get_column_value(row, "CONTACT"),
                precinct_no=clean_str(row.get("PRECINT NO")) or clean_str(row.get("PRECINCT NO")) or get_column_value(row, "PRECINCT"),

                sector_summary=sector_str,
                other_sector_details=other_str,

                # Spouse columns are often duplicated too; pick the next set if present
                spouse_last_name=get_column_value(row, "LAST NAME.1") if target_lname_col == "LAST NAME" else get_column_value(row, "LAST NAME.2"),
                spouse_first_name=get_column_value(row, "FIRST NAME.1"),
                spouse_middle_name=get_column_value(row, "MIDDLE NAME.1"),
                spouse_ext_name=get_column_value(row, "EXT NAME.1"),
            )

            # ---------- FAMILY MEMBERS (1-5) ----------
            for i in range(1, 6):
                fam_lname = get_column_value(row, f"{i}. LAST NAME")
                fam_fname = get_column_value(row, f"{i}. FIRST NAME")

                if fam_lname or fam_fname:
                    fam_mname = get_column_value(row, f"{i}. MIDDLE NAME")
                    fam_rel = get_column_value(row, f"{i}. RELATIONSHIP")
                    fam_bday = parse_date(get_column_value(row, f"{i}. BIRTHDATE"))
                    fam_occ = get_column_value(row, f"{i}. OCCUPATION")

                    member = FamilyMember(
                        last_name=fam_lname,
                        first_name=fam_fname,
                        middle_name=fam_mname,
                        relationship=fam_rel,
                        birthdate=fam_bday,
                        occupation=fam_occ,
                    )
                    resident.family_members.append(member)

            db.add(resident)
            success_count += 1

        except Exception as e:
            # +2: one for header row removal, one because users expect 1-based row numbers
            errors.append(f"Row {index + 2}: {str(e)}")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"added": 0, "errors": [f"Database Error: {str(e)}"]}

    return {"added": success_count, "errors": errors}
