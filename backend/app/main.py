from fastapi import FastAPI, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Union
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

from app import models, schemas, crud
from app.core.database import engine, get_db
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
    "http://127.0.0.1:5173",
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

    return db.query(models.User).filter(models.User.is_archived == False).all()

@app.delete("/users/{user_id}", status_code=200)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Only admin can delete
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete users")

    user_to_delete = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from deleting themselves
    if user_to_delete.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    # Prevent deleting last admin
    if user_to_delete.role == "admin":
        admin_count = db.query(models.User).filter(
            models.User.role == "admin"
        ).count()

        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the last administrator"
            )

    db.delete(user_to_delete)
    db.commit()

    return {"message": f"User '{user_to_delete.username}' deleted successfully"}

class UserPasswordReset(BaseModel):
    new_password: str
    
@app.put("/users/{user_id}/reset-password", status_code=200)
def reset_password(
    user_id: int,
    password_data: UserPasswordReset,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Only admin can reset
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can reset passwords")

    user_to_edit = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user_to_edit:
        raise HTTPException(status_code=404, detail="User not found")

    # Hash new password
    hashed_pw = pwd_context.hash(password_data.new_password)
    user_to_edit.hashed_password = hashed_pw

    db.commit()

    return {"message": f"Password reset for {user_to_edit.username}"}


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

    try:
        return crud.create_resident(db=db, resident=resident)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/residents/{resident_id}", response_model=schemas.Resident)
def update_resident(
    resident_id: int,
    resident: schemas.ResidentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    db_resident = crud.update_resident(
        db,
        resident_id=resident_id,
        resident_data=resident
    )

    if not db_resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    return db_resident

@app.post("/residents/{resident_id}/assistance")
def create_assistance(
    resident_id: int,
    assistance: schemas.AssistanceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    return crud.add_assistance(db, resident_id, assistance)

@app.put("/assistances/{assistance_id}")
def edit_assistance(
    assistance_id: int,
    assistance: schemas.AssistanceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403)

    result = crud.update_assistance(db, assistance_id, assistance)

    if not result:
        raise HTTPException(status_code=404, detail="Assistance not found")

    return result


@app.delete("/assistances/{assistance_id}")
def remove_assistance(
    assistance_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403)

    result = crud.delete_assistance(db, assistance_id)

    if not result:
        raise HTTPException(status_code=404, detail="Assistance not found")

    return {"message": "Assistance record deleted"}



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
    
@app.put("/residents/{resident_id}/archive")
def archive_resident(
    resident_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can archive")

    result = crud.archive_resident(db, resident_id, current_user.id)

    if not result:
        raise HTTPException(status_code=404, detail="Resident not found")

    return {"message": "Resident archived successfully"}

# ------------------------------
# PROMOTE FAMILY HEAD
# ------------------------------

@app.put("/residents/{resident_id}/promote")
def promote_family_head(
    resident_id: int,
    new_head_member_id: str,
    reason: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id
    ).first()

    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    # =====================================
    # 1️⃣ SAVE OLD HEAD FIRST
    # =====================================

    old_head_member = models.FamilyMember(
        profile_id=resident.id,
        first_name=resident.first_name,
        last_name=resident.last_name,
        middle_name=resident.middle_name,
        ext_name=resident.ext_name,
        relationship=f"Former Head ({reason})",
        birthdate=resident.birthdate,
        occupation=resident.occupation,
        is_active=False
    )

    db.add(old_head_member)

    # =====================================
    # 2️⃣ DETERMINE NEW HEAD
    # =====================================

    if new_head_member_id == "spouse":
        # Promote spouse

        if not resident.spouse_first_name:
            raise HTTPException(status_code=400, detail="No spouse to promote")

        new_first_name = resident.spouse_first_name
        new_last_name = resident.spouse_last_name
        new_middle_name = resident.spouse_middle_name
        new_ext_name = resident.spouse_ext_name

    else:
        # Promote family member

        member_id = int(new_head_member_id)

        family_member = db.query(models.FamilyMember).filter(
            models.FamilyMember.id == member_id
        ).first()

        if not family_member:
            raise HTTPException(status_code=404, detail="Family member not found")

        new_first_name = family_member.first_name
        new_last_name = family_member.last_name
        new_middle_name = family_member.middle_name
        new_ext_name = family_member.ext_name

        # REMOVE promoted member from family table
        db.delete(family_member)

    # =====================================
    # 3️⃣ OVERWRITE RESIDENT PROFILE
    # =====================================

    resident.first_name = new_first_name
    resident.last_name = new_last_name
    resident.middle_name = new_middle_name
    resident.ext_name = new_ext_name

    # CLEAR ALL PERSONAL DETAILS
    resident.birthdate = None
    resident.occupation = None
    resident.civil_status = None
    resident.religion = None
    resident.precinct_no = None
    resident.contact_no = None
    resident.other_sector_details = None
    resident.sector_summary = None

    # CLEAR SPOUSE
    resident.spouse_first_name = None
    resident.spouse_last_name = None
    resident.spouse_middle_name = None
    resident.spouse_ext_name = None

    resident.status = "Active"
    resident.is_archived = False

    db.commit()

    return {"message": "Family head successfully replaced"}

@app.put("/residents/{resident_id}/promote-spouse")
def promote_spouse_to_head(
    resident_id: int,
    reason: str,
    db: Session = Depends(get_db)
):
    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id,
        models.ResidentProfile.is_deleted == False
    ).first()

    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    if not resident.spouse_first_name:
        raise HTTPException(status_code=400, detail="No spouse to promote")

    # ==========================
    # 1️⃣ Save old head to family members
    # ==========================

    old_head_member = models.FamilyMember(
        profile_id=resident.id,
        first_name=resident.first_name,
        last_name=resident.last_name,
        middle_name=resident.middle_name,
        ext_name=resident.ext_name,
        relationship="Former Head",
        birthdate=resident.birthdate,
        occupation=resident.occupation,
        is_active=False
    )

    db.add(old_head_member)

    # ==========================
    # 2️⃣ Promote spouse into resident profile
    # ==========================

    resident.first_name = resident.spouse_first_name
    resident.last_name = resident.spouse_last_name
    resident.middle_name = resident.spouse_middle_name
    resident.ext_name = resident.spouse_ext_name

    # CLEAR spouse fields
    resident.spouse_first_name = None
    resident.spouse_last_name = None
    resident.spouse_middle_name = None
    resident.spouse_ext_name = None

    # CLEAR personal details
    resident.civil_status = None
    resident.religion = None
    resident.contact_no = None
    resident.precinct_no = None
    resident.other_sector_details = None
    resident.sector_summary = None

    resident.status = "Active"
    resident.is_archived = False

    db.commit()

    return {"message": "Spouse promoted to head successfully"}


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

@app.delete("/residents/{resident_id}/permanent")
def permanently_delete_resident(
    resident_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    result = crud.permanently_delete_resident(db, resident_id)

    if not result:
        raise HTTPException(status_code=404, detail="Resident not found")

    return {"message": "Resident permanently deleted"}

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
# Import/Export
# ---------------------------------------------------

@app.post("/import/excel")
async def import_residents_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Optional: Restrict to admin only
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can import data")

    # Validate file type
    if not file.filename.endswith((".xlsx", ".csv")):
        raise HTTPException(
            status_code=400,
            detail="Please upload an Excel (.xlsx) or CSV file."
        )

    contents = await file.read()

    try:
        result = process_excel_import(io.BytesIO(contents), db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/export/excel")
def export_residents_excel(
    barangay: str = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Restrict barangay automatically for non-admin
    target_barangay = barangay

    if current_user.role != "admin":
        official_name = BARANGAY_MAPPING.get(current_user.username.lower())

        if official_name:
            target_barangay = official_name
        else:
            target_barangay = current_user.username.replace("_", " ").title()

    try:
        excel_file = report_service.generate_household_excel(
            db,
            barangay_name=target_barangay
        )

        clean_name = (
            target_barangay.replace(" ", "_")
            if target_barangay else "All"
        )

        filename = f"SanFelipe_Households_{clean_name}.xlsx"

        return StreamingResponse(
            iter([excel_file.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/export/excel")
def export_residents_excel(
    barangay: str = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Restrict barangay automatically for non-admin
    target_barangay = barangay

    if current_user.role != "admin":
        official_name = BARANGAY_MAPPING.get(current_user.username.lower())

        if official_name:
            target_barangay = official_name
        else:
            target_barangay = current_user.username.replace("_", " ").title()

    try:
        excel_file = report_service.generate_household_excel(
            db,
            barangay_name=target_barangay
        )

        clean_name = (
            target_barangay.replace(" ", "_")
            if target_barangay else "All"
        )

        filename = f"SanFelipe_Households_{clean_name}.xlsx"

        return StreamingResponse(
            excel_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
