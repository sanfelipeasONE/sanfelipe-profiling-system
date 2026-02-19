import io
import pandas as pd
from datetime import date
from sqlalchemy.orm import Session
from app import models


# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def calculate_age(birthdate):
    if not birthdate:
        return ""
    today = date.today()
    return (
        today.year
        - birthdate.year
        - ((today.month, today.day) < (birthdate.month, birthdate.day))
    )


def excel_col_letter(col_idx):
    letter = ""
    while col_idx >= 0:
        letter = chr(col_idx % 26 + 65) + letter
        col_idx = col_idx // 26 - 1
    return letter


# --------------------------------------------------
# MAIN EXPORT FUNCTION
# --------------------------------------------------

def generate_household_excel(db: Session, barangay_name: str = None):

    # 1️⃣ FETCH DATA
    query = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.is_deleted == False
    )

    if barangay_name:
        query = query.filter(
            models.ResidentProfile.barangay.ilike(f"%{barangay_name}%")
        )

    residents = query.order_by(
        models.ResidentProfile.barangay,
        models.ResidentProfile.last_name
    ).all()

    # 2️⃣ DETERMINE MAX FAMILY MEMBERS
    max_family_count = 0
    for r in residents:
        max_family_count = max(max_family_count, len(r.family_members))

    # 3️⃣ TRANSFORM DATA
    data_list = []

    for r in residents:

        mi = f"{r.middle_name[0]}." if r.middle_name else ""
        full_name = f"{r.last_name}, {r.first_name} {mi} {r.ext_name or ''}".strip()

        spouse_name = ""
        if r.spouse_first_name:
            s_mi = f"{r.spouse_middle_name[0]}." if r.spouse_middle_name else ""
            spouse_name = f"{r.spouse_last_name}, {r.spouse_first_name} {s_mi} {r.spouse_ext_name or ''}".strip()

        total_members = 1 + len(r.family_members)

        row = {
            "Barangay": r.barangay,
            "Purok": r.purok,
            "House #": r.house_no,
            "Household Head": full_name.upper(),
            "Spouse": spouse_name.upper(),
            "Sex": r.sex,
            "Birthdate": r.birthdate,
            "Age": calculate_age(r.birthdate),
            "Civil Status": r.civil_status,
            "Religion": r.religion,
            "Occupation": r.occupation,
            "Precinct No": r.precinct_no,
            "Contact": r.contact_no,
            "Total Members": total_members,
            "Sectors": r.sector_summary,
        }

        # Dynamic Family Members
        for i in range(max_family_count):
            if i < len(r.family_members):
                fm = r.family_members[i]
                row[f"{i+1}. LAST NAME"] = fm.last_name
                row[f"{i+1}. FIRST NAME"] = fm.first_name
                row[f"{i+1}. MIDDLE NAME"] = fm.middle_name
                row[f"{i+1}. RELATIONSHIP"] = fm.relationship
            else:
                row[f"{i+1}. LAST NAME"] = ""
                row[f"{i+1}. FIRST NAME"] = ""
                row[f"{i+1}. MIDDLE NAME"] = ""
                row[f"{i+1}. RELATIONSHIP"] = ""

        data_list.append(row)

    df = pd.DataFrame(data_list)

    # 4️⃣ GENERATE EXCEL FILE
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:

        df.to_excel(writer, sheet_name="Master_List", startrow=5, index=False)

        workbook = writer.book
        worksheet = writer.sheets["Master_List"]

        worksheet.hide_gridlines(2)

        # --------------------------------------------------
        # FORMATTING
        # --------------------------------------------------

        fmt_title = workbook.add_format({
            "bold": True,
            "font_size": 14,
            "align": "center"
        })

        fmt_sub = workbook.add_format({
            "italic": True,
            "font_size": 11,
            "align": "center"
        })

        fmt_header = workbook.add_format({
            "bold": True,
            "bg_color": "#2E8B57",
            "font_color": "white",
            "border": 1,
            "align": "center",
            "text_wrap": True
        })

        fmt_cell = workbook.add_format({
            "border": 1,
            "font_size": 10
        })

        # Title
        last_col_letter = excel_col_letter(len(df.columns) - 1)

        worksheet.merge_range(f"A1:{last_col_letter}1", "REPUBLIC OF THE PHILIPPINES", fmt_sub)
        worksheet.merge_range(f"A2:{last_col_letter}2", "PROVINCE OF ZAMBALES", fmt_sub)
        worksheet.merge_range(f"A3:{last_col_letter}3", "MUNICIPALITY OF SAN FELIPE", fmt_title)

        title_text = f"MASTER LIST - {barangay_name.upper()}" if barangay_name else "MASTER LIST - ALL BARANGAYS"
        worksheet.merge_range(f"A4:{last_col_letter}4", title_text, fmt_title)

        # Apply header style
        for col_num, column in enumerate(df.columns):
            worksheet.write(5, col_num, column, fmt_header)

        # Apply cell borders
        for row_num in range(len(df)):
            worksheet.set_row(row_num + 6, None, fmt_cell)

        # Auto column width
        for i, col in enumerate(df.columns):
            try:
                max_length = df[col].fillna("").astype(str).map(len).max()
                column_len = max(max_length, len(col)) + 2
            except:
                column_len = len(col) + 2

            worksheet.set_column(i, i, column_len)


    output.seek(0)
    return output
