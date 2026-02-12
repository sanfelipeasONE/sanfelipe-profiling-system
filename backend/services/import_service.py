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
    if not date_val:
        return None

    text_val = clean_str(date_val)

    try:
        if "T" in text_val:
            return datetime.fromisoformat(text_val).date()
    except:
        pass

    formats = [
        "%m/%d/%Y",
        "%Y-%m-%d",
        "%d-%m-%Y"
    ]

    for fmt in formats:
        try:
            return datetime.strptime(text_val, fmt).date()
        except:
            continue

    return None


def process_excel_import(file_content, db: Session):

    df = pd.read_excel(file_content, dtype=object, engine="openpyxl")
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
            last_name = clean_str(row["LAST NAME.1"])
            first_name = clean_str(row["FIRST NAME"])

            if last_name == "" and first_name == "":
                continue

            birthdate = parse_date(row["BIRTHDATE"])

            # SECTORS
            active_sectors = []
            for col in sector_columns:
                if clean_str(row.get(col)) == "\\":
                    active_sectors.append(col)

            sector_summary = ", ".join(active_sectors) if active_sectors else "None"

            resident = ResidentProfile(
                last_name=last_name,
                first_name=first_name,
                middle_name=clean_str(row["MIDDLE NAME"]),
                ext_name=clean_str(row["EXT NAME"]),
                house_no=clean_str(row["HOUSE NO. / STREET"]),
                purok=clean_str(row["PUROK"]),
                barangay=clean_str(row["BARANGAY"]),
                birthdate=birthdate,
                sex=clean_str(row["SEX"]),
                civil_status=clean_str(row["CIVIL STATUS"]),
                religion=clean_str(row["RELIGION"]),
                occupation=clean_str(row["OCCUPATION"]),
                contact_no=clean_str(row["CONTACT NUMBER"]),
                spouse_last_name=clean_str(row["LAST NAME.2"]),
                spouse_first_name=clean_str(row["FIRST NAME.1"]),
                spouse_middle_name=clean_str(row["MIDDLE NAME.1"]),
                sector_summary=sector_summary
            )

            # FAMILY MEMBERS
            for i in range(1, 6):
                lname_key = f"{i}. LAST NAME"
                fname_key = f"{i}. FIRST NAME"
                mname_key = f"{i}. MIDDLE NAME (IF NOT APPLICABLE, LEAVE IT BLANK)"
                rel_key = f"{i}. RELATIONSHIP"

                if lname_key in row and fname_key in row:
                    fam_last = clean_str(row[lname_key])
                    fam_first = clean_str(row[fname_key])

                    if fam_last or fam_first:
                        member = FamilyMember(
                            last_name=fam_last,
                            first_name=fam_first,
                            middle_name=clean_str(row.get(mname_key)),
                            relationship=clean_str(row.get(rel_key))
                        )
                        resident.family_members.append(member)

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
