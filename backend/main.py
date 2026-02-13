from fastapi import FastAPI, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text, func
from services.import_service import process_excel_import
import io

# Authentication
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

import models, schemas, crud
from database import engine, get_db
from services import report_service

# ----------------------------------------------------
# INITIAL SETUP
# ----------------------------------------------------

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="San Felipe Residential Profiling System")

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

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# ----------------------------------------------------
# AUTH HELPERS
# ----------------------------------------------------

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception

    return user

# ----------------------------------------------------
# LOGIN
# ----------------------------------------------------

@app.post("/token")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(
        models.User.username == form_data.username
    ).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token = create_access_token(
        {"sub": user.username, "role": user.role}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role
    }

# =====================================================
# RESIDENT ENDPOINTS
# =====================================================

@app.post("/residents/", response_model=schemas.Resident)
def create_resident(
    resident: schemas.ResidentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.create_resident(db, resident)

@app.get("/residents/", response_model=schemas.ResidentPagination)
def read_residents(
    skip: int = 0,
    limit: int = 20,
    search: str = None,
    barangay: str = None,
    sector: str = None,
    sort_by: str = "last_name",
    sort_order: str = "asc",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    total = crud.get_resident_count(db, search, barangay, sector)

    residents = crud.get_residents(
        db,
        skip=skip,
        limit=limit,
        search=search,
        barangay=barangay,
        sector=sector,
        sort_by=sort_by,
        sort_order=sort_order
    )

    return {
        "items": residents,
        "total": total,
        "page": (skip // limit) + 1,
        "size": limit
    }

# ----------------------------------------------------
# 🔥 STATIC ROUTES FIRST (PREVENT 422 ERROR)
# ----------------------------------------------------

@app.get("/residents/archived", response_model=List[schemas.Resident])
def get_archived_residents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    return db.query(models.ResidentProfile).filter(
        models.ResidentProfile.is_archived == True
    ).all()

@app.put("/residents/{resident_id}/archive")
def archive_resident(
    resident_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403)

    result = crud.archive_resident(db, resident_id)
    if not result:
        raise HTTPException(status_code=404, detail="Resident not found")

    return {"message": "Resident archived successfully"}

@app.put("/residents/{resident_id}/restore")
def restore_resident(
    resident_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403)

    result = crud.restore_resident(db, resident_id)
    if not result:
        raise HTTPException(status_code=404, detail="Resident not found")

    return {"message": "Resident restored successfully"}

# ----------------------------------------------------
# 🔥 DYNAMIC ROUTE LAST
# ----------------------------------------------------

@app.get("/residents/{resident_id}", response_model=schemas.Resident)
def read_resident(
    resident_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    resident = crud.get_resident(db, resident_id)
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    return resident

@app.put("/residents/{resident_id}", response_model=schemas.Resident)
def update_resident(
    resident_id: int,
    resident: schemas.ResidentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    updated = crud.update_resident(db, resident_id, resident)
    if not updated:
        raise HTTPException(status_code=404, detail="Resident not found")
    return updated

@app.delete("/residents/{resident_id}")
def delete_resident(
    resident_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    deleted = crud.delete_resident(db, resident_id)
    if not deleted:
        raise HTTPException(status_code=404)
    return {"message": "Resident deleted"}

# =====================================================
# DASHBOARD
# =====================================================

@app.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403)

    return crud.get_dashboard_stats(db)

# =====================================================
# EXCEL EXPORT
# =====================================================

@app.get("/export/excel")
def export_residents_excel(
    barangay: str = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    file = report_service.generate_household_excel(db, barangay)
    filename = "SanFelipe_Households.xlsx"

    return StreamingResponse(
        file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# =====================================================
# EXCEL IMPORT
# =====================================================

@app.post("/import/excel")
async def import_residents_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    contents = await file.read()
    result = process_excel_import(io.BytesIO(contents), db)
    return result
