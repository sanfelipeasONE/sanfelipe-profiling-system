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
        # Case insensitive filter for barangay
        query = query.filter(models.ResidentProfile.barangay.ilike(f"%{barangay_name}%"))
        query = query.order_by(models.ResidentProfile.last_name)
    else:
        # Sort by Barangay FIRST, then Name
        query = query.order_by(models.ResidentProfile.barangay, models.ResidentProfile.last_name)
    
    residents = query.all()

    # 2. TRANSFORM DATA
    data_list = []
    for r in residents:
        # Format Household Head Name
        mi = f"{r.middle_name[0]}." if r.middle_name else ""
        full_name = f"{r.last_name}, {r.first_name} {mi} {r.ext_name or ''}".strip()
        
        # Format Spouse Name (Using the direct database columns we restored)
        spouse_name = ""
        if r.spouse_first_name:
             s_mi = f"{r.spouse_middle_name[0]}." if r.spouse_middle_name else ""
             spouse_name = f"{r.spouse_last_name}, {r.spouse_first_name} {s_mi} {r.spouse_ext_name or ''}".strip()

        # Count total members (Head + Family)
        total_members = 1 + len(r.family_members)

        data_list.append({
            'ID': r.id,
            'Barangay': r.barangay,
            'House No': r.house_no,
            'Purok': r.purok,
            'Household Head': full_name.upper(),
            'Spouse': spouse_name.upper(),
            'Sex': r.sex,
            'Age': calculate_age(r.birthdate),
            'Civil Status': r.civil_status,
            'Occupation': r.occupation,
            'Total': total_members,
            'Sectors': r.sector_summary,
            'Contact': r.contact_no,
        })

    df = pd.DataFrame(data_list)

    # 3. GENERATE EXCEL WITH XLSXWRITER
    output = io.BytesIO()
    
    # Use xlsxwriter engine for advanced formatting
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        
        # Write data starting at row 6 (leaving room for header)
        df.to_excel(writer, sheet_name='Master_List', startrow=5, header=False, index=False)

        workbook = writer.book
        worksheet = writer.sheets['Master_List']
        worksheet.hide_gridlines(2) # Hide screen gridlines

        # --- STYLES ---
        fmt_title = workbook.add_format({'bold': True, 'font_size': 14, 'align': 'center', 'valign': 'vcenter'})
        fmt_sub = workbook.add_format({'italic': True, 'font_size': 11, 'align': 'center', 'valign': 'vcenter'})
        fmt_header = workbook.add_format({
            'bold': True, 'bg_color': '#2E8B57', 'font_color': 'white', 
            'border': 1, 'align': 'center', 'valign': 'vcenter', 'text_wrap': True
        })
        fmt_center = workbook.add_format({'border': 1, 'align': 'center', 'valign': 'vcenter', 'font_size': 10})
        fmt_text = workbook.add_format({'border': 1, 'align': 'left', 'valign': 'vcenter', 'indent': 1, 'font_size': 10})

        # --- HEADERS (ROWS 1-4) ---
        worksheet.merge_range('A1:M1', 'REPUBLIC OF THE PHILIPPINES', fmt_sub)
        worksheet.merge_range('A2:M2', 'PROVINCE OF ZAMBALES', fmt_sub)
        worksheet.merge_range('A3:M3', 'MUNICIPALITY OF SAN FELIPE', fmt_title)
        
        title_text = f"MASTER LIST - {barangay_name.upper()}" if barangay_name else "MASTER LIST - ALL BARANGAYS"
        worksheet.merge_range('A4:M4', title_text, fmt_title)

        # --- COLUMN HEADERS (ROW 5) ---
        # Match these to the keys in data_list
        headers = ['ID', 'Barangay', 'House #', 'Purok', 'Household Head', 'Spouse', 'Sex', 'Age', 'Status', 'Occupation', 'Total', 'Sectors', 'Contact']
        
        for col, h in enumerate(headers):
            worksheet.write(4, col, h, fmt_header)

        # --- SET COLUMN WIDTHS ---
        worksheet.set_column('A:A', 5, fmt_center)   # ID
        worksheet.set_column('B:B', 15, fmt_center)  # Barangay
        worksheet.set_column('C:C', 10, fmt_center)  # House No
        worksheet.set_column('D:D', 12, fmt_center)  # Purok
        worksheet.set_column('E:E', 35, fmt_text)    # Head
        worksheet.set_column('F:F', 25, fmt_text)    # Spouse
        worksheet.set_column('G:H', 6, fmt_center)   # Sex/Age
        worksheet.set_column('I:I', 12, fmt_center)  # Status
        worksheet.set_column('J:J', 15, fmt_text)    # Occupation
        worksheet.set_column('K:K', 8, fmt_center)   # Total
        worksheet.set_column('L:L', 20, fmt_text)    # Sectors
        worksheet.set_column('M:M', 15, fmt_center)  # Contact

        # --- APPLY BORDERS TO DATA ROWS ---
        # We loop through the data rows to apply the border format
        for row_idx in range(len(df)):
            worksheet.set_row(5 + row_idx, None, fmt_center) # Apply center default
            # Overwrite specific columns with left alignment
            worksheet.write(5 + row_idx, 4, df.iloc[row_idx]['Household Head'], fmt_text)
            worksheet.write(5 + row_idx, 5, df.iloc[row_idx]['Spouse'], fmt_text)
            worksheet.write(5 + row_idx, 9, df.iloc[row_idx]['Occupation'], fmt_text)
            worksheet.write(5 + row_idx, 11, df.iloc[row_idx]['Sectors'], fmt_text)

    output.seek(0)
    return output