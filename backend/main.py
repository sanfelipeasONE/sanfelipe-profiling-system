from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse 
from sqlalchemy.orm import Session
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

# CORS Config
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://sanfelipe-profiling-system-production.up.railway.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

# SECURITY CONFIGURATION
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key-for-dev-only") 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

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


# ==========================================
#      RESIDENT ENDPOINTS
# ==========================================

@app.post("/residents/", response_model=schemas.Resident)
def create_resident(
    resident: schemas.ResidentCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.create_resident(db=db, resident=resident)

@app.get("/residents/", response_model=List[schemas.Resident])
def read_residents(
    skip: int = 0, 
    limit: int = 100, 
    search: str = None, 
    barangay: str = Query(None), 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # --- DATA ISOLATION LOGIC ---
    if current_user.role != "admin":
        # If not an admin, force the barangay filter to match the user's username
        # (Assuming username 'rosete' matches the barangay name 'Rosete')
        # We capitalize it to match your database entries
        user_barangay = current_user.username.capitalize() 
        return crud.get_residents(db, skip=skip, limit=limit, search=search, barangay=user_barangay)

    # Admins can still use the dropdown filter or see everyone
    return crud.get_residents(db, skip=skip, limit=limit, search=search, barangay=barangay)

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
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access Denied")

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
        raise HTTPException(status_code=403, detail="Access Denied")

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
    excel_file = report_service.generate_household_excel(db, barangay_name=barangay)
    filename = f"SanFelipe_Households_{barangay if barangay else 'All'}.xlsx"
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

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
    # --- ADDED: ONLY ADMIN CAN SEE DASHBOARD STATS ---
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied to dashboard statistics")
        
    return crud.get_dashboard_stats(db)