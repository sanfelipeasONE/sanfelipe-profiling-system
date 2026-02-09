
from database import SessionLocal, engine
import models

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Define Initial Base
initial_barangays = [
    "Amagna", "Apostol", "Balincaguing", "Farañal", "Feria", 
    "Manglicmot", "Rosete", "San Rafael", "Santo Niño", "Sindol", "Maloma"
]

inital_puroks = [
    "Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5", "Purok 6",
    "Purok 7", "Purok 8", "Purok 9", "Purok 10", "Purok 11", "Purok 12",
    "Purok 13", "Purok 14", "Purok 15", "Purok 16", "Purok 17", "Purok 18",
    "Purok 19", "Purok 20", "Sitio Yangil", "Sitio Sagpat", "Sitio Tektek",
    "Sitio Cabuyao", "Sitio Banawen", "Sitio Anangka", "Sitio Lubong", "Sitio Cabaruan",
    "Sitio Liwa", "Sitio Kabwaan"
]

initial_relationships = [
    "Wife", "Husband", "Son", "Daughter", 
    "Brother", "Sister", "Mother", "Father",
    "Grandmother", "Grandfather", "Grandson", "Granddaughter",
    "Live-in Partner", "Guardian"
]

initial_sectors = [
    "Indigenous People",
    "Senior Citizen",
    "PWD",
    "BRGY. Official/Employee",
    "OFW",
    "Solo Parent",
    "Farmers",
    "Fisherfolk",
    "Fisherman/Banca Owner",
    "LGU Employee",
    "TODA",
    "Student",
    "Lifeguard",
    "Others"
]

# Seeding data
def seed_data():
    # Seed Barangays
    print("Seeding Barangays...")
    for b_name in initial_barangays:
        exists = db.query(models.Barangay).filter_by(name=b_name).first()
        if not exists:
            db.add(models.Barangay(name=b_name))
            print(f" - Added {b_name}")
    
    # Seed Puroks
    print("Seeding Puroks...")
    for p_name in inital_puroks:
        exists = db.query(models.Purok).filter_by(name=p_name).first()
        if not exists:
            db.add(models.Purok(name=p_name))
            print(f" - Added {p_name}")
    
    # Seed Relationships
    print("Seeding Relationships...")
    for r_name in initial_relationships:
        exists = db.query(models.Relationship).filter_by(name=r_name).first()
        if not exists:
            db.add(models.Relationship(name=r_name))
            print(f" - Added {r_name}")
    
    db.commit()
    print("Seeding completed!")
    db.close()
    
    # Seed Sectors
    print("Seeding Sectors...")
    for s_name in initial_sectors:
        exists = db.query(models.Sector).filter_by(name=s_name).first()
        if not exists:
            db.add(models.Sector(name=s_name))
            print(f" - Added {s_name}")

    db.commit()
    print("Seeding Complete!")
    db.close()

if __name__ == "__main__":
    seed_data()