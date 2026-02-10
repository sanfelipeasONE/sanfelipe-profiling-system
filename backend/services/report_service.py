import io
import pandas as pd
from datetime import date
from sqlalchemy.orm import Session
import models

def calculate_age(birthdate):
    if not birthdate:
        return ""
    today = date.today()
    return today.year - birthdate.year - ((today.month, today.day) < (birthdate.month, birthdate.day))

def generate_household_excel(db: Session, barangay_name: str = None):
    # 1. FETCH DATA
    query = db.query(models.ResidentProfile)
    
    if barangay_name:
        # Filter by Barangay + Sort by Name
        query = query.filter(models.ResidentProfile.barangay == barangay_name)
        query = query.order_by(models.ResidentProfile.last_name)
    else:
        # Sort by Barangay FIRST, then Name
        query = query.order_by(models.ResidentProfile.barangay, models.ResidentProfile.last_name)
    
    residents = query.all()

    # 2. TRANSFORM DATA
    data_list = []
    for r in residents:
        mi = f"{r.middle_name[0]}." if r.middle_name else ""
        full_name = f"{r.last_name}, {r.first_name} {mi} {r.ext_name or ''}".strip()
        
        spouse_name = ""
        if r.spouse_first_name:
            spouse_mi = f"{r.spouse_middle_name[0]}." if r.spouse_middle_name else ""
            spouse_name = f"{r.spouse_last_name}, {r.spouse_first_name} {spouse_mi}".strip()

        total_members = 1 + len(r.family_members)

        # --- KEY FIX: ENSURE BARANGAY IS IN THIS LIST ---
        data_list.append({
            'ID': r.id,
            'Barangay': r.barangay,  # <--- CRITICAL FIELD
            'House No': r.house_no,
            'Purok': r.purok,
            'Household Head': full_name.upper(),
            'Spouse': spouse_name.upper(),
            'Sex': r.sex,
            'Age': calculate_age(r.birthdate),
            'Civil Status': r.civil_status,
            'Occupation': r.occupation,
            'Members': total_members,
            'Sectors': r.sector_summary,
            'Contact': r.contact_no,
        })

    df = pd.DataFrame(data_list)

    # 3. GENERATE EXCEL
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        
        # Write data starting at Row 7 (index 6)
        df.to_excel(writer, sheet_name='Master_List', startrow=6, header=False, index=False)

        workbook = writer.book
        worksheet = writer.sheets['Master_List']
        worksheet.hide_gridlines(2)

        # --- STYLES ---
        fmt_title = workbook.add_format({'bold': True, 'font_size': 14, 'align': 'center', 'valign': 'vcenter'})
        fmt_sub = workbook.add_format({'italic': True, 'font_size': 11, 'align': 'center', 'valign': 'vcenter'})
        fmt_header = workbook.add_format({
            'bold': True, 'bg_color': '#2E8B57', 'font_color': 'white', 
            'border': 1, 'align': 'center', 'valign': 'vcenter'
        })
        fmt_center = workbook.add_format({'border': 1, 'align': 'center', 'valign': 'vcenter', 'font_size': 10})
        fmt_text = workbook.add_format({'border': 1, 'align': 'left', 'valign': 'vcenter', 'indent': 1, 'font_size': 10})

        # --- HEADERS ---
        worksheet.merge_range('A1:M1', 'REPUBLIC OF THE PHILIPPINES', fmt_sub)
        worksheet.merge_range('A2:M2', 'PROVINCE OF ZAMBALES', fmt_sub)
        worksheet.merge_range('A3:M3', 'MUNICIPALITY OF SAN FELIPE', fmt_title)
        
        title_text = f"MASTER LIST - {barangay_name.upper()}" if barangay_name else "MASTER LIST - ALL BARANGAYS"
        worksheet.merge_range('A4:M4', title_text, fmt_title)

        # --- COLUMNS ---
        # Ensure 'Barangay' is the second item here
        headers = ['ID', 'Barangay', 'House #', 'Purok', 'Household Head', 'Spouse', 'Sex', 'Age', 'Status', 'Occupation', 'Total', 'Sectors', 'Contact']
        
        for col, h in enumerate(headers):
            worksheet.write(5, col, h, fmt_header)

        # --- WIDTHS ---
        worksheet.set_column('A:A', 5, fmt_center)   # ID
        worksheet.set_column('B:B', 15, fmt_center)  # Barangay (NEW)
        worksheet.set_column('C:C', 25, fmt_center)  # House
        worksheet.set_column('D:D', 12, fmt_center)  # Purok
        worksheet.set_column('E:E', 35, fmt_text)    # Head
        worksheet.set_column('F:F', 25, fmt_text)    # Spouse
        worksheet.set_column('G:H', 5, fmt_center)   # Sex/Age
        worksheet.set_column('I:I', 10, fmt_center)  # Status
        worksheet.set_column('J:J', 15, fmt_text)    # Occupation
        worksheet.set_column('K:K', 6, fmt_center)   # Total
        worksheet.set_column('L:L', 15, fmt_text)    # Sectors
        worksheet.set_column('M:M', 25, fmt_center)  # Contact

        # --- FREEZE PANES ---
        worksheet.freeze_panes(6, 0) 
        worksheet.autofilter(5, 0, 5 + len(df), len(headers) - 1)

    output.seek(0)
    return output