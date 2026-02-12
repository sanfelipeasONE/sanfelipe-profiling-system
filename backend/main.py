from fastapi import FastAPI, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse 
from sqlalchemy.orm import Session
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text, func
from services.import_service import process_excel_import
import io

# Authentication Imports
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

import models, schemas, crud
from database import engine, get_db
from services import report_service 

# Create Tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="San Felipe Residential Profile Form")

# CORS Config - Updated to match Vercel/Railway domains
origins = [
    "http://localhost:5173",
    "https://sanfelipe-profiling-system.vercel.app",
    "https://sanfelipe-profiling-system-production.up.railway.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

load_dotenv()

# SECURITY CONFIGURATION
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key-for-dev-only") 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

BARANGAY_MAPPING = {
    # username : "Official Database Spelling"
    "faranal": "Faranal",
    "rosete": "Rosete",
    "santo_nino": "Santo Niño",   # Fixes the ñ issue
    "santonino": "Santo Niño",    # Handles alternative spelling   # Handles spaces
    "amagna": "Amagna",
    "apostol": "Apostol",
    "balincaguing": "Balincaguing",
    "maloma": "Maloma",
    "sindol": "Sindol",
    "sanrafael": "San Rafael",
    "san rafael": "San Rafael",  # Handles space variation
}
# --- AUTH HELPER FUNCTIONS ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# --- LOGIN ENDPOINT ---
@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

# ==========================================
#      USER MANAGEMENT (ADMIN ONLY)
# ==========================================

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "barangay" 

class UserPasswordReset(BaseModel):
    new_password: str

@app.post("/users/", status_code=status.HTTP_201_CREATED)
def create_user(
    user: UserCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create users")

    existing_user = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_pw = pwd_context.hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_pw, role=user.role)
    
    db.add(new_user)
    db.commit()
    return {"message": f"User {user.username} created successfully"}

@app.get("/users/")
def get_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(models.User).all()

@app.put("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    password_data: UserPasswordReset,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can reset passwords")

    user_to_edit = db.query(models.User).filter(models.User.id == user_id).first()
    if not user_to_edit:
        raise HTTPException(status_code=404, detail="User not found")

    user_to_edit.hashed_password = pwd_context.hash(password_data.new_password)
    db.commit()
    
    return {"message": f"Password for {user_to_edit.username} has been reset."}

@app.delete("/users/{user_id}")
def delete_user(
    user_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete users")

    user_to_delete = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User account not found")

    if user_to_delete.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account while logged in")

    if user_to_delete.role == "admin":
        admin_count = db.query(models.User).filter(models.User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last administrator")

    try:
        db.delete(user_to_delete)
        db.commit()
        return {"message": f"User {user_to_delete.username} has been removed from the system"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete user: This account has registered residents linked to it."
        )

# ==========================================
#      RESIDENT ENDPOINTS
# ==========================================

@app.post("/residents/", response_model=schemas.Resident)
def create_resident(
    resident: schemas.ResidentCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # --- FIX: FORCE CORRECT SPELLING ---
    if current_user.role != "admin":
        # Check the map first
        official_name = BARANGAY_MAPPING.get(current_user.username.lower())
        
        if official_name:
            resident.barangay = official_name
        else:
            # Fallback for usernames not in map (e.g. new accounts)
            # Use .title() instead of .capitalize() to handle "San Felipe" correctly
            resident.barangay = current_user.username.replace("_", " ").title()

    return crud.create_resident(db=db, resident=resident)

# --- FIX: Updated schema to match 'ResidentPagination' ---
@app.get("/residents/", response_model=schemas.ResidentPagination)
def read_residents(
    skip: int = 0, 
    limit: int = 20, 
    search: str = None, 
    barangay: str = Query(None), 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    filter_barangay = barangay
    
    # --- FIX: FORCE STAFF TO SEE ONLY THEIR OFFICIAL BARANGAY ---
    if current_user.role != "admin":
        # Look up the official name from the map
        official_name = BARANGAY_MAPPING.get(current_user.username.lower())
        
        if official_name:
            filter_barangay = official_name
        else:
            # Fallback
            filter_barangay = current_user.username.replace("_", " ").title()

    # 1. Get total for pagination
    total = crud.get_resident_count(db, search=search, barangay=filter_barangay)
    
    # 2. Get the residents
    residents = crud.get_residents(db, skip=skip, limit=limit, search=search, barangay=filter_barangay)

    return {
        "items": residents,
        "total": total,
        "page": (skip // limit) + 1,
        "size": limit
    }

@app.get("/residents/{resident_id}", response_model=schemas.Resident)
def read_resident(
    resident_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_resident = crud.get_resident(db, resident_id=resident_id)
    if db_resident is None:
        raise HTTPException(status_code=404, detail="Resident not found")
    return db_resident

@app.put("/residents/{resident_id}", response_model=schemas.Resident)
def update_resident(
    resident_id: int, 
    resident: schemas.ResidentUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Allow admins OR the specific barangay staff to edit
    if current_user.role != "admin":
        # Additional safety: Check if resident belongs to this staff
        existing = crud.get_resident(db, resident_id)
        official_name = BARANGAY_MAPPING.get(current_user.username.lower(), current_user.username.replace("_", " ").title())

        if existing:
            if existing.barangay.lower() != official_name.lower():
                raise HTTPException(...)

    db_resident = crud.update_resident(db, resident_id=resident_id, resident_data=resident)
    if db_resident is None:
        raise HTTPException(status_code=404, detail="Resident not found")
    return db_resident

@app.delete("/residents/{resident_id}", response_model=schemas.Resident)
def delete_resident(
    resident_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
         # Additional safety: Check if resident belongs to this staff
        existing = crud.get_resident(db, resident_id)
        if existing and existing.barangay != current_user.username.capitalize():
            raise HTTPException(status_code=403, detail="You can only delete residents in your barangay")

    db_resident = crud.delete_resident(db, resident_id=resident_id)
    if db_resident is None:
        raise HTTPException(status_code=404, detail="Resident not found")
    return db_resident

# --- EXCEL EXPORT ENDPOINT ---
@app.get("/export/excel")
def export_residents_excel(
    barangay: str = Query(None, description="Filter by Barangay Name"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) 
):
    # 1. Initialize the target
    target_barangay = barangay

    # 2. SECURITY OVERRIDE
    if current_user.role != "admin":
        official_name = BARANGAY_MAPPING.get(current_user.username.lower())
        
        if official_name:
            target_barangay = official_name
        else:
            target_barangay = current_user.username.replace("_", " ").title()

    # 3. Generate the file
    excel_file = report_service.generate_household_excel(db, barangay_name=target_barangay)
    
    # 4. Create filename
    clean_name = target_barangay.replace(" ", "_") if target_barangay else "All"
    filename = f"SanFelipe_Households_{clean_name}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
    
# --- EXCEL IMPORT ENDPOINT ---
@app.post("/import/excel")
async def import_residents_excel(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    # Validate file type
    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.csv')):
        raise HTTPException(status_code=400, detail="Please upload an Excel (.xlsx) or CSV file.")

    contents = await file.read()
    
    # We pass the bytes to pandas
    try:
        result = process_excel_import(io.BytesIO(contents), db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- REFERENCE DATA ENDPOINTS ---
@app.get("/barangays/", response_model=List[schemas.Barangay])
def get_barangays(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Barangay).all()

@app.get("/puroks/", response_model=List[schemas.Purok])
def get_puroks(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Purok).all()

@app.get("/relationships/", response_model=List[schemas.Relationship])
def get_relationships(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Relationship).all()

@app.get("/sectors/", response_model=List[schemas.Sector])
def get_sectors(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Sector).all()

@app.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied to dashboard statistics")
        
    return crud.get_dashboard_stats(db)

# --- SYSTEM FIX ENDPOINTS (SECURED) ---
@app.get("/system/fix-ghost-records")
def fix_ghost_records(
    target_barangay: str = Query(..., description="The name of the barangay to assign records to (e.g., Faranal)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Secured!
):
    # Only Admin can run system fixes
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only Admins can perform system maintenance.")

    try:
        # Secure way to use target_barangay (Avoid SQL Injection risk)
        # Using :target bind parameter is safer than f-string
        sql = text("UPDATE resident_profiles SET barangay = :target WHERE barangay IS NULL OR barangay = 'San Felipe';")
        
        result = db.execute(sql, {"target": target_barangay})
        db.commit()
        
        return {"status": "success", "message": f"Moved ghost records to '{target_barangay}'!"}
        
    except Exception as e:
        db.rollback()
        return {"status": "error", "detail": str(e)}
        
@app.get("/debug/tables")
def debug_tables(db: Session = Depends(get_db)):
    try:
        query = text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
        result = db.execute(query).fetchall()
        tables = [row[0] for row in result]
        return {"status": "success", "tables": tables}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
    
@app.get("/debug/diagnose")
def debug_diagnose(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Check logic for the current user
    mapped_name = BARANGAY_MAPPING.get(current_user.username.lower(), "Not Found in Map")
    fallback_name = current_user.username.replace("_", " ").title()
    
    # 2. Get raw data samples (first 5 records)
    raw_residents = db.query(models.ResidentProfile).limit(5).all()
    sample_data = [{"id": r.id, "name": f"{r.first_name} {r.last_name}", "barangay_stored_in_db": r.barangay} for r in raw_residents]
    
    return {
        "WHO_YOU_ARE": {
            "username": current_user.username,
            "role": current_user.role,
            "system_thinks_your_barangay_is": mapped_name if mapped_name != "Not Found in Map" else fallback_name,
            "using_mapping": mapped_name != "Not Found in Map"
        },
        "DATABASE_CONTENT": {
            "total_records": db.query(models.ResidentProfile).count(),
            "sample_records": sample_data
        }
    }

@app.get("/debug/barangay-test")
def debug_barangay(
    barangay: str,
    db: Session = Depends(get_db)
):
    residents = db.query(models.ResidentProfile).filter(
        func.lower(models.ResidentProfile.barangay) == barangay.lower()
    ).all()

    return {
        "filter_used": barangay,
        "count_found": len(residents)
    }
