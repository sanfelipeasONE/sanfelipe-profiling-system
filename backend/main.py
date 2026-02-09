from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from fastapi.middleware.cors import CORSMiddleware

import models, schemas, crud
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="San Felipe Residential Profile Form")

# CORS
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

# --- API Endpoints ---
@app.post("/residents/", response_model=schemas.Resident)
def create_resident(resident: schemas.ResidentCreate, db: Session = Depends(get_db)):
    """Create a new Resident Profile (Family Head) + Family Members"""
    return crud.create_resident(db=db, resident=resident)

@app.get("/residents/", response_model=List[schemas.Resident])
def read_residents(skip: int = 0, limit: int = 100, search: str = None, db: Session = Depends(get_db)):
    """Get all residents (with pagination and optional search)"""
    residents = crud.get_residents(db, skip=skip, limit=limit, search=search)
    return residents

@app.get("/residents/{resident_id}", response_model=schemas.Resident)
def read_resident(resident_id: int, db: Session = Depends(get_db)):
    """Get specific resident by ID"""
    db_resident = crud.get_resident(db, resident_id=resident_id)
    if db_resident is None:
        raise HTTPException(status_code=404, detail="Resident not found")
    return db_resident

@app.delete("/residents/{resident_id}", response_model=schemas.Resident)
def delete_resident(resident_id: int, db: Session = Depends(get_db)):
    """Soft delete a resident"""
    db_resident = crud.delete_resident(db, resident_id=resident_id)
    if db_resident is None:
        raise HTTPException(status_code=404, detail="Resident not found")
    return db_resident

@app.get("/barangays/", response_model=List[schemas.Barangay])
def get_barangays(db: Session = Depends(get_db)):
    return db.query(models.Barangay).all()

@app.get("/puroks/", response_model=List[schemas.Purok])
def get_puroks(db: Session = Depends(get_db)):
    return db.query(models.Purok).all()

@app.get("/relationships/", response_model=List[schemas.Relationship])
def get_relationships(db: Session = Depends(get_db)):
    return db.query(models.Relationship).all()

@app.get("/sectors/", response_model=List[schemas.Sector])
def get_sectors(db: Session = Depends(get_db)):
    return db.query(models.Sector).all()