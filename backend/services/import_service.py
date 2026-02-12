import pandas as pd
from sqlalchemy.orm import Session
from models import ResidentProfile
from datetime import datetime
import io

def parse_date(date_val):
    """
    Parses date strings like '09/17/1981', '1982-08-03', or Excel timestamps.
    """
    if pd.isna(date_val) or str(date_val).strip() == "":
        return None
    
    # If it's already a timestamp (Excel often does this automatically)
    if isinstance(date_val, (pd.Timestamp, datetime)):
        return date_val.date()

    text_val = str(date_val).strip()
    
    # Try different formats
    for fmt in ('%m/%d/%Y', '%Y-%m-%d', '%d-%b-%y', '%m-%d-%Y'):
        try:
            return datetime.strptime(text_val, fmt).date()
        except ValueError:
            continue
            
    return None

def process_excel_import(file_content, db: Session):
    # 1. Read File
    try:
        # Load with pandas, let it handle duplicate columns (it adds .1, .2 suffixes)
        df = pd.read_excel(file_content, dtype=str, engine='openpyxl')
    except:
        file_content.seek(0)
        # fallback to csv if excel fails
        df = pd.read_csv(file_content, dtype=str, encoding='cp1252')

    # 2. Clean Data
    df = df.where(pd.notnull(df), None)
    
    # Normalize headers to UPPERCASE to be safe
    df.columns = df.columns.str.strip().str.upper()
    
    success_count = 0
    errors = []

    # 3. Iterate
    for index, row in df.iterrows():
        try:
            # Check for REQUIRED field (Last Name)
            # Use 'LAST NAME' directly from your file
            lname = row.get('LAST NAME')
            if not lname:
                continue

            # --- PERSONAL INFO ---
            fname = row.get('FIRST NAME')
            mname = row.get('MIDDLE NAME')
            ext   = row.get('EXT NAME')
            
            # --- SPOUSE INFO ---
            # Pandas renames the *second* "LAST NAME" column (for spouse) to "LAST NAME.1"
            spouse_lname  = row.get('LAST NAME.1') 
            spouse_fname  = row.get('FIRST NAME.1')
            spouse_mname  = row.get('MIDDLE NAME.1')
            spouse_ext    = row.get('EXT NAME.1')

            # --- BIRTHDATE PARSING ---
            bdate_raw = row.get('BIRTHDATE')
            birthdate = parse_date(bdate_raw)

            # --- CREATE RECORD ---
            resident = ResidentProfile(
                last_name=lname,
                first_name=fname,
                middle_name=mname,
                ext_name=ext,
                
                # Address (Mapped from your specific file headers)
                house_no=str(row.get('HOUSE NO. / STREET', '')),
                purok=row.get('PUROK/SITIO', ''),
                barangay=row.get('BARANGAY', ''),
                
                # Personal
                sex=row.get('SEX'),
                birthdate=birthdate,
                civil_status=row.get('CIVIL STATUS'),
                religion=row.get('RELIGION'),
                occupation=row.get('OCCUPATION'),
                contact_no=str(row.get('CONTACT', '')),
                precinct_no=str(row.get('PRECINT NO', '')),
                
                # Sectors
                sector_summary=row.get('SECTOR'), # Or check the specific boolean columns if needed
                
                # Spouse
                spouse_last_name=spouse_lname,
                spouse_first_name=spouse_fname,
                spouse_middle_name=spouse_mname,
                spouse_ext_name=spouse_ext,
            )
            
            db.add(resident)
            success_count += 1
            
        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")

    db.commit()
    
    return {"added": success_count, "errors": errors}