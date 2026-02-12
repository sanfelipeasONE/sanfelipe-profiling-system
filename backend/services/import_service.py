import pandas as pd
from sqlalchemy.orm import Session
from models import ResidentProfile
from datetime import datetime
import io

def parse_date(date_val):
    if pd.isna(date_val) or str(date_val).strip() == "":
        return None
    
    # Handle Excel Timestamps
    if isinstance(date_val, (pd.Timestamp, datetime)):
        return date_val.date()

    text_val = str(date_val).strip()
    
    # Try multiple date formats
    for fmt in ('%m/%d/%Y', '%Y-%m-%d', '%d-%b-%y', '%m-%d-%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(text_val, fmt).date()
        except ValueError:
            continue
    return None

def process_excel_import(file_content, db: Session):
    # 1. Read File (Robust Method)
    try:
        # Try Excel first
        df = pd.read_excel(file_content, dtype=str, engine='openpyxl')
    except Exception as e_xlsx:
        file_content.seek(0)
        try:
            # Fallback to CSV
            df = pd.read_csv(file_content, dtype=str, encoding='cp1252')
        except Exception as e_csv:
            return {"added": 0, "errors": [f"Could not read file. Error: {str(e_xlsx)}"]}

    # 2. Clean Data
    df = df.where(pd.notnull(df), None)
    
    # Normalize headers to UPPERCASE and Strip spaces
    df.columns = df.columns.str.strip().str.upper()
    
    success_count = 0
    errors = []

    # 3. Iterate Rows
    for index, row in df.iterrows():
        try:
            # Required Field Check
            lname = row.get('LAST NAME')
            if not lname:
                continue

            # --- PARSE PERSONAL ---
            # Use .get() with default to prevent KeyErrors
            fname = row.get('FIRST NAME', '')
            mname = row.get('MIDDLE NAME', '')
            ext   = row.get('EXT NAME', '')
            
            # --- PARSE SPOUSE ---
            # Pandas renames duplicates to .1, .2. We check safely.
            spouse_lname  = row.get('LAST NAME.1', '') 
            spouse_fname  = row.get('FIRST NAME.1', '')
            spouse_mname  = row.get('MIDDLE NAME.1', '')
            spouse_ext    = row.get('EXT NAME.1', '')

            # --- PARSE DATE ---
            birthdate = parse_date(row.get('BIRTHDATE'))

            # --- CREATE OBJECT ---
            resident = ResidentProfile(
                last_name=str(lname),
                first_name=str(fname),
                middle_name=str(mname),
                ext_name=str(ext),
                
                # Address
                house_no=str(row.get('HOUSE NO. / STREET', '')),
                purok=str(row.get('PUROK/SITIO', '')),
                barangay=str(row.get('BARANGAY', '')),
                
                # Personal
                sex=str(row.get('SEX', '')),
                birthdate=birthdate,
                civil_status=str(row.get('CIVIL STATUS', '')),
                religion=str(row.get('RELIGION', '')),
                occupation=str(row.get('OCCUPATION', '')),
                contact_no=str(row.get('CONTACT', '')),
                precinct_no=str(row.get('PRECINT NO', '')),
                
                # Sectors
                sector_summary=str(row.get('SECTOR', '')),
                
                # Spouse
                spouse_last_name=str(spouse_lname),
                spouse_first_name=str(spouse_fname),
                spouse_middle_name=str(spouse_mname),
                spouse_ext_name=str(spouse_ext),
            )
            
            db.add(resident)
            success_count += 1
            
        except Exception as e:
            errors.append(f"Row {index + 2} Skipped: {str(e)}")

    # 4. SAFE COMMIT
    # This detects if the database rejects the data (e.g., duplicates)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"added": 0, "errors": [f"Database Save Error: {str(e)}"]}
    
    return {"added": success_count, "errors": errors}