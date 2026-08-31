import io
import pandas as pd
from datetime import date
from sqlalchemy.orm import Session
from app import models, crud
from sqlalchemy import func

# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def calculate_age(birthdate):
    if not birthdate:
        return ""
    today = date.today()
    try:
        return (
            today.year
            - birthdate.year
            - ((today.month, today.day) < (birthdate.month, birthdate.day))
        )
    except:
        return ""

def excel_col_letter(col_idx):
    """Convert a zero-based column index to an Excel column letter (0=A, 1=B, etc.)"""
    letter = ""
    while col_idx >= 0:
        letter = chr(col_idx % 26 + 65) + letter
        col_idx = col_idx // 26 - 1
    return letter

# --------------------------------------------------
# MAIN EXPORT FUNCTION
# --------------------------------------------------

def generate_household_excel(
    db: Session, 
    barangay_name: str = None, 
    sector: str = None, 
    sectors: list[str] | None = None,
    filter_status: str = None,
    is_super_admin: bool = False
):
    # 1️⃣ FETCH DATA WITH FILTERS
    query = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.is_deleted == False
    )

    # Filter by Barangay
    if barangay_name:
        query = query.filter(
            models.ResidentProfile.barangay.ilike(f"%{barangay_name}%")
        )

    # Filter by Sector
    if sector:
        query = query.filter(
            (models.ResidentProfile.sector_summary.ilike(f"%{sector}%")) |
            (models.ResidentProfile.other_sector_details.ilike(f"%{sector}%"))
        )

    query = crud.apply_sectors_filter(query, sectors)

    # Filter by "Updated" status
    if filter_status == "updated":
        query = query.filter(models.ResidentProfile.updated_at > models.ResidentProfile.created_at)

    # 🚨 REMOVED THE BUGGY ROW DELETER HERE 🚨
    # We now fetch everyone, and just hide the letters later in the loop.

    residents = query.order_by(
        models.ResidentProfile.barangay,
        models.ResidentProfile.last_name
    ).all()

    # 2️⃣ DETERMINE MAX COUNTS FOR DYNAMIC COLUMNS
    max_family_count = 0
    max_assistance_count = 0
    
    for r in residents:
        max_family_count = max(max_family_count, len(r.family_members))
        max_assistance_count = max(max_assistance_count, len(r.assistances))

    # 3️⃣ TRANSFORM DATA INTO LIST FOR PANDAS
    data_list = []

    for r in residents:
        # Format Head Name
        raw_full_name = f"{r.last_name}, {r.first_name} {r.middle_name or ''} {r.ext_name or ''}".strip()
        full_name = " ".join(raw_full_name.split()) 

        # Format Spouse Name
        spouse_name = ""
        if r.spouse_first_name:
            raw_spouse_name = f"{r.spouse_last_name}, {r.spouse_first_name} {r.spouse_middle_name or ''} {r.spouse_ext_name or ''}".strip()
            spouse_name = " ".join(raw_spouse_name.split()) 

        total_members = 1 + len(r.family_members)

        # 🚨 NEW SECURITY LOGIC: Scrub the text, don't delete the row! 🚨
        final_sectors = r.sector_summary or "NONE"
        if not is_super_admin and final_sectors != "NONE":
            restricted = ["HC", "C", "M"]
            # Split by comma, strip spaces, and remove restricted matches perfectly
            parts = [p.strip() for p in final_sectors.split(",")]
            parts = [p for p in parts if p.upper() not in restricted]
            final_sectors = ", ".join(parts) if parts else "NONE"

        # Prepare base row
        row = {
            "Barangay": r.barangay.upper() if r.barangay else "",
            "Purok": r.purok.upper() if r.purok else "",
            "House #": r.house_no or "",
            "Household Head": full_name.upper(),
            "Spouse": spouse_name.upper(),
            "Sex": r.sex or "",
            "Birthdate": r.birthdate.strftime('%Y-%m-%d') if r.birthdate else "",
            "Age": calculate_age(r.birthdate),
            "Civil Status": r.civil_status or "",
            "Religion": r.religion or "",
            "Occupation": r.occupation or "",
            "Precinct No": r.precinct_no or "",
            "Contact": r.contact_no or "",
            "Total Members": total_members,
            "Sectors": final_sectors, # Uses the scrubbed text
        }

        # --- DYNAMIC FAMILY MEMBERS ---
        for i in range(max_family_count):
            prefix = f"Member {i+1}"
            if i < len(r.family_members):
                fm = r.family_members[i]
                row[f"{prefix} Last Name"] = fm.last_name.upper() if fm.last_name else ""
                row[f"{prefix} First Name"] = fm.first_name.upper() if fm.first_name else ""
                row[f"{prefix} Middle Name"] = fm.middle_name.upper() if fm.middle_name else ""
                row[f"{prefix} Relationship"] = fm.relationship.upper() if fm.relationship else ""
            else:
                row[f"{prefix} Last Name"] = ""
                row[f"{prefix} First Name"] = ""
                row[f"{prefix} Middle Name"] = ""
                row[f"{prefix} Relationship"] = ""

        # --- DYNAMIC ASSISTANCE RECORDS ---
        for i in range(max_assistance_count):
            prefix = f"Asst {i+1}"
            if i < len(r.assistances):
                ast = r.assistances[i]
                
                # Format Dates Safely
                proc_date = ast.date_processed.strftime('%Y-%m-%d') if ast.date_processed else ""
                claim_date = ast.date_claimed.strftime('%Y-%m-%d') if ast.date_claimed else ""
                
                row[f"{prefix} Type"] = ast.type_of_assistance.upper() if ast.type_of_assistance else ""
                row[f"{prefix} Processed"] = proc_date
                row[f"{prefix} Claimed"] = claim_date
                row[f"{prefix} Amount"] = f"₱{ast.amount:,.2f}" if ast.amount else ""
                row[f"{prefix} Office"] = ast.implementing_office.upper() if ast.implementing_office else ""
            else:
                row[f"{prefix} Type"] = ""
                row[f"{prefix} Processed"] = ""
                row[f"{prefix} Claimed"] = ""
                row[f"{prefix} Amount"] = ""
                row[f"{prefix} Office"] = ""

        data_list.append(row)

    # Handle case with no residents
    if not data_list:
        df = pd.DataFrame(columns=["No Records Found"])
    else:
        df = pd.DataFrame(data_list)

    # 4️⃣ GENERATE FORMATTED EXCEL FILE
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        df.to_excel(writer, sheet_name="Master_List", startrow=5, index=False)

        workbook = writer.book
        worksheet = writer.sheets["Master_List"]

        # Formatting Styles
        fmt_title = workbook.add_format({
            "bold": True, "font_size": 14, "align": "center", "valign": "vcenter"
        })
        fmt_sub = workbook.add_format({
            "italic": True, "font_size": 10, "align": "center", "valign": "vcenter"
        })
        fmt_header = workbook.add_format({
            "bold": True, "bg_color": "#1e293b", "font_color": "white",
            "border": 1, "align": "center", "valign": "vcenter", "text_wrap": True
        })
        fmt_cell = workbook.add_format({
            "border": 1, "font_size": 9, "align": "left", "valign": "vcenter"
        })

        # Header Titles
        last_col_idx = len(df.columns) - 1
        last_col_letter = excel_col_letter(last_col_idx)

        worksheet.merge_range(f"A1:{last_col_letter}1", "REPUBLIC OF THE PHILIPPINES", fmt_sub)
        worksheet.merge_range(f"A2:{last_col_letter}2", "PROVINCE OF ZAMBALES", fmt_sub)
        worksheet.merge_range(f"A3:{last_col_letter}3", "MUNICIPALITY OF SAN FELIPE", fmt_title)

        # Dynamic Master List Title
        title_parts = ["MASTER LIST"]
        if filter_status == "updated": title_parts.append("UPDATED")
        if sector: title_parts.append(f"({sector.upper()})")
        if barangay_name: title_parts.append(f"- {barangay_name.upper()}")
        else: title_parts.append("- ALL BARANGAYS")
        
        worksheet.merge_range(f"A4:{last_col_letter}4", " ".join(title_parts), fmt_title)

        # Apply Header Style
        for col_num, column in enumerate(df.columns):
            worksheet.write(5, col_num, column, fmt_header)

        # Apply Cell Style and Borders
        for row_num in range(len(df)):
            for col_num in range(len(df.columns)):
                val = df.iloc[row_num, col_num]
                worksheet.write(row_num + 6, col_num, val, fmt_cell)

        # Auto Column Width
        for i, col in enumerate(df.columns):
            max_len = df[col].astype(str).map(len).max()
            worksheet.set_column(i, i, max(max_len, len(col)) + 2)

        worksheet.hide_gridlines(2)

    output.seek(0)
    return output
