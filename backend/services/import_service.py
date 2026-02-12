import pandas as pd
from sqlalchemy.orm import Session
from models import ResidentProfile, FamilyMember
from datetime import datetime


def clean_str(val):
    if val is None:
        return ""
    text = str(val).strip()
    if text.lower() in ["nan", "none", "null", "-", "na", "n/a"]:
        return ""
    return text


def parse_date(date_val):
    if date_val is None:
        return None

    if pd.isna(date_val):
        return None

    if isinstance(date_val, pd.Timestamp):
        return date_val.date()

    # Excel numeric serial date
    if isinstance(date_val, (int, float)):
        try:
            return pd.to_datetime(date_val, origin="1899-12-30", unit="D").date()
        except:
            return None

    text_val = clean_str(date_val)
    if text_val == "":
        return None

    # Try automatic pandas parsing (handles ISO, mixed formats)
    try:
        return pd.to_datetime(text_val).date()
    except:
        return None


def process_excel_import(file_content, db: Session):

    df = pd.read_excel(file_content, dtype=object, engine="openpyxl")
    df = df.replace({pd.NaT: None})
    df = df.where(pd.notnull(df), None)
    success_count = 0
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

    for index, row in df.iterrows():
        try:
            last_name = clean_str(row.get("LAST NAME.1"))
            first_name = clean_str(row.get("FIRST NAME"))

            if last_name == "" and first_name == "":
                continue

            birthdate = parse_date(row.get("BIRTHDATE"))

            # -------- SECTORS --------
            active_sectors = []
            for col in sector_columns:
                if clean_str(row.get(col)) == "\\":
                    active_sectors.append(col)

            sector_summary = ", ".join(active_sectors) if active_sectors else "None"

            # -------- SPOUSE HANDLING --------
            spouse_last = clean_str(row.get("LAST NAME.2"))
            spouse_first = clean_str(row.get("FIRST NAME.1"))
            spouse_middle = clean_str(row.get("MIDDLE NAME.1"))

            # If structured spouse empty, try full name column
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
                middle_name=clean_str(row.get("MIDDLE NAME")),
                ext_name=clean_str(row.get("EXT NAME")),
                house_no=clean_str(row.get("HOUSE NO. / STREET")),
                purok=clean_str(row.get("PUROK")),
                barangay=clean_str(row.get("BARANGAY")),
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

            # -------- FAMILY MEMBERS --------
            # FAMILY MEMBERS (AUTO-CORRECTED VERSION)
            for i in range(1, 6):

                lname = clean_str(row.get(f"{i}. LAST NAME"))
                fname = clean_str(row.get(f"{i}. FIRST NAME"))
                mname = clean_str(row.get(f"{i}. MIDDLE NAME (IF NOT APPLICABLE, LEAVE IT BLANK)"))
                rel   = clean_str(row.get(f"{i}. RELATIONSHIP"))

                # --- FIX SHIFT CASE 1 ---
                # Relationship accidentally in LAST NAME column
                if lname.upper() in ["SON", "DAUGHTER", "FATHER", "MOTHER", "NIECE", "NEPHEW", "GRANDSON", "GRANDDAUGHTER", "GRANDFATHER", "GRANDMOTHER", "SISTER", "BROTHER", "UNCLE", "AUNT"]:
                    rel = lname
                    lname = fname
                    fname = mname
                    mname = ""

                # --- FIX SHIFT CASE 2 ---
                # If relationship exists but first name empty
                if rel != "" and fname == "":
                    fname = lname
                    lname = ""

                # Skip empty rows
                if lname == "" and fname == "" and rel == "":
                    continue

                new_member = FamilyMember(
                    last_name=lname,
                    first_name=fname,
                    middle_name=mname,
                    relationship=rel
                )

                resident.family_members.append(new_member)



            db.add(resident)
            success_count += 1

        except Exception as e:
            errors.append(f"Row {index+2}: {str(e)}")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"added": 0, "errors": [str(e)]}

    return {"added": success_count, "errors": errors}
