import pandas as pd
from sqlalchemy.orm import Session
from models import ResidentProfile, FamilyMember
from datetime import datetime
import io
import re

def clean_str(val):
    if pd.isna(val) or val is None:
        return ""
    text = str(val).strip()
    if text.lower() in ['nan', 'none', 'null', '0', '0.0']:
        return ""
    return text

def parse_date(date_val):
    if pd.isna(date_val) or str(date_val).strip() == "":
        return None
    
    # 1. Handle Excel/Pandas Timestamp objects
    if isinstance(date_val, (pd.Timestamp, datetime)):
        return date_val.date()

    text_val = str(date_val).strip()
    if text_val.lower() in ['nan', 'none', 'null', '-', 'na', 'n/a']:
        return None
        
    # 2. Try common formats
    formats = [
        '%m/%d/%Y', '%Y-%m-%d', '%d-%b-%y', '%m-%d-%Y', 
        '%Y/%m/%d', '%d/%m/%Y', '%B %d, %Y', '%d-%m-%Y'
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(text_val, fmt).date()
        except ValueError:
            continue
            
    return None

def get_column_value(row, col_name_start):
    """
    Finds a column that STARTS with the given name (handles newlines/spaces).
    """
    # Check exact match first
    if col_name_start in row:
        return clean_str(row[col_name_start])
        
    # Check partial match
    for col in row.index:
        col_clean = " ".join(str(col).replace('\n', ' ').split())
        if col_clean.upper().startswith(col_name_start.upper()):
            return clean_str(row[col])
            
    return ""

def get_sectors(row):
    active_sectors = []
    possible_sectors = [
        'FARMER', 'FISHERFOLK', 'FISHERMAN/BANCA OWNER', 'TODA', 
        'BRGY BNS/BHW', 'BRGY TANOD', 'BRGY OFFICIAL', 'LGU EMPLOYEE', 
        'INDIGENOUS PEOPLE', 'PWD', 'OFW', 'STUDENT', 
        'SENIOR CITIZEN', 'LIFEGUARD', 'SOLO PARENT'
    ]
    
    for sector in possible_sectors:
        val = get_column_value(row, sector)
        if val != "":
            active_sectors.append(sector)

    other_val = get_column_value(row, 'OTHERS')
    other_details = None
    if other_val != "":
        active_sectors.append("Others")
        if len(other_val) > 1:
            other_details = other_val

    summary = ", ".join(active_sectors) if active_sectors else "None"
    return summary, other_details

def process_excel_import(file_content, db: Session):
    # --- PHASE 1: READ FILE ---
    df = None
    try:
        df = pd.read_excel(file_content, header=None, dtype=str, engine='openpyxl')
    except Exception as e:
        file_content.seek(0)
        try:
            df = pd.read_csv(file_content, header=None, dtype=str, encoding='cp1252')
        except:
            return {"added": 0, "errors": [f"File Read Error: {str(e)}"]}

    # --- PHASE 2: FIND HEADER ROW ---
    header_index = -1
    for i in range(min(20, len(df))):
        # Normalize row to check for keywords
        row_values = [str(x).strip().upper() for x in df.iloc[i].values]
        # Look for BOTH 'LAST NAME' and 'FIRST NAME' to confirm it's the header
        if "LAST NAME" in row_values and "FIRST NAME" in row_values:
            header_index = i
            # Set columns
            df.columns = df.iloc[i].values
            # Clean column names (strip spaces/newlines)
            df.columns = [str(c).strip().upper() for c in df.columns]
            
            # Handle Duplicates: Pandas might have duplicates if we set columns manually like this?
            # Actually, let's force a rename to be safe like Pandas does
            new_cols = []
            seen = {}
            for c in df.columns:
                if c in seen:
                    seen[c] += 1
                    new_cols.append(f"{c}.{seen[c]}")
                else:
                    seen[c] = 0
                    new_cols.append(c)
            df.columns = new_cols
            
            # Slice data
            df = df.iloc[i+1:].reset_index(drop=True)
            break
            
    if header_index == -1:
        return {"added": 0, "errors": ["Could not find 'LAST NAME' and 'FIRST NAME' header row."]}

    # --- PHASE 3: IDENTIFY THE REAL LAST NAME COLUMN ---
    # Your file has two 'LAST NAME' columns. Col 0 is empty, Col 1 has data.
    # We check which one has more data.
    
    target_lname_col = "LAST NAME"
    
    # Check density of 'LAST NAME'
    count_ln0 = 0
    if "LAST NAME" in df.columns:
        count_ln0 = df["LAST NAME"].notna().sum()
        
    # Check density of 'LAST NAME.1'
    count_ln1 = 0
    if "LAST NAME.1" in df.columns:
        count_ln1 = df["LAST NAME.1"].notna().sum()
        
    # If the second one has more data, use it as the main Last Name
    if count_ln1 > count_ln0:
        target_lname_col = "LAST NAME.1"

    # --- PHASE 4: PROCESSING ---
    df = df.where(pd.notnull(df), None)
    success_count = 0
    errors = []

    for index, row in df.iterrows():
        try:
            # Use the "Real" Last Name column we detected
            lname = clean_str(row.get(target_lname_col))
            if not lname: continue

            # --- PARSE DATE ---
            bday = parse_date(row.get('BIRTHDATE'))

            # --- SECTORS ---
            sector_str, other_str = get_sectors(row)

            # --- CREATE RESIDENT ---
            resident = ResidentProfile(
                last_name=lname,
                first_name=clean_str(row.get('FIRST NAME')),
                middle_name=clean_str(row.get('MIDDLE NAME')),
                ext_name=clean_str(row.get('EXT NAME')),
                
                house_no=clean_str(row.get('HOUSE NO. / STREET')),
                purok=clean_str(row.get('PUROK/SITIO') or row.get('PUROK')), # Handle variation
                barangay=clean_str(row.get('BARANGAY')),
                
                sex=clean_str(row.get('SEX')),
                birthdate=bday,
                civil_status=clean_str(row.get('CIVIL STATUS')),
                religion=clean_str(row.get('RELIGION')),
                occupation=clean_str(row.get('OCCUPATION')),
                contact_no=clean_str(row.get('CONTACT') or row.get('CONTACT NUMBER')),
                precinct_no=clean_str(row.get('PRECINT NO') or row.get('PRECINCT NO')),
                
                sector_summary=sector_str,
                other_sector_details=other_str,
                
                # Spouse often appears after the duplicate header section in some files
                # We try both LAST NAME.1 (if that wasn't the main one) or checking specific spouse columns
                # For safety, let's look for explicit 'SPOUSE/PARTNER' column if it exists, or fallbacks
                spouse_last_name=clean_str(row.get('LAST NAME.1')) if target_lname_col == 'LAST NAME' else clean_str(row.get('LAST NAME.2')),
                spouse_first_name=clean_str(row.get('FIRST NAME.1')),
                spouse_middle_name=clean_str(row.get('MIDDLE NAME.1')),
                spouse_ext_name=clean_str(row.get('EXT NAME.1')),
            )
            
            # --- PROCESS FAMILY MEMBERS (1-5) ---
            for i in range(1, 6):
                fam_lname = get_column_value(row, f"{i}. LAST NAME")
                fam_fname = get_column_value(row, f"{i}. FIRST NAME")
                
                if fam_lname or fam_fname:
                    fam_mname = get_column_value(row, f"{i}. MIDDLE NAME")
                    fam_rel   = get_column_value(row, f"{i}. RELATIONSHIP")
                    
                    member = FamilyMember(
                        last_name=fam_lname,
                        first_name=fam_fname,
                        middle_name=fam_mname,
                        relationship=fam_rel
                    )
                    resident.family_members.append(member)

            db.add(resident)
            success_count += 1
            
        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"added": 0, "errors": [f"Database Error: {str(e)}"]}
    
    return {"added": success_count, "errors": errors}