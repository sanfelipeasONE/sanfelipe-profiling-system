import pandas as pd
from sqlalchemy.orm import Session
from models import ResidentProfile, FamilyMember
from datetime import datetime
import io

# =========================================================
# CLEAN STRING
# =========================================================
def clean_str(val):
    if pd.isna(val) or val is None:
        return ""
    text = str(val).strip()
    if text.lower() in ['nan', 'none', 'null', '0', '0.0']:
        return ""
    return text


# =========================================================
# ROBUST DATE PARSER (Handles Excel Serial Dates)
# =========================================================
def parse_date(date_val):
    if pd.isna(date_val) or str(date_val).strip() == "":
        return None

    # Excel numeric serial date
    if isinstance(date_val, (int, float)):
        try:
            return pd.to_datetime(date_val, origin='1899-12-30', unit='D').date()
        except:
            return None

    # Pandas timestamp
    if isinstance(date_val, (pd.Timestamp, datetime)):
        return date_val.date()

    text_val = str(date_val).strip()
    if text_val.lower() in ['nan', 'none', 'null', '-', 'na', 'n/a']:
        return None

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
# SMART COLUMN FINDER (Keyword Based)
# =========================================================
def find_column_value(row, keywords):
    """
    Finds a column containing ALL keywords in its header.
    """
    for col in row.index:
        col_clean = " ".join(str(col).replace("\n", " ").split()).upper()
        if all(keyword.upper() in col_clean for keyword in keywords):
            val = row.get(col)
            if pd.notna(val):
                return val
    return None


# =========================================================
# SECTOR DETECTOR
# =========================================================
def get_sectors(row):
    active_sectors = []
    possible_sectors = [
        'FARMER', 'FISHERFOLK', 'FISHERMAN/BANCA OWNER', 'TODA',
        'BRGY BNS/BHW', 'BRGY TANOD', 'BRGY OFFICIAL',
        'LGU EMPLOYEE', 'INDIGENOUS PEOPLE', 'PWD',
        'OFW', 'STUDENT', 'SENIOR CITIZEN',
        'LIFEGUARD', 'SOLO PARENT'
    ]

    for sector in possible_sectors:
        val = find_column_value(row, [sector])
        if clean_str(val) != "":
            active_sectors.append(sector)

    other_val = find_column_value(row, ['OTHERS'])
    other_details = None
    if clean_str(other_val) != "":
        active_sectors.append("Others")
        if len(clean_str(other_val)) > 1:
            other_details = clean_str(other_val)

    summary = ", ".join(active_sectors) if active_sectors else "None"
    return summary, other_details


# =========================================================
# MAIN IMPORT FUNCTION
# =========================================================
def process_excel_import(file_content, db: Session):

    # ---------------------------
    # READ FILE
    # ---------------------------
    try:
        df = pd.read_excel(file_content, header=None, engine='openpyxl')
    except:
        file_content.seek(0)
        df = pd.read_csv(file_content, header=None, encoding='cp1252')

    # ---------------------------
    # FIND HEADER ROW
    # ---------------------------
    header_index = -1

    for i in range(min(25, len(df))):
        row_values = [str(x).strip().upper() for x in df.iloc[i].values]
        if "LAST NAME" in row_values and "FIRST NAME" in row_values:
            header_index = i
            df.columns = df.iloc[i].values
            df = df.iloc[i+1:].reset_index(drop=True)
            break

    if header_index == -1:
        return {"added": 0, "errors": ["Header row not found."]}

    # Clean column names
    df.columns = [
        " ".join(str(c).replace("\n", " ").split()).upper()
        for c in df.columns
    ]

    df = df.where(pd.notnull(df), None)

    success_count = 0
    errors = []

    # =====================================================
    # PROCESS ROWS
    # =====================================================
    for index, row in df.iterrows():
        try:
            lname = clean_str(find_column_value(row, ["LAST", "NAME"]))
            if not lname:
                continue

            fname = clean_str(find_column_value(row, ["FIRST", "NAME"]))
            mname = clean_str(find_column_value(row, ["MIDDLE", "NAME"]))
            ext   = clean_str(find_column_value(row, ["EXT"]))

            # -------- Robust Fields --------
            birth_raw = find_column_value(row, ["BIRTH"])
            birthdate = parse_date(birth_raw)

            occupation_val = clean_str(
                find_column_value(row, ["OCCUPATION"])
                or find_column_value(row, ["JOB"])
            )

            civil_status_val = clean_str(
                find_column_value(row, ["CIVIL"])
                or find_column_value(row, ["STATUS"])
            )

            religion_val = clean_str(find_column_value(row, ["RELIGION"]))
            sex_val = clean_str(find_column_value(row, ["SEX"]))
            contact_val = clean_str(
                find_column_value(row, ["CONTACT"])
                or find_column_value(row, ["PHONE"])
            )

            precinct_val = clean_str(find_column_value(row, ["PRECINCT"]))

            purok_val = clean_str(find_column_value(row, ["PUROK"]))
            barangay_val = clean_str(find_column_value(row, ["BARANGAY"]))
            house_val = clean_str(find_column_value(row, ["HOUSE"]))

            sector_str, other_str = get_sectors(row)

            # -------- Create Resident --------
            resident = ResidentProfile(
                last_name=lname,
                first_name=fname,
                middle_name=mname,
                ext_name=ext,

                house_no=house_val,
                purok=purok_val,
                barangay=barangay_val,

                sex=sex_val,
                birthdate=birthdate,
                civil_status=civil_status_val,
                religion=religion_val,
                occupation=occupation_val,
                contact_no=contact_val,
                precinct_no=precinct_val,

                sector_summary=sector_str,
                other_sector_details=other_str
            )

            # -------- Family Members (1-5) --------
            for i in range(1, 6):
                fam_lname = clean_str(find_column_value(row, [f"{i}.", "LAST"]))
                fam_fname = clean_str(find_column_value(row, [f"{i}.", "FIRST"]))

                if fam_lname or fam_fname:
                    fam_mname = clean_str(find_column_value(row, [f"{i}.", "MIDDLE"]))
                    fam_rel = clean_str(find_column_value(row, [f"{i}.", "RELATIONSHIP"]))

                    member = FamilyMember(
                        last_name=fam_lname,
                        first_name=fam_fname,
                        middle_name=fam_mname,
                        relationship=fam_rel
                    )
                    resident.family_members.append(member)

            db.add(resident)
            success_count += 1

        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")

    # ---------------------------
    # COMMIT
    # ---------------------------
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"added": 0, "errors": [f"Database Error: {str(e)}"]}

    return {"added": success_count, "errors": errors}
