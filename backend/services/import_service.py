import pandas as pd
from sqlalchemy.orm import Session
from models import ResidentProfile
from datetime import date, timedelta
import re

def parse_full_name(full_name):
    """
    Parses "DELA CRUZ, JUAN A. JR" into (Last, First, Middle, Ext)
    """
    if not full_name or pd.isna(full_name) or str(full_name).strip() == "":
        return None, None, None, None

    # 1. Split Last Name (Everything before the comma)
    parts = str(full_name).split(',')
    last_name = parts[0].strip()
    
    if len(parts) < 2:
        return last_name, "", "", ""

    # 2. Process the rest (First + Middle + Ext)
    rest = parts[1].strip()
    
    # 3. Extract Extension (Jr, Sr, III)
    ext_name = ""
    suffixes = ['JR', 'SR', 'II', 'III', 'IV', 'V', 'JR.', 'SR.']
    
    # Check if string ends with a suffix
    upper_rest = rest.upper()
    for s in suffixes:
        # Check for word boundary to avoid matching "MARIA" as "IA"
        if upper_rest.endswith(f" {s}") or upper_rest == s:
            ext_name = s.replace('.', '') # Clean up dot
            rest = rest[:-(len(s)+1)].strip() # Remove suffix from name
            break

    # 4. Extract Middle Initial (Assuming it's the last character(s))
    # Logic: Look for last word. If it's 1-2 chars (like "G." or "A"), assume Middle
    middle_name = ""
    name_tokens = rest.split()
    
    if len(name_tokens) > 1:
        possible_mi = name_tokens[-1]
        # If it looks like an initial (1 char, or 2 chars ending in dot)
        if len(possible_mi) == 1 or (len(possible_mi) == 2 and possible_mi.endswith('.')):
            middle_name = possible_mi.replace('.', '')
            first_name = " ".join(name_tokens[:-1])
        else:
            first_name = rest
    else:
        first_name = rest

    return last_name, first_name, middle_name, ext_name

def estimate_birthdate(age):
    """
    Estimates birthdate based on Age (defaults to January 1st of calculated year)
    """
    if not age or pd.isna(age):
        return None
    try:
        age_int = int(age)
        current_year = date.today().year
        birth_year = current_year - age_int
        return date(birth_year, 1, 1) # Default to Jan 1st
    except:
        return None

def process_excel_import(file_content, db: Session):
    # Determine if we are dealing with a CSV or Excel based on content
    # Note: file_content is a BytesIO object here
    
    try:
        # Try reading as Excel (.xlsx) explicitly
        # engine='openpyxl' ensures we use the correct library
        df = pd.read_excel(file_content, dtype=str, engine='openpyxl')
    except Exception as e_xlsx:
        # If Excel fails, reset cursor and try CSV with robust encoding
        file_content.seek(0)
        try:
            # use 'latin1' or 'cp1252' which tolerates more characters than utf-8
            df = pd.read_csv(file_content, dtype=str, encoding='cp1252')
        except Exception as e_csv:
            # If both fail, return the REAL Excel error to help debug
            return {"added": 0, "errors": [f"File read error: Is 'openpyxl' installed? Original Error: {str(e_xlsx)}"]}

    # Clean 'nan' strings
    df = df.where(pd.notnull(df), None)
    
    success_count = 0
    errors = []

    for index, row in df.iterrows():
        try:
            # --- 1. PARSE HOUSEHOLD HEAD ---
            # Use specific column names from your file structure
            raw_head = row.get('Household Head')
            if not raw_head: 
                continue 

            l, f, m, e = parse_full_name(raw_head)

            # --- 2. PARSE SPOUSE ---
            raw_spouse = row.get('Spouse')
            sl, sf, sm, se = parse_full_name(raw_spouse)

            # --- 3. PARSE BIRTHDATE ---
            bday = estimate_birthdate(row.get('Age'))

            # --- 4. CREATE RECORD ---
            resident = ResidentProfile(
                last_name=l,
                first_name=f,
                middle_name=m,
                ext_name=e,
                
                spouse_last_name=sl,
                spouse_first_name=sf,
                spouse_middle_name=sm,
                spouse_ext_name=se,

                barangay=row.get('Barangay', ''),
                purok=row.get('Purok', ''),
                house_no=str(row.get('House #', '')),

                sex=row.get('Sex', ''),
                civil_status=row.get('Status', ''),
                occupation=row.get('Occupation', ''),
                religion=row.get('Religion', None),
                contact_no=str(row.get('Contact', '')),
                sector_summary=row.get('Sectors', ''),
                
                birthdate=bday 
            )
            
            db.add(resident)
            success_count += 1
            
        except Exception as e:
            errors.append(f"Row {index + 2}: {str(e)}")

    db.commit()
    return {"added": success_count, "errors": errors}