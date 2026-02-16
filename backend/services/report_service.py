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
    """
    Convert column index (0-based) to Excel column letter.
    Supports AA, AB, etc.
    """
    letter = ""
    while col_idx >= 0:
        letter = chr(col_idx % 26 + 65) + letter
        col_idx = col_idx // 26 - 1
    return letter


# --------------------------------------------------
# MAIN EXPORT FUNCTION
# --------------------------------------------------

def generate_household_excel(db: Session, barangay_name: str = None):

    # --------------------------------------------------
    # 1️⃣ FETCH DATA
    # --------------------------------------------------

    query = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.is_deleted == False
    )

    if barangay_name:
        query = query.filter(
            models.ResidentProfile.barangay.ilike(f"%{barangay_name}%")
        ).order_by(models.ResidentProfile.last_name)
    else:
        query = query.order_by(
            models.ResidentProfile.barangay,
            models.ResidentProfile.last_name
        )

    residents = query.all()

    # --------------------------------------------------
    # 2️⃣ FIND MAX FAMILY COUNT
    # --------------------------------------------------

    max_family_count = 0
    for r in residents:
        max_family_count = max(max_family_count, len(r.family_members))

    # --------------------------------------------------
    # 3️⃣ TRANSFORM DATA
    # --------------------------------------------------

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
            'ID': r.id,
            'Barangay': r.barangay,
            'House #': r.house_no,
            'Purok': r.purok,
            'Household Head': full_name.upper(),
            'Spouse': spouse_name.upper(),
            'Sex': r.sex,
            'Age': calculate_age(r.birthdate),
            'Status': r.civil_status,
            'Religion': r.religion,
            'Occupation': r.occupation,
            'Total': total_members,
            'Sectors': r.sector_summary,
            'Contact': r.contact_no,
        }

        # Dynamic family member columns
        for i in range(max_family_count):
            if i < len(r.family_members):
                fm = r.family_members[i]
                row[f'.{i+1} LAST NAME'] = fm.last_name
                row[f'.{i+1} FIRST NAME'] = fm.first_name
                row[f'.{i+1} MIDDLE NAME'] = fm.middle_name
                row[f'.{i+1} RELATIONSHIP'] = fm.relationship
            else:
                row[f'.{i+1} LAST NAME'] = ""
                row[f'.{i+1} FIRST NAME'] = ""
                row[f'.{i+1} MIDDLE NAME'] = ""
                row[f'.{i+1} RELATIONSHIP'] = ""

        data_list.append(row)

    df = pd.DataFrame(data_list)

    # --------------------------------------------------
    # 4️⃣ GENERATE EXCEL
    # --------------------------------------------------

    output = io.BytesIO()

    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:

        df.to_excel(writer, sheet_name='Master_List', startrow=5, header=False, index=False)

        workbook = writer.book
        worksheet = writer.sheets['Master_List']
        worksheet.hide_gridlines(2)

        # --------------------------------------------------
        # STYLES
        # --------------------------------------------------

        fmt_title = workbook.add_format({
            'bold': True,
            'font_size': 14,
            'align': 'center'
        })

        fmt_sub = workbook.add_format({
            'italic': True,
            'font_size': 11,
            'align': 'center'
        })

        fmt_header = workbook.add_format({
            'bold': True,
            'bg_color': '#2E8B57',
            'font_color': 'white',
            'border': 1,
            'align': 'center',
            'text_wrap': True
        })

        fmt_center = workbook.add_format({
            'border': 1,
            'align': 'center',
            'font_size': 10
        })

        fmt_text = workbook.add_format({
            'border': 1,
            'align': 'left',
            'font_size': 10
        })

        # --------------------------------------------------
        # HEADERS
        # --------------------------------------------------

        base_headers = [
            'ID', 'Barangay', 'House #', 'Purok',
            'Household Head', 'Spouse', 'Sex', 'Age',
            'Status', 'Religion', 'Occupation',
            'Total', 'Sectors', 'Contact'
        ]

        family_headers = []
        for i in range(max_family_count):
            family_headers.extend([
                f'.{i+1} LAST NAME',
                f'.{i+1} FIRST NAME',
                f'.{i+1} MIDDLE NAME',
                f'.{i+1} RELATIONSHIP'
            ])

        headers = base_headers + family_headers

        for col, h in enumerate(headers):
            worksheet.write(4, col, h, fmt_header)

        last_col = excel_col_letter(len(headers) - 1)

        worksheet.merge_range(f'A1:{last_col}1', 'REPUBLIC OF THE PHILIPPINES', fmt_sub)
        worksheet.merge_range(f'A2:{last_col}2', 'PROVINCE OF ZAMBALES', fmt_sub)
        worksheet.merge_range(f'A3:{last_col}3', 'MUNICIPALITY OF SAN FELIPE', fmt_title)

        title_text = f"MASTER LIST - {barangay_name.upper()}" if barangay_name else "MASTER LIST - ALL BARANGAYS"
        worksheet.merge_range(f'A4:{last_col}4', title_text, fmt_title)

        # --------------------------------------------------
        # COLUMN WIDTH SETTINGS (FIXED)
        # --------------------------------------------------

        worksheet.set_column('A:A', 6)
        worksheet.set_column('B:B', 15)
        worksheet.set_column('C:C', 10)
        worksheet.set_column('D:D', 12)
        worksheet.set_column('E:E', 35)   # Wider Head
        worksheet.set_column('F:F', 30)   # Wider Spouse
        worksheet.set_column('G:H', 6)
        worksheet.set_column('I:I', 12)
        worksheet.set_column('J:J', 15)
        worksheet.set_column('K:K', 18)
        worksheet.set_column('L:L', 8)
        worksheet.set_column('M:M', 20)
        worksheet.set_column('N:N', 15)

        # Family columns width
        start_family_col = len(base_headers)
        for i in range(max_family_count * 4):
            col_idx = start_family_col + i
            worksheet.set_column(col_idx, col_idx, 18)

        # --------------------------------------------------
        # APPLY FORMAT TO DATA ROWS
        # --------------------------------------------------

        for row_idx in range(len(df)):
            worksheet.set_row(5 + row_idx, None, fmt_center)

            worksheet.write(5 + row_idx, 4, df.iloc[row_idx]['Household Head'], fmt_text)
            worksheet.write(5 + row_idx, 5, df.iloc[row_idx]['Spouse'], fmt_text)
            worksheet.write(5 + row_idx, 10, df.iloc[row_idx]['Occupation'], fmt_text)
            worksheet.write(5 + row_idx, 12, df.iloc[row_idx]['Sectors'], fmt_text)

    output.seek(0)
    return output
