import pandas as pd
from sqlalchemy.orm import Session
from models import ResidentProfile
from datetime import datetime
import io

def clean_str(val):
    if pd.isna(val) or val is None:
        return ""
    text = str(val).strip()
    if text.lower() in ['nan', 'none', 'null']:
        return ""
    return text

def parse_date(date_val):
    if pd.isna(date_val) or str(date_val).strip() == "":
        return None
    if isinstance(date_val, (pd.Timestamp, datetime)):
        return date_val.date()
    text_val = str(date_val).strip()
    if text_val.lower() in ['nan', 'none']:
        return None
    for fmt in ('%m/%d/%Y', '%Y-%m-%d', '%d-%b-%y', '%m-%d-%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(text_val, fmt).date()
        except ValueError:
            continue
    return None

def get_sectors(row):
    active_sectors = []
    # Columns to check for checkmarks/text
    possible_sectors = [
        'FARMER', 'FISHERFOLK', 'FISHERMAN/BANCA OWNER', 'TODA', 
        'BRGY BNS/BHW', 'BRGY TANOD', 'BRGY OFFICIAL', 'LGU EMPLOYEE', 
        'INDIGENOUS PEOPLE', 'PWD', 'OFW', 'STUDENT', 
        'SENIOR CITIZEN', 'LIFEGUARD', 'SOLO PARENT'
    ]
    
    # Check normalized uppercase columns
    for sector in possible_sectors:
        # We try to get the column; if missing, we skip
        val = row.get(sector) 
        if clean_str(val) != "":
            active_sectors.append(sector)

    other_val = clean_str(row.get('OTHERS'))
    other_details = None
    if other_val != "":
        active_sectors.append("Others")
        if len(other_val) > 1:
            other_details = other_val

    summary = ", ".join(active_sectors) if active_sectors else "None"
    return summary, other_details

def process_excel_import(file_content, db: Session):
    header_index = 0
    df = None
    
    # --- PHASE 1: READ THE FILE ---
    try:
        # Try as Excel
        df = pd.read_excel(file_content, header=None, dtype=str, engine='openpyxl')
    except Exception as e_xlsx:
        file_content.seek(0)
        try:
            # Try as CSV
            df = pd.read_csv(file_content, header=None, dtype=str, encoding='cp1252')
        except Exception as e_csv:
            return {"added": 0, "errors": [f"CRITICAL: Could not read file. {str(e_xlsx)}"]}

    # --- PHASE 2: FIND HEADER ROW ---
    found_header = False
    
    # Scan first 20 rows for "LAST NAME"
    for i in range(min(20, len(df))):
        # Create a clean list of values for this row
        row_values = [str(x).strip().upper() for x in df.iloc[i].values]
        
        if "LAST NAME" in row_values:
            header_index = i
            found_header = True
            
            # Reset DataFrame with this row as header
            # We explicitly set the column names from this row
            df.columns = row_values
            
            # Drop the header row and previous rows from data
            df = df.iloc[i+1:].reset_index(drop=True)
            
            # Rename duplicates (Handling the two "LAST NAME" columns)
            # Pandas does this automatically on read, but since we manually set columns,
            # we need to ensure unique names for the Spouse columns.
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
            
            break
            
    if not found_header:
        # DEBUG: Return the first few rows to see what the server sees
        preview = df.head(3).to_string()
        return {"added": 0, "errors": [f"Could not find 'LAST NAME' in first 20 rows. Preview of file content:\n{preview}"]}

    # --- PHASE 3: PROCESS DATA ---
    df = df.where(pd.notnull(df), None)
    success_count = 0
    errors = []

    for index, row in df.iterrows():
        try:
            # Strict Check
            lname = clean_str(row.get('LAST NAME'))
            if not lname:
                # Silent skip for empty rows
                continue

            # --- MAP COLUMNS ---
            resident = ResidentProfile(
                last_name=lname,
                first_name=clean_str(row.get('FIRST NAME')),
                middle_name=clean_str(row.get('MIDDLE NAME')),
                ext_name=clean_str(row.get('EXT NAME')),
                
                # Address
                house_no=clean_str(row.get('HOUSE NO. / STREET')),
                purok=clean_str(row.get('PUROK/SITIO')),
                barangay=clean_str(row.get('BARANGAY')),
                
                # Personal
                sex=clean_str(row.get('SEX')),
                birthdate=parse_date(row.get('BIRTHDATE')),
                civil_status=clean_str(row.get('CIVIL STATUS')),
                religion=clean_str(row.get('RELIGION')),
                occupation=clean_str(row.get('OCCUPATION')),
                contact_no=clean_str(row.get('CONTACT')),
                precinct_no=clean_str(row.get('PRECINT NO')),
                
                # Sectors
                # Pass the whole row so helper can find columns
                sector_summary=get_sectors(row)[0],
                other_sector_details=get_sectors(row)[1],
                
                # Spouse (Using .1 suffix for duplicates)
                spouse_last_name=clean_str(row.get('LAST NAME.1')),
                spouse_first_name=clean_str(row.get('FIRST NAME.1')),
                spouse_middle_name=clean_str(row.get('MIDDLE NAME.1')),
                spouse_ext_name=clean_str(row.get('EXT NAME.1')),
            )
            
            db.add(resident)
            success_count += 1
            
        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")

    # --- PHASE 4: FINAL CHECK ---
    if success_count == 0:
        return {
            "added": 0, 
            "errors": [
                "Header found, but no rows added.",
                f"Detected Columns: {list(df.columns)}",
                "Possible Issue: 'LAST NAME' column might be empty or misnamed."
            ]
        }

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"added": 0, "errors": [f"Database Commit Error: {str(e)}"]}
    
    return {"added": success_count, "errors": errors}