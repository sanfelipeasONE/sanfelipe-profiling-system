import pandas as pd
import re
import uuid
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from app.models.models import ResidentProfile


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


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Makes headers consistent across sheets/files:
    - strips everything after first newline or '('
    - uppercases
    - standardizes known variants (CONTACT/PHONE NUMBER, PRECINT/PRECINCT, EXT NAME/EXTENSION NAME)
    """
    cleaned = []
    for col in df.columns:
        col = str(col)
        col = re.sub(r"\s*[\(\n].*", "", col)   # remove from first '(' or '\n' onward
        col = re.sub(r"\s+", " ", col).strip().upper()

        # Standardize variants
        col = col.replace("EXT NAME", "EXT NAME")  # keep as EXT NAME (your model mapping below uses EXT NAME)
        col = col.replace("EXTENSION NAME", "EXT NAME")
        col = col.replace("PRECINT NO", "PRECINCT NUMBER")
        col = col.replace("PRECINCT NO", "PRECINCT NUMBER")
        col = col.replace("PRECINCT", "PRECINCT NUMBER")
        col = col.replace("CONTACT", "PHONE NUMBER")

        cleaned.append(col)

    df.columns = cleaned
    return df


def process_excel_import(file_content, db: Session, sheet_name: str | int | None = "Sheet1"):
    """
    sheet_name can be:
    - "Sheet1" (recommended for your 7404 masterlist)
    - any sheet name string
    - an index (0-based) or -1 for last sheet
    - None -> defaults to first sheet
    """

    # Read Excel sheet
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

    seen_in_file = set()
    residents_to_insert = []

    for index, row in df.iterrows():
        try:
            last_name = clean_str(row.get("LAST NAME")).upper()
            first_name = clean_str(row.get("FIRST NAME")).upper()
            middle_name = clean_str(row.get("MIDDLE NAME")).upper()
            barangay = clean_str(row.get("BARANGAY")).upper()

            if not last_name or not first_name:
                continue

            key = (last_name, first_name, middle_name, barangay)

            # Skip duplicates inside the file
            if key in seen_in_file:
                skipped_duplicates += 1
                continue
            seen_in_file.add(key)

            birthdate = parse_date(row.get("BIRTHDATE"))

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

                "ext_name": clean_str(row.get("EXT NAME")),  # normalized from EXTENSION NAME too

                # Sheet1 uses PUROK/SITIO (with newline text). normalize_columns converts it to PUROK/SITIO
                "house_no": clean_str(row.get("HOUSE NO. / STREET")),  # may be blank in old sheet
                "purok": clean_str(row.get("PUROK/SITIO")),
                "barangay": barangay,

                "birthdate": birthdate,
                "sex": clean_str(row.get("SEX")),
                "civil_status": clean_str(row.get("CIVIL STATUS")),
                "religion": clean_str(row.get("RELIGION")),
                "occupation": clean_str(row.get("OCCUPATION")),

                # OLD sheets use PHONE NUMBER
                "contact_no": clean_str(row.get("PHONE NUMBER")),

                # OLD sheets use PRECINCT NUMBER
                "precinct_no": clean_str(row.get("PRECINCT NUMBER")),

                "sector_summary": None
            })

        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")

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

        # rows not inserted because of DB unique conflicts
        skipped_duplicates += (len(residents_to_insert) - inserted_count)

    return {
        "added": success_count,
        "skipped_duplicates": skipped_duplicates,
        "errors": errors
    }