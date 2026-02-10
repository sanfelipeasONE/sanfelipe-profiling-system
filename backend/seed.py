from database import SessionLocal, engine
import models
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

# 1. SETUP
load_dotenv()
# Initialize the password context properly
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create tables if they don't exist
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

# --- DATA LISTS ---
initial_barangays = [
    "Amagna", "Apostol", "Balincaguing", "Farañal", "Feria", 
    "Manglicmot", "Rosete", "San Rafael", "Santo Niño", "Sindol", "Maloma"
]

initial_puroks = [
    "Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5", "Purok 6",
    "Purok 7", "Purok 8", "Purok 9", "Purok 10", "Purok 11", "Purok 12",
    "Purok 13", "Purok 14", "Purok 15", "Purok 16", "Purok 17", "Purok 18",
    "Purok 19", "Purok 20", "Sitio Yangil", "Sitio Sagpat", "Sitio Tektek",
    "Sitio Cabuyao", "Sitio Banawen", "Sitio Anangka", "Sitio Lubong", 
    "Sitio Cabaruan", "Sitio Liwa", "Sitio Kabwaan"
]

initial_relationships = [
    "Wife", "Husband", "Son", "Daughter", "Brother", "Sister", 
    "Mother", "Father", "Grandmother", "Grandfather", 
    "Grandson", "Granddaughter", "Live-in Partner", "Guardian"
]

initial_sectors = [
    "Indigenous People","Senior Citizen", "PWD", 
    "BRGY. Official/Employee", "OFW", "Solo Parent", "Farmers", 
    "Fisherfolk", "Fisherman/Banca Owner", "LGU Employee", 
    "TODA", "Student", "Lifeguard", "Others"
]

def seed_data():
    try:
        # --- 1. SEED BARANGAYS ---
        print("🌱 Seeding Barangays...")
        for b_name in initial_barangays:
            if not db.query(models.Barangay).filter(models.Barangay.name == b_name).first():
                db.add(models.Barangay(name=b_name))
        db.commit() # Commit after each block to save progress

        # --- 2. SEED PUROKS ---
        print("🌱 Seeding Puroks...")
        for p_name in initial_puroks:
            if not db.query(models.Purok).filter(models.Purok.name == p_name).first():
                db.add(models.Purok(name=p_name))
        db.commit()

        # --- 3. SEED RELATIONSHIPS ---
        print("🌱 Seeding Relationships...")
        for r_name in initial_relationships:
            if not db.query(models.Relationship).filter(models.Relationship.name == r_name).first():
                db.add(models.Relationship(name=r_name))
        db.commit()

        # --- 4. SEED SECTORS ---
        print("🌱 Seeding Sectors...")
        for s_name in initial_sectors:
            if not db.query(models.Sector).filter(models.Sector.name == s_name).first():
                db.add(models.Sector(name=s_name))
        db.commit()
        
        # --- 5. SEED USERS ---
        print("👤 Seeding Users...")
        
        # A. Create SUPER ADMIN
        admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")
        if not db.query(models.User).filter(models.User.username == "admin").first():
            hashed_pw = pwd_context.hash(admin_pass)
            # Ensure your models.User has a 'role' column!
            admin_user = models.User(username="admin", hashed_password=hashed_pw, role="admin")
            db.add(admin_user)
            print(f"   - Created Super Admin: 'admin' / '{admin_pass}'")
        
        # B. Create BARANGAY ACCOUNTS
        # We lowercase and remove spaces for usernames (e.g., "Santo Niño" -> "santonino")
        barangay_default_pass = "sanfelipe2026"
        
        for b_name in initial_barangays:
            # Generate clean username
            username = b_name.lower().replace(" ", "").replace(".", "").replace("ñ", "n")
            
            if not db.query(models.User).filter(models.User.username == username).first():
                hashed_pw = pwd_context.hash(barangay_default_pass)
                new_user = models.User(
                    username=username, 
                    hashed_password=hashed_pw, 
                    role="barangay" # This assigns them the restricted role
                )
                db.add(new_user)
                print(f"   - Created User: '{username}' / '{barangay_default_pass}'")

        db.commit()
        print("✅ Seeding Complete!")

    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()