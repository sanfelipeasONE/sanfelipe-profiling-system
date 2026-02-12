import pandas as pd
from sqlalchemy.orm import Session
from models import ResidentProfile, FamilyMember
from datetime import datetime


# =========================================================
# STRING CLEANER
# =========================================================
def clean_str(val):
    if val is None:
        return ""
    if isinstance(val, float) and pd.isna(val):
        return ""
    text = str(val).strip()
    if text.lower() in ["nan", "none", "null", "-", "na", "n/a", "0", "0.0"]:
        return ""
    return text


# =========================================================
# SAFE DATE PARSER (handles Excel serial dates)
# =========================================================
def parse_date(date_val):
    if date_val is None or clean_str(date_val) == "":
        return None

    if isinstance(date_val, (int, float)):
        try:
            return pd.to_datetime(date_val, origin='1899-12-30', unit='D').date()
        except:
            return None

    if isinstance(date_val, (pd.Timestamp, datetime)):
        return date_val.date()

    text_val = clean_str(date_val)

    formats = [
        '%m/%d/%Y', '%Y-%m-%d', '%d-%b-%y',
        '%m-%d-%Y', '%Y/%m/%d', '%d/%m/%Y',
        '%B %d, %Y', '%d-%m-%Y'
    ]

    for fmt in formats:
        try:
            return datetime.strptime(text_val, fmt).date()
        except:
            continue

    return None


# =========================================================
# FIND BEST COLUMN BASED ON DATA DENSITY
# =========================================================
def get_best_column(df, keyword):
    candidates = [col for col in df.columns if keyword in col]
    if not candidates:
        return None

    best_col = None
    max_non_empty = 0

    for col in candidates:
        non_empty = df[col].notna().sum()
        if non_empty > max_non_empty:
            max_non_empty = non_empty
            best_col = col

    return best_col


# =========================================================
# FIND COLUMN VALUE BY KEYWORDS
# =========================================================
def find_column_value(row, keywords):
    for col in row.index:
        col_clean = " ".join(str(col).replace("\n", " ").split()).upper()
        if all(k.upper() in col_clean for k in keywords):
            return clean_str(row[col])
    return ""


# =========================================================
# MAIN IMPORT FUNCTION
# =========================================================
def process_excel_import(file_content, db: Session):

    try:
        df = pd.read_excel(file_content, dtype=object, engine="openpyxl")
    except:
        file_content.seek(0)
        df = pd.read_csv(file_content, dtype=object, encoding="cp1252")

    # -----------------------------------------------------
    # CLEAN + FIX DUPLICATE HEADERS
    # -----------------------------------------------------
    cleaned_columns = []
    seen = {}

    for col in df.columns:
        col_clean = " ".join(str(col).replace("\n", " ").split()).upper()

        if col_clean in seen:
            seen[col_clean] += 1
            col_clean = f"{col_clean}.{seen[col_clean]}"
        else:
            seen[col_clean] = 0

        cleaned_columns.append(col_clean)

    df.columns = cleaned_columns
    df = df.where(pd.notnull(df), None)

    # -----------------------------------------------------
    # DETECT CORRECT NAME COLUMNS
    # -----------------------------------------------------
    last_name_col = get_best_column(df, "LAST NAME")
    first_name_col = get_best_column(df, "FIRST NAME")
    middle_name_col = get_best_column(df, "MIDDLE NAME")
    ext_name_col = get_best_column(df, "EXT NAME")

    success_count = 0
    errors = []

    # -----------------------------------------------------
    # PROCESS ROWS
    # -----------------------------------------------------
    for index, row in df.iterrows():
        try:
            last_name = clean_str(row.get(last_name_col)) if last_name_col else ""
            first_name = clean_str(row.get(first_name_col)) if first_name_col else ""

            # Skip empty rows
            if last_name == "" and first_name == "":
                continue

            birth_raw = find_column_value(row, ["BIRTH"])
            birthdate = parse_date(birth_raw)

            civil_status = find_column_value(row, ["CIVIL"])
            occupation = find_column_value(row, ["OCCUPATION"]) \
                or find_column_value(row, ["JOB"])

            purok = find_column_value(row, ["PUROK"])
            barangay = find_column_value(row, ["BARANGAY"])
            sex = find_column_value(row, ["SEX"])
            religion = find_column_value(row, ["RELIGION"])
            contact = find_column_value(row, ["CONTACT"])
            precinct = find_column_value(row, ["PRECINCT"]) \
                or find_column_value(row, ["PRECINT"])

            resident = ResidentProfile(
                last_name=last_name,
                first_name=first_name,
                middle_name=clean_str(row.get(middle_name_col)) if middle_name_col else "",
                ext_name=clean_str(row.get(ext_name_col)) if ext_name_col else "",
                house_no=find_column_value(row, ["HOUSE"]),
                purok=purok,
                barangay=barangay,
                sex=sex,
                birthdate=birthdate,
                civil_status=civil_status,
                religion=religion,
                occupation=occupation,
                contact_no=contact,
                precinct_no=precinct
            )

            # -------------------------------------------------
            # FAMILY MEMBERS (Dynamic detection 1–5)
            # -------------------------------------------------
            for i in range(1, 6):
                fam_last = find_column_value(row, [f"{i}", "LAST"])
                fam_first = find_column_value(row, [f"{i}", "FIRST"])

                if fam_last != "" or fam_first != "":
                    member = FamilyMember(
                        last_name=fam_last,
                        first_name=fam_first,
                        middle_name=find_column_value(row, [f"{i}", "MIDDLE"]),
                        relationship=find_column_value(row, [f"{i}", "RELATION"])
                    )
                    resident.family_members.append(member)

            db.add(resident)
            success_count += 1

        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"added": 0, "errors": [f"Database Error: {str(e)}"]}

    return {"added": success_count, "errors": errors}
