import pandas as pd
import re
import uuid
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import tuple_
from app.models.models import ResidentProfile, FamilyMember


# ===============================
# Helpers
# ===============================
def get_any(row, *keys):
    for k in keys:
        v = row.get(k)
        if v is None:
            continue
        s = clean_str(v)
        if s != "":
            return s
    return ""

def clean_str(val):
    if val is None:
        return ""
    text = str(val).strip()
    if text.lower() in ["nan", "none", "null", "-", "na", "n/a"]:
        return ""
    return text


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


def is_checked(value):
    v = clean_str(value).lower()
    return v in ["\\", "/", "✓", "1", "yes", "y", "true"] or v != ""


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Unifies headers from OLD + NEW forms:
    - strips everything after first newline or '('
    - uppercases
    - fixes common variants (CONTACT/PHONE NUMBER, PRECINT/PRECINCT, EXTENSION NAME/EXT NAME)
    """
    cols = []
    for c in df.columns:
        c = str(c)
        c = re.sub(r"\s*[\(\n].*", "", c)     # remove from first "(" or "\n" onward
        c = re.sub(r"\s+", " ", c).strip().upper()

        # Standardize
        c = c.replace("EXTENSION NAME", "EXT NAME")
        c = c.replace("CONTACT", "PHONE NUMBER")
        c = c.replace("PRECINCT NUMBER ", "PRECINCT NUMBER")
        c = c.replace("PRECINCT NUMBER.", "PRECINCT NUMBER")
        c = c.replace("PRECINCT NO.", "PRECINCT NUMBER")
        c = c.replace("PRECINT NO", "PRECINCT NUMBER")
        c = c.replace("PRECINT NO.", "PRECINCT NUMBER")

        cols.append(c)

    df.columns = cols
    return df


# ===============================
# MAIN IMPORT
# ===============================
def process_excel_import(file_content, db: Session, sheet_name=None):

    df = pd.read_excel(
        file_content,
        sheet_name=(0 if sheet_name is None else sheet_name),
        dtype=object,
        engine="openpyxl"
    )

    df = df.replace({pd.NaT: None})
    df = df.where(pd.notnull(df), None)
    df = normalize_columns(df)

    success_count = 0
    skipped_duplicates = 0
    errors = []

    # -------------------------------
    # Detect sector columns (if any)
    # -------------------------------
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
        "OTHERS",
    ]
    sector_columns = [c for c in possible_sectors if c in df.columns]

    # -------------------------------
    # Detect spouse columns (NEW profiled)
    # After normalization, NEW file becomes:
    # LAST NAME.1, FIRST NAME.1, MIDDLE NAME.1, EXT NAME.1
    # -------------------------------
    spouse_last_col = "LAST NAME.1" if "LAST NAME.1" in df.columns else None
    spouse_first_col = "FIRST NAME.1" if "FIRST NAME.1" in df.columns else None
    spouse_middle_col = "MIDDLE NAME.1" if "MIDDLE NAME.1" in df.columns else None
    spouse_ext_col = "EXT NAME.1" if "EXT NAME.1" in df.columns else None

    # -------------------------------
    # Family member columns like:
    # 1. LAST NAME, 1. FIRST NAME, 1. MIDDLE NAME, 1. RELATIONSHIP
    # -------------------------------
    family_columns = [c for c in df.columns if re.match(r"^\d+\.\s", c)]

    # Map member_no -> {FIELD: column_name}
    members_map: dict[int, dict[str, str]] = {}
    for col in family_columns:
        m = re.match(r"^(\d+)\.\s*(.*)$", col)
        if not m:
            continue
        no = int(m.group(1))
        field = m.group(2).strip().upper()

        # normalize field names
        if "LAST NAME" in field:
            field = "LAST NAME"
        elif "FIRST NAME" in field:
            field = "FIRST NAME"
        elif "MIDDLE NAME" in field:
            field = "MIDDLE NAME"
        elif "EXT" in field:
            field = "EXT NAME"
        elif "RELATIONSHIP" in field:
            field = "RELATIONSHIP"
        else:
            continue

        members_map.setdefault(no, {})[field] = col

    # -------------------------------
    # Build rows for ResidentProfile insert
    # -------------------------------
    seen_in_file = set()
    residents_to_insert = []
    resident_keys_in_file = []  # to later fetch IDs

    for index, row in df.iterrows():
        try:
            last_name = clean_str(row.get("LAST NAME")).upper()
            first_name = clean_str(row.get("FIRST NAME")).upper()
            middle_name = clean_str(row.get("MIDDLE NAME")).upper()
            barangay = clean_str(row.get("BARANGAY")).upper()

            if not last_name or not first_name:
                continue

            key = (last_name, first_name, middle_name, barangay)
            if key in seen_in_file:
                skipped_duplicates += 1
                continue
            seen_in_file.add(key)
            resident_keys_in_file.append(key)

            birthdate = parse_date(row.get("BIRTHDATE"))

            # sectors -> summary text (for dashboard)
            active_sectors = [c for c in sector_columns if is_checked(row.get(c))]
            sector_summary = ", ".join(active_sectors) if active_sectors else None

            # spouse info (NEW file)
            spouse_last = clean_str(row.get(spouse_last_col)).upper() if spouse_last_col else None
            spouse_first = clean_str(row.get(spouse_first_col)).upper() if spouse_first_col else None
            spouse_middle = clean_str(row.get(spouse_middle_col)).upper() if spouse_middle_col else None
            spouse_ext = clean_str(row.get(spouse_ext_col)).upper() if spouse_ext_col else None

            residents_to_insert.append({
                "resident_code": "RES-" + uuid.uuid4().hex[:8].upper(),
                "is_deleted": False,
                "is_archived": False,
                "is_family_head": True,
                "is_active": True,
                "status": "Active",

                "last_name": last_name,
                "first_name": first_name,
                "middle_name": middle_name,
                "ext_name": clean_str(row.get("EXT NAME")).upper() or None,

                "house_no": clean_str(row.get("HOUSE NO. / STREET")) or None,
                "purok": clean_str(row.get("PUROK/SITIO")) or clean_str(row.get("PUROK/SITIO ")) or "",
                "barangay": barangay,

                "birthdate": birthdate,
                "sex": clean_str(row.get("SEX")),
                "civil_status": clean_str(row.get("CIVIL STATUS")) or None,
                "religion": clean_str(row.get("RELIGION")) or None,
                "occupation": clean_str(row.get("OCCUPATION")) or None,
                "contact_no": clean_str(row.get("PHONE NUMBER")) or None,
                "precinct_no": get_any(
                    row,
                    "PRECINCT NUMBER",
                    "PRECINCT NO",
                    "PRECINT NO",
                    "PRECINCT"
                ) or None,

                # spouse fields
                "spouse_last_name": spouse_last or None,
                "spouse_first_name": spouse_first or None,
                "spouse_middle_name": spouse_middle or None,
                "spouse_ext_name": spouse_ext or None,

                "sector_summary": sector_summary,
            })

        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")

    # -------------------------------
    # Insert residents with ON CONFLICT
    # -------------------------------
    inserted_count = 0
    if residents_to_insert:
        stmt = insert(ResidentProfile).values(residents_to_insert)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["last_name", "first_name", "middle_name", "barangay"]
        )

        try:
            result = db.execute(stmt)
            db.commit()
        except Exception as e:
            db.rollback()
            return {"added": 0, "skipped_duplicates": skipped_duplicates, "errors": [str(e)]}

        inserted_count = result.rowcount or 0
        success_count = inserted_count
        skipped_duplicates += (len(residents_to_insert) - inserted_count)

    # -------------------------------
    # Fetch IDs for residents in this file
    # (so we can insert family members)
    # -------------------------------
    resident_id_map = {}
    if resident_keys_in_file:
        rows = db.query(
            ResidentProfile.id,
            ResidentProfile.last_name,
            ResidentProfile.first_name,
            ResidentProfile.middle_name,
            ResidentProfile.barangay
        ).filter(
            tuple_(
                ResidentProfile.last_name,
                ResidentProfile.first_name,
                ResidentProfile.middle_name,
                ResidentProfile.barangay
            ).in_(resident_keys_in_file)
        ).all()

        for rid, ln, fn, mn, br in rows:
            resident_id_map[(ln.upper(), fn.upper(), (mn or "").upper(), br.upper())] = rid

    # -------------------------------
    # Build family_members insert rows
    # -------------------------------
    family_to_insert = []
    for index, row in df.iterrows():
        try:
            last_name = clean_str(row.get("LAST NAME")).upper()
            first_name = clean_str(row.get("FIRST NAME")).upper()
            middle_name = clean_str(row.get("MIDDLE NAME")).upper()
            barangay = clean_str(row.get("BARANGAY")).upper()

            if not last_name or not first_name:
                continue

            key = (last_name, first_name, middle_name, barangay)
            resident_id = resident_id_map.get(key)
            if not resident_id:
                continue

            for member_no in sorted(members_map.keys()):
                cols = members_map[member_no]

                lname = clean_str(row.get(cols.get("LAST NAME", ""))).upper()
                fname = clean_str(row.get(cols.get("FIRST NAME", ""))).upper()
                mname = clean_str(row.get(cols.get("MIDDLE NAME", ""))).upper()
                ext = clean_str(row.get(cols.get("EXT NAME", ""))).upper()
                rel = clean_str(row.get(cols.get("RELATIONSHIP", ""))).upper()

                # skip blank member slots
                if fname == "" and rel == "":
                    continue

                # default lname to household last name if empty
                if lname == "":
                    lname = last_name

                family_to_insert.append({
                    "profile_id": resident_id,
                    "last_name": lname,
                    "first_name": fname,
                    "middle_name": (mname or None),
                    "ext_name": (ext or None),
                    "relationship": (rel or None),
                    "is_active": True,
                    "is_family_head": False
                })

        except Exception as e:
            errors.append(f"Family row {index + 2}: {str(e)}")

    # Insert family members (no conflict rule needed unless you add a unique constraint there)
    if family_to_insert:
        try:
            db.execute(insert(FamilyMember).values(family_to_insert))
            db.commit()
        except Exception as e:
            db.rollback()
            errors.append(f"Family insert error: {str(e)}")

    return {"added": success_count, "skipped_duplicates": skipped_duplicates, "errors": errors}