from fastapi import FastAPI, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List, Union
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text, func, inspect, or_
from services.import_service import process_excel_import
import io
import qrcode
import json, zipfile
import cloudinary.uploader
from io import BytesIO

# Authentication
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os, subprocess
from dotenv import load_dotenv
from jose.exceptions import ExpiredSignatureError

from app import models, schemas, crud
from app.core.database import engine, get_db
from services import report_service

import cloudinary.uploader
from app.core.cloudinary_config import *

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
    "https://sanfelipe-profiling-system-production-13e4.up.railway.app",
    "https://sanfelipeasone.ph",
    "https://www.sanfelipeasone.ph"
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

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise ValueError("SECRET_KEY is not set. Configure it in environment variables.")

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

def rows_to_dicts(rows):
    # rows from .mappings().all() are already dict-like
    return [dict(r) for r in rows]

# ---------------------------------------------------
# SUPER ADMIN
# ---------------------------------------------------
SUPER_ADMIN_ALLOWED_SECTORS = ["HC", "C", "M"]

# ---------------------------------------------------
# AUTH HELPERS
# ---------------------------------------------------

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "type": "access"
    })

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

        if payload.get("type") != "access":
            raise credentials_exception

        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception

    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(
        models.User.username == username
    ).first()

    if user is None:
        raise credentials_exception

    return user

def create_public_unlock_token(resident_code: str):
    expire = datetime.utcnow() + timedelta(minutes=5)

    payload = {
        "sub": resident_code,
        "type": "public_unlock",
        "exp": expire,
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_public_unlock_token(token: str):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Invalid or expired unlock token"
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        if payload.get("type") != "public_unlock":
            raise credentials_exception

        resident_code = payload.get("sub")
        if not resident_code:
            raise credentials_exception

        return resident_code

    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Unlock token expired")
    except JWTError:
        raise credentials_exception

# ---------------------------------------------------
# LOGIN
# ---------------------------------------------------

@app.post("/token")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(
        models.User.username == form_data.username
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    # Check if account is locked
    if user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=403,
            detail="Account locked. Try again later."
        )

    # Check password
    if not verify_password(form_data.password, user.hashed_password):

        user.failed_attempts += 1

        # Lock after 5 failed attempts
        if user.failed_attempts >= 5:
            user.locked_until = datetime.utcnow() + timedelta(minutes=1)
            user.failed_attempts = 0

        db.commit()

        raise HTTPException(status_code=401, detail="Incorrect username or password")

    # Successful login
    user.failed_attempts = 0
    user.locked_until = None
    db.commit()

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
    role: str

@app.post("/users/")
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")

    allowed_roles = {"barangay", "admin_limited", "admin", "super_admin"}
    if user.role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Allowed: {sorted(list(allowed_roles))}")

    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed_pw = pwd_context.hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_pw, role=user.role)

    db.add(new_user)
    db.commit()
    return {"message": "User created successfully"}

@app.get("/users/")
def get_users(db: Session = Depends(get_db),
              current_user: models.User = Depends(get_current_user)):

    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access only")

    return db.query(models.User).filter(models.User.is_archived == False).all()

def require_role(required_roles: list[str]):
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action"
            )
        return current_user
    return role_checker

def require_any_role(roles: list[str]):
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Not allowed")
        return current_user
    return role_checker

def deny_roles(denied_roles: list[str]):
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role in denied_roles:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action"
            )
        return current_user
    return role_checker


@app.delete("/users/{user_id}", status_code=200)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can delete users")

    user_to_delete = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")

    if user_to_delete.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    if user_to_delete.role == "admin":
        admin_count = db.query(models.User).filter(
            models.User.role == "admin",
            models.User.is_archived == False
        ).count()

        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the last administrator"
            )

    user_to_delete.is_archived = True
    user_to_delete.archived_at = datetime.utcnow()

    db.commit()

    return {"message": f"User '{user_to_delete.username}' Delete successfully"}

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
    if current_user.role not in ["admin", "super_admin"]:
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

@app.post("/public/residents/unlock", response_model=schemas.PublicUnlockResponse)
def unlock_public_resident(
    payload: schemas.PublicUnlockRequest,
    db: Session = Depends(get_db)
):
    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.resident_code == payload.resident_code,
        models.ResidentProfile.is_deleted == False
    ).first()

    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    if not resident.birthdate:
        raise HTTPException(status_code=400, detail="Resident birthdate not available")

    if resident.birthdate != payload.birthdate:
        raise HTTPException(status_code=401, detail="Invalid birthdate")

    token = create_public_unlock_token(resident.resident_code)

    return {
        "access_token": token,
        "token_type": "bearer"
    }


# ---------------------------------------------------
# RESIDENTS
# ---------------------------------------------------

@app.post("/residents/", response_model=schemas.Resident)
def create_resident(resident: schemas.ResidentCreate,
                    db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_user)):

    if current_user.role not in ["admin", "admin_limited", "super_admin"]:
        username_lower = current_user.username.lower()
        official_name = None
        for key in BARANGAY_MAPPING:
            if key in username_lower:
                official_name = BARANGAY_MAPPING[key]
                break
        resident.barangay = official_name or current_user.username.replace("_", " ").title()
        resident.barangay_id = None

    if resident.barangay_id and not resident.barangay:
        b = db.execute(
            text("SELECT name FROM barangays WHERE id = :id"),
            {"id": resident.barangay_id}
        ).mappings().first()

        if not b:
            raise HTTPException(status_code=400, detail="Invalid barangay_id")

        resident.barangay = b["name"]

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
        
    if current_user.role not in ["admin", "admin_limited", "super_admin"]:
        username_lower = current_user.username.lower()
        official_name = None
        for key in BARANGAY_MAPPING:
            if key in username_lower:
                official_name = BARANGAY_MAPPING[key]
                break
        resident.barangay = official_name or current_user.username.replace("_", " ").title()
        resident.barangay_id = None

    if resident.barangay_id and not resident.barangay:
        b = db.execute(
            text("SELECT name FROM barangays WHERE id = :id"),
            {"id": resident.barangay_id}
        ).mappings().first()

        if not b:
            raise HTTPException(status_code=400, detail="Invalid barangay_id")

        resident.barangay = b["name"]

    try:
        db_resident = crud.update_resident(
            db,
            resident_id=resident_id,
            resident_data=resident
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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
    if current_user.role not in ["admin", "admin_limited", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    return crud.add_assistance(db, resident_id, assistance)

@app.put("/assistances/{assistance_id}")
def edit_assistance(
    assistance_id: int,
    assistance: schemas.AssistanceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "admin_limited", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not allowed")

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
    if current_user.role not in ["admin", "admin_limited", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    result = crud.delete_assistance(db, assistance_id)

    if not result:
        raise HTTPException(status_code=404, detail="Assistance not found")

    return {"message": "Assistance record deleted"}

@app.post("/residents/{resident_id}/upload-photo")
async def upload_resident_photo(
    resident_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 🔒 Allow admin, admin_limited, and barangay to upload photo
    allowed_roles = ["admin", "admin_limited", "barangay", "super_admin"]
    if current_user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not allowed")

    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.id == resident_id,
        models.ResidentProfile.is_deleted == False
    ).first()

    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            file.file,
            folder="san_felipe_residents",
            public_id=f"resident_{resident.id}",
            overwrite=True
        )

        # Save URL to database
        resident.photo_url = result["secure_url"]
        db.commit()

        return {
            "message": "Photo uploaded successfully",
            "photo_url": resident.photo_url
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------------------
# ARCHIVED ROUTE (MUST BE FIRST)
# ------------------------------

@app.get("/residents/archived")
def get_archived_residents(db: Session = Depends(get_db),
                           current_user: models.User = Depends(get_current_user)):

    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403)

    return db.query(models.ResidentProfile).filter(
        models.ResidentProfile.is_deleted == True
    ).all()
    
@app.put("/residents/{resident_id}/archive")
def archive_resident(
    resident_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(["admin", "super_admin"]))
):
    result = crud.archive_resident(db, resident_id, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Resident not found")

    return {"message": "Resident archived successfully"}

def _dump_table_if_exists(db: Session, z: zipfile.ZipFile, table_name: str):
    """Export a table as JSON into the zip if it exists."""
    insp = inspect(engine)
    tables = set(insp.get_table_names())

    if table_name not in tables:
        # skip silently but you’ll see it in manifest
        return {"table": table_name, "status": "skipped_missing", "count": 0}

    rows = db.execute(text(f"SELECT * FROM {table_name}")).mappings().all()
    data = [dict(r) for r in rows]
    z.writestr(f"{table_name}.json", json.dumps(data, default=str))
    return {"table": table_name, "status": "ok", "count": len(data)}

@app.get("/admin/backup/data")
def backup_data_zip(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"sanfelipe_backup_data_{ts}.zip"

    try:
        buf = BytesIO()
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as z:
            results = []

            # ✅ match your actual table names in models.py
            for t in [
                "resident_profiles",
                "family_members",
                "sectors",
                "resident_sectors",
                "resident_assistance",
                "barangays",
                "puroks",
                "relationships",
            ]:
                results.append(_dump_table_if_exists(db, z, t))

            # users: export WITHOUT hashed_password
            insp = inspect(engine)
            if "users" in set(insp.get_table_names()):
                users = db.execute(text("""
                    SELECT id, username, role, failed_attempts, locked_until, is_archived, archived_at
                    FROM users
                """)).mappings().all()
                z.writestr("users.json", json.dumps([dict(r) for r in users], default=str))
                results.append({"table": "users", "status": "ok", "count": len(users)})
            else:
                results.append({"table": "users", "status": "skipped_missing", "count": 0})

            manifest = {
                "generated_utc": ts,
                "tables": results
            }
            z.writestr("manifest.json", json.dumps(manifest, indent=2))

        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    except Exception as e:
        # ✅ you will now SEE the real reason (table missing, SQL error, etc.)
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")
    
@app.get("/admin/backup/photos")
def backup_photos_zip(
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        # Creates a ZIP and uploads it to your Cloudinary as a RAW asset
        # You can then download it via the returned URL
        result = cloudinary.api.create_archive(
            resource_type="image",
            type="upload",
            prefix="san_felipe_residents",  # folder name you used in upload
            target_format="zip"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Photo backup failed: {str(e)}")

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
    allowed_sectors = None

    if current_user.role not in ["admin", "admin_limited", "super_admin"]:
        username_lower = current_user.username.lower()
        official_name = None
        for key in BARANGAY_MAPPING:
            if key in username_lower:
                official_name = BARANGAY_MAPPING[key]
                break
        filter_barangay = official_name or current_user.username.replace("_", " ").title()

    total = crud.get_resident_count(
        db,
        search=search,
        barangay=filter_barangay,
        sector=sector,
        allowed_sector_names=allowed_sectors
    )

    residents = crud.get_residents(
        db,
        skip=skip,
        limit=limit,
        search=search,
        barangay=filter_barangay,
        sector=sector,
        sort_by=sort_by,
        sort_order=sort_order,
        allowed_sector_names=allowed_sectors
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

@app.get("/residents/code/{resident_code}/qr")
def generate_resident_qr(
    resident_code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # ✅ Restrict to admin only
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")

    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.resident_code == resident_code,
        models.ResidentProfile.is_deleted == False
    ).first()

    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    qr = qrcode.make(resident.resident_code)

    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    buffer.seek(0)

    return StreamingResponse(buffer, media_type="image/png")

@app.get("/residents/code/{resident_code}", response_model=schemas.Resident)
def get_resident_by_code(
    resident_code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access only")

    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.resident_code == resident_code,
        models.ResidentProfile.is_deleted == False
    ).first()

    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    return resident

@app.get("/public/residents/code/{resident_code}/qr")
def get_public_resident_qr(
    resident_code: str,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    unlocked_code = verify_public_unlock_token(token)

    if unlocked_code != resident_code:
        raise HTTPException(status_code=403, detail="Token does not match resident")

    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.resident_code == resident_code,
        models.ResidentProfile.is_deleted == False,
        models.ResidentProfile.is_active == True
    ).first()

    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    qr = qrcode.make(resident.resident_code)

    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    buffer.seek(0)

    return StreamingResponse(buffer, media_type="image/png")

@app.get("/public/residents/code/{resident_code}", response_model=schemas.PublicResidentListItem)
def get_public_resident_by_code(
    resident_code: str,
    db: Session = Depends(get_db)
):
    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.resident_code == resident_code,
        models.ResidentProfile.is_deleted == False,
        models.ResidentProfile.is_active == True
    ).first()

    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    return resident

@app.get("/public/residents/code/{resident_code}/card", response_model=schemas.PublicResident)
def get_public_resident_card(
    resident_code: str,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    unlocked_code = verify_public_unlock_token(token)

    if unlocked_code != resident_code:
        raise HTTPException(status_code=403, detail="Token does not match resident")

    resident = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.resident_code == resident_code,
        models.ResidentProfile.is_deleted == False,
        models.ResidentProfile.is_active == True
    ).first()

    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")

    return resident

@app.get("/public/residents/search", response_model=list[schemas.PublicResidentListItem])
def public_search_residents(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    search = q.strip()

    residents = db.query(models.ResidentProfile).filter(
        models.ResidentProfile.is_deleted == False,
        models.ResidentProfile.is_active == True,
        models.ResidentProfile.updated_at.isnot(None),
        models.ResidentProfile.created_at.isnot(None),
        models.ResidentProfile.updated_at > models.ResidentProfile.created_at,
        or_(
            models.ResidentProfile.last_name.ilike(f"%{search}%"),
            models.ResidentProfile.first_name.ilike(f"%{search}%"),
            models.ResidentProfile.resident_code.ilike(f"%{search}%"),
            func.concat(
                func.coalesce(models.ResidentProfile.last_name, ""), " ",
                func.coalesce(models.ResidentProfile.first_name, "")
            ).ilike(f"%{search}%"),
            func.concat(
                func.coalesce(models.ResidentProfile.first_name, ""), " ",
                func.coalesce(models.ResidentProfile.last_name, "")
            ).ilike(f"%{search}%"),
        )
    ).order_by(
        func.upper(models.ResidentProfile.last_name).asc(),
        func.upper(models.ResidentProfile.first_name).asc()
    ).limit(30).all()

    return residents

@app.delete("/residents/{resident_id}")
def soft_delete_resident(
    resident_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_role(["admin", "super_admin"]))):

    result = crud.soft_delete_resident(db, resident_id)
    if not result:
        raise HTTPException(status_code=404)

    return {"message": "Resident archived"}

@app.delete("/residents/{resident_id}/permanent")
def permanently_delete_resident(
    resident_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_role(["admin", "super_admin"]))
):

    result = crud.permanently_delete_resident(db, resident_id)

    if not result:
        raise HTTPException(status_code=404, detail="Resident not found")

    return {"message": "Resident permanently deleted"}

# ---------------------------------------------------
# RESTORE
# ---------------------------------------------------

@app.put("/residents/{resident_id}/restore")
def restore_resident(
    resident_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_role(["admin", "super_admin"]))
):
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

    if current_user.role not in ["admin", "admin_limited", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    stats = crud.get_dashboard_stats(db)

    if current_user.role != "super_admin":
        hidden_sector_names = {"HC", "C", "M"}

        stats["population_by_sector"] = {
            k: v
            for k, v in (stats.get("population_by_sector") or {}).items()
            if str(k).strip().upper() not in hidden_sector_names
        }

    return stats

# ---------------------------------------------------
# Import/Export
# ---------------------------------------------------

@app.get("/export/excel")
def export_residents_excel(
    barangay: str = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Restrict barangay automatically for non-admin
    target_barangay = barangay

    if current_user.role not in ["admin", "admin_limited", "super_admin"]:
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

    if current_user.role not in ["admin", "admin_limited", "super_admin"]:
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

        filename = f"SanFelipe_Residents_{clean_name}.xlsx"

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
def get_sectors(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Sector)

    restricted_sector_names = ["HC", "C", "M"]

    # Only super_admin can see HC, C, M
    if current_user.role != "super_admin":
        query = query.filter(
            ~func.upper(func.trim(models.Sector.name)).in_(restricted_sector_names)
        )

    return query.order_by(func.upper(models.Sector.name).asc()).all()

@app.get("/relationships/")
def get_relationships(db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    return db.query(models.Relationship).all()

@app.get("/barangays")
def get_barangays(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT id, name FROM barangays ORDER BY name")).mappings().all()
    return rows

@app.get("/barangays/{barangay_id}/areas")
def get_barangay_areas(barangay_id: int, db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT id, name, area_type, parent_purok
        FROM barangay_areas
        WHERE barangay_id = :bid
        ORDER BY
          CASE WHEN area_type='PUROK' THEN 0 ELSE 1 END,
          CASE
            WHEN name ILIKE 'PUROK %'
              THEN NULLIF(regexp_replace(name, '[^0-9]', '', 'g'), '')::int
            ELSE NULL
          END,
          name
    """), {"bid": barangay_id}).mappings().all()

    return rows

@app.get("/barangays/by-name/{barangay_name}/areas")
def get_areas_by_name(barangay_name: str, db: Session = Depends(get_db)):
    b = db.execute(text("SELECT id FROM barangays WHERE LOWER(name)=LOWER(:n)"),
                   {"n": barangay_name}).mappings().first()
    if not b:
        raise HTTPException(status_code=404, detail="Barangay not found")

    rows = db.execute(text("""
        SELECT id, name, area_type, parent_purok
        FROM barangay_areas
        WHERE barangay_id = :bid
        ORDER BY CASE WHEN area_type='PUROK' THEN 0 ELSE 1 END, name
    """), {"bid": b["id"]}).mappings().all()

    return rows

@app.get("/me")
def get_me(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    barangay_name = None

    if current_user.role not in ["admin", "admin_limited", "super_admin"]:
        username_lower = current_user.username.lower()
        official_name = None
        for key in BARANGAY_MAPPING:
            if key in username_lower:
                official_name = BARANGAY_MAPPING[key]
                break
        barangay_name = official_name or current_user.username.replace("_", " ").title()
    barangay_id = None
    if barangay_name:
        row = db.execute(
            text("SELECT id, name FROM barangays WHERE LOWER(name)=LOWER(:n) LIMIT 1"),
            {"n": barangay_name}
        ).mappings().first()

        if row:
            barangay_id = row["id"]
            barangay_name = row["name"]

    return {
        "username": current_user.username,
        "role": current_user.role,
        "barangay_id": barangay_id,
        "barangay": barangay_name
    }
    
# ---------------------------------------------------
# Permanent Delete Users
# ---------------------------------------------------
@app.delete("/users/{user_id}/permanent", status_code=200)
def permanently_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can permanently delete users")

    user_to_delete = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")

    if user_to_delete.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot permanently delete your own account")

    db.execute(
        text("DELETE FROM audit_logs WHERE user_id = :user_id"),
        {"user_id": user_id}
    )

    db.delete(user_to_delete)
    db.commit()

    return {"message": f"User '{user_to_delete.username}' permanently deleted"}