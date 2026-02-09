from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from fastapi.middleware.cors import CORSMiddleware

# Authentication Imports
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta

import models, schemas, crud
from database import engine, get_db

# Create Tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="San Felipe Residential Profile Form")

# CORS Config
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SECURITY CONFIGURATION
SECRET_KEY = "thesis-super-secret-key-change-me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 # Extended to 1 hour for convenience

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
        # Decode the token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    # Check if user exists in DB
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# --- LOGIN ENDPOINT ---
@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. Check User
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    
    # 2. Check Password
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. Create Token with ROLE included
    access_token = create_access_token(
        data={
            "sub": user.username, 
            "role": user.role 
        }
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

# --- PROTECTED API ENDPOINTS ---

# 1. CREATE RESIDENT (Locked)
@app.post("/residents/", response_model=schemas.Resident)
def create_resident(
    resident: schemas.ResidentCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # <--- LOCK ADDED
):
    return crud.create_resident(db=db, resident=resident)

# 2. READ ALL RESIDENTS (Locked)
@app.get("/residents/", response_model=List[schemas.Resident])
def read_residents(
    skip: int = 0, 
    limit: int = 100, 
    search: str = None, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # <--- LOCK ADDED
):
    return crud.get_residents(db, skip=skip, limit=limit, search=search)

# 3. READ ONE RESIDENT (Locked)
@app.get("/residents/{resident_id}", response_model=schemas.Resident)
def read_resident(
    resident_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # <--- LOCK ADDED
):
    db_resident = crud.get_resident(db, resident_id=resident_id)
    if db_resident is None:
        raise HTTPException(status_code=404, detail="Resident not found")
    return db_resident

# 4. DELETE RESIDENT (Locked + Admin Only)
@app.delete("/residents/{resident_id}", response_model=schemas.Resident)
def delete_resident(
    resident_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # <--- LOCK ADDED
):
    # ADMIN CHECK
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403, 
            detail="Access Denied: Only Admins can delete records."
        )

    db_resident = crud.delete_resident(db, resident_id=resident_id)
    if db_resident is None:
        raise HTTPException(status_code=404, detail="Resident not found")
    return db_resident

# --- REFERENCE DATA ENDPOINTS ---
# (We lock these too so only logged-in users can fetch them)

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