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

# ---------------------------------------------------
# INITIALIZE APP
# ---------------------------------------------------

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="San Felipe Residential Profile Form")

# ---------------------------------------------------
# CORS
# ---------------------------------------------------

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

# ---------------------------------------------------
# SECURITY
# ---------------------------------------------------

SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key-for-dev-only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# ---------------------------------------------------
# BARANGAY MAPPING
# ---------------------------------------------------

BARANGAY_MAPPING = {
    "faranal": "FARAÑAL",
    "santo_nino": "STO NIÑO",
    "santonino": "STO NIÑO",
    "sto_nino": "STO NIÑO",
    "sto nino": "STO NIÑO",
    "sto niño": "STO NIÑO",
    "santo nino": "STO NIÑO",
    "santo niño": "STO NIÑO",
    "rosete": "ROSETE",
    "amagna": "AMAGNA",
    "apostol": "APOSTOL",
    "balincaguing": "BALINCAGUING",
    "maloma": "MALOMA",
    "sindol": "SINDOL",
    "sanrafael": "SAN RAFAEL",
    "san rafael": "SAN RAFAEL",
}

# ---------------------------------------------------
# AUTH HELPERS
# ---------------------------------------------------

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme),
                           db: Session = Depends(get_db)):

    credentials_exception = HTTPException(
        status_code=401,
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

# ---------------------------------------------------
# LOGIN
# ---------------------------------------------------

@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(get_db)):

    user = db.query(models.User).filter(
        models.User.username == form_data.username
    ).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role
    }

# ---------------------------------------------------
# USER MANAGEMENT
# ---------------------------------------------------

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "barangay"

@app.post("/users/")
def create_user(user: UserCreate,
                db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):

    if current_user.role != "admin":
        raise HTTPException(status_code=403)

    existing = db.query(models.User).filter(
        models.User.username == user.username
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed_pw = pwd_context.hash(user.password)
    new_user = models.User(
        username=user.username,
        hashed_password=hashed_pw,
        role=user.role
    )

    db.add(new_user)
    db.commit()

    return {"message": "User created successfully"}

@app.get("/users/")
def get_users(db: Session = Depends(get_db),
              current_user: models.User = Depends(get_current_user)):

    if current_user.role != "admin":
        raise HTTPException(status_code=403)

    return db.query(models.User).all()

# ---------------------------------------------------
# RESIDENTS
# ---------------------------------------------------

@app.post("/residents/", response_model=schemas.Resident)
def create_resident(resident: schemas.ResidentCreate,
                    db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_user)):

    if current_user.role != "admin":
        username_lower = current_user.username.lower()
        official_name = None
        for key in BARANGAY_MAPPING:
            if key in username_lower:
                official_name = BARANGAY_MAPPING[key]
                break
        resident.barangay = official_name or current_user.username.replace("_", " ").title()

    return crud.create_resident(db=db, resident=resident)

# ------------------------------
# ARCHIVED ROUTE (MUST BE FIRST)
# ------------------------------

@app.get("/residents/archived")
def get_archived_residents(db: Session = Depends(get_db),
                           current_user: models.User = Depends(get_current_user)):

    if current_user.role != "admin":
        raise HTTPException(status_code=403)

    return db.query(models.ResidentProfile).filter(
        models.ResidentProfile.is_deleted == True
    ).all()

# ------------------------------
# LIST RESIDENTS
# ------------------------------

@app.get("/residents/", response_model=schemas.ResidentPagination)
def read_residents(skip: int = 0,
                   limit: int = 20,
                   search: str = None,
                   barangay: str = Query(None),
                   sector: str = Query(None),
                   sort_by: str = Query("last_name"),
                   sort_order: str = Query("asc"),
                   db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):

    filter_barangay = barangay

    if current_user.role != "admin":
        username_lower = current_user.username.lower()
        official_name = None
        for key in BARANGAY_MAPPING:
            if key in username_lower:
                official_name = BARANGAY_MAPPING[key]
                break
        filter_barangay = official_name or current_user.username.replace("_", " ").title()

    total = crud.get_resident_count(db, search, filter_barangay, sector)

    residents = crud.get_residents(
        db, skip, limit, search, filter_barangay, sector,
        sort_by=sort_by, sort_order=sort_order
    )

    return {
        "items": residents,
        "total": total,
        "page": (skip // limit) + 1,
        "size": limit
    }

@app.get("/residents/{resident_id}", response_model=schemas.Resident)
def read_resident(resident_id: int,
                  db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):

    resident = crud.get_resident(db, resident_id)
    if not resident:
        raise HTTPException(status_code=404)

    return resident

@app.delete("/residents/{resident_id}")
def soft_delete_resident(resident_id: int,
                         db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_user)):

    result = crud.soft_delete_resident(db, resident_id)
    if not result:
        raise HTTPException(status_code=404)

    return {"message": "Resident archived"}

# ---------------------------------------------------
# RESTORE
# ---------------------------------------------------

@app.put("/residents/{resident_id}/restore")
def restore_resident(resident_id: int,
                     db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):

    if current_user.role != "admin":
        raise HTTPException(status_code=403)

    result = crud.restore_resident(db, resident_id)
    if not result:
        raise HTTPException(status_code=404)

    return {"message": "Resident restored"}

# ---------------------------------------------------
# DASHBOARD
# ---------------------------------------------------

@app.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_stats(db: Session = Depends(get_db),
              current_user: models.User = Depends(get_current_user)):

    if current_user.role != "admin":
        raise HTTPException(status_code=403)

    return crud.get_dashboard_stats(db)

# ---------------------------------------------------
# REFERENCE DATA
# ---------------------------------------------------

@app.get("/barangays/")
def get_barangays(db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    return db.query(models.Barangay).all()

@app.get("/puroks/")
def get_puroks(db: Session = Depends(get_db),
               current_user: models.User = Depends(get_current_user)):
    return db.query(models.Purok).all()

@app.get("/sectors/")
def get_sectors(db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    return db.query(models.Sector).all()

@app.get("/relationships/")
def get_relationships(db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    return db.query(models.Relationship).all()
