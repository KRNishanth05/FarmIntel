#!/usr/bin/env python3
"""
FarmIntel — Dataset Location Repair
========================================
The source dataset (Dataset/cleaned_agriculture_dataset.csv) contains
synthetic filler rows for 24 states whose `district` column was wrongly
labeled "Dindigul" (a Tamil Nadu district), and even carried Dindigul's
GPS coordinates. This made the app's District dropdown show states like
Manipur/Punjab/Rajasthan with every location named "Dindigul", and made
live weather/mandi lookups resolve to Dindigul.

This script reassigns those bogus rows to real agrarian districts of
their OWN state, using each district's true latitude/longitude.

- Real Tamil Nadu / Andhra Pradesh / Telangana district rows are untouched.
- The original CSV is backed up to
  Dataset/cleaned_agriculture_dataset.backup.csv before any change.
- Idempotent: running it twice is safe (the second run finds nothing to fix).

Usage:
    python scripts/fix_dataset_locations.py
"""

import os
import shutil
import sys

import pandas as pd

# Windows consoles default to cp1252, which cannot encode the emoji this
# script prints — force UTF-8 output so it runs on Windows too.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(PROJECT_ROOT, "Dataset", "cleaned_agriculture_dataset.csv")
BACKUP_PATH = os.path.join(PROJECT_ROOT, "Dataset", "cleaned_agriculture_dataset.backup.csv")

# Real districts (name, latitude, longitude) for every state whose filler
# rows were mislabeled. Four districts per state unless the state has
# fewer; rows are spread across them cyclically.
REAL_DISTRICTS = {
    "Andhra Pradesh": [
        ("Guntur", 16.3067, 80.4365),
        ("Nellore", 14.4433, 79.9864),
        ("Vijayawada", 16.5062, 80.6480),
        ("Anantapur", 14.6819, 77.6006),
    ],
    "Arunachal Pradesh": [
        ("Itanagar", 27.0844, 93.6053),
        ("Pasighat", 28.0667, 95.3333),
        ("Bomdila", 27.2550, 92.4000),
        ("Ziro", 27.5949, 93.8284),
    ],
    "Assam": [
        ("Guwahati", 26.1445, 91.7362),
        ("Nagaon", 26.3465, 92.6842),
        ("Jorhat", 26.7509, 94.2037),
        ("Barpeta", 26.3224, 91.0060),
    ],
    "Bihar": [
        ("Patna", 25.5941, 85.1376),
        ("Nalanda", 25.1361, 85.4437),
        ("Begusarai", 25.4180, 86.1280),
        ("Gopalganj", 26.4673, 84.4380),
    ],
    "Chhattisgarh": [
        ("Raipur", 21.2514, 81.6296),
        ("Bilaspur", 22.0797, 82.1409),
        ("Durg", 21.1944, 81.2828),
        ("Rajnandgaon", 21.0972, 81.0300),
    ],
    "Goa": [
        ("Panaji", 15.4909, 73.8278),
        ("Margao", 15.2832, 73.9861),
    ],
    "Gujarat": [
        ("Ahmedabad", 23.0225, 72.5714),
        ("Surat", 21.1702, 72.8311),
        ("Vadodara", 22.3072, 73.1812),
        ("Rajkot", 22.3039, 70.8022),
    ],
    "Haryana": [
        ("Hisar", 29.1492, 75.7217),
        ("Karnal", 29.6857, 76.9905),
        ("Ambala", 30.3752, 76.7821),
        ("Sirsa", 29.5349, 75.0275),
    ],
    "Himachal Pradesh": [
        ("Shimla", 31.1048, 77.1734),
        ("Solan", 30.9086, 77.0986),
        ("Kullu", 31.9578, 77.1095),
        ("Mandi", 31.7087, 76.9320),
    ],
    "Jharkhand": [
        ("Ranchi", 23.3441, 85.3096),
        ("Dhanbad", 23.7957, 86.4304),
        ("Hazaribagh", 23.9926, 85.3638),
        ("Jamshedpur", 22.8046, 86.2029),
    ],
    "Karnataka": [
        ("Bengaluru Rural", 13.1986, 77.7066),
        ("Mysuru", 12.2958, 76.6394),
        ("Kalaburagi", 17.3297, 76.8343),
        ("Dharwad", 15.4589, 75.0078),
    ],
    "Kerala": [
        ("Thiruvananthapuram", 8.5241, 76.9366),
        ("Kozhikode", 11.2588, 75.7804),
        ("Thrissur", 10.5276, 76.2144),
        ("Palakkad", 10.7867, 76.6548),
    ],
    "Madhya Pradesh": [
        ("Bhopal", 23.2599, 77.4126),
        ("Indore", 22.7196, 75.8577),
        ("Jabalpur", 23.1815, 79.9864),
        ("Gwalior", 26.2183, 78.1828),
    ],
    "Maharashtra": [
        ("Pune", 18.5204, 73.8567),
        ("Nashik", 19.9975, 73.7898),
        ("Nagpur", 21.1458, 79.0882),
        ("Chh. Sambhajinagar", 19.8762, 75.3433),
    ],
    "Manipur": [
        ("Imphal West", 24.8170, 93.9387),
        ("Bishnupur", 24.6228, 93.8221),
        ("Thoubal", 24.6333, 93.9833),
        ("Churachandpur", 24.3333, 93.7000),
    ],
    "Meghalaya": [
        ("Shillong", 25.5788, 91.8933),
        ("Tura", 25.5159, 90.2173),
        ("Jowai", 25.4526, 92.1952),
        ("Nongpoh", 25.8960, 91.7840),
    ],
    "Mizoram": [
        ("Aizawl", 23.7271, 92.7176),
        ("Lunglei", 22.8778, 92.7273),
        ("Champhai", 23.6560, 93.3220),
        ("Serchhip", 23.3033, 92.5980),
    ],
    "Nagaland": [
        ("Kohima", 25.6751, 94.1086),
        ("Mokokchung", 26.3226, 94.5227),
        ("Dimapur", 25.9044, 93.7267),
        ("Tuensang", 25.9996, 94.8261),
    ],
    "Odisha": [
        ("Bhubaneswar", 20.2961, 85.8245),
        ("Cuttack", 20.4625, 85.8828),
        ("Sambalpur", 21.4669, 83.9812),
        ("Balasore", 21.4934, 86.9344),
    ],
    "Punjab": [
        ("Ludhiana", 30.9010, 75.8573),
        ("Amritsar", 31.6340, 74.8723),
        ("Patiala", 30.3398, 76.3869),
        ("Bathinda", 30.2110, 74.9455),
    ],
    "Rajasthan": [
        ("Jaipur", 26.9124, 75.7873),
        ("Jodhpur", 26.2389, 73.0243),
        ("Kota", 25.2138, 75.8648),
        ("Bikaner", 28.0229, 73.3119),
    ],
    "Sikkim": [
        ("Gangtok", 27.3314, 88.6138),
        ("Namchi", 27.1667, 88.3500),
        ("Gyalshing", 27.2900, 88.2700),
        ("Mangan", 27.5167, 88.5600),
    ],
    "Telangana": [
        ("Karimnagar", 18.4386, 79.1288),
        ("Nalgonda", 17.0575, 79.2684),
        ("Khammam", 17.2473, 80.1514),
        ("Adilabad", 19.6641, 78.5320),
    ],
    "Tripura": [
        ("Agartala", 23.8315, 91.2868),
        ("Dhalai", 23.9046, 91.8500),
        ("Kailashahar", 24.3319, 92.0146),
        ("Udaipur", 23.5326, 91.4735),
    ],
    "Uttar Pradesh": [
        ("Lucknow", 26.8467, 80.9462),
        ("Kanpur", 26.4499, 80.3319),
        ("Varanasi", 25.3176, 82.9739),
        ("Agra", 27.1767, 78.0081),
    ],
    "Uttarakhand": [
        ("Dehradun", 30.3165, 78.0322),
        ("Haldwani", 29.2183, 79.5130),
        ("Roorkee", 29.8543, 77.8880),
        ("Almora", 29.6564, 79.6560),
    ],
    "West Bengal": [
        ("Bardhaman", 23.2429, 87.8662),
        ("Berhampore", 24.1847, 88.2663),
        ("Krishnanagar", 23.1725, 88.5564),
        ("Midnapore", 22.4227, 87.3206),
    ],
}


def main():
    if not os.path.exists(CSV_PATH):
        print(f"❌ Dataset not found: {CSV_PATH}")
        sys.exit(1)

    df = pd.read_csv(CSV_PATH)
    print(f"📊 Loaded {len(df):,} rows from {os.path.basename(CSV_PATH)}")

    # Bogus rows = district "Dindigul" outside Tamil Nadu
    bogus_mask = (df["district"].astype(str).str.strip() == "Dindigul") & (df["state"].astype(str).str.strip() != "Tamil Nadu")
    bogus_count = int(bogus_mask.sum())

    if bogus_count == 0:
        print("✅ No bogus district rows found — dataset locations already repaired.")
        return

    print(f"🛠️  Found {bogus_count} rows wrongly labeled 'Dindigul' outside Tamil Nadu.")

    # Back up the original CSV once, before the first modification
    if not os.path.exists(BACKUP_PATH):
        shutil.copy2(CSV_PATH, BACKUP_PATH)
        print(f"📦 Original dataset backed up to: {os.path.basename(BACKUP_PATH)}")

    # Assign each bogus row cyclically to a real district of its own state
    counters = {}
    repaired = 0
    for idx in df.index[bogus_mask]:
        state = str(df.at[idx, "state"]).strip()
        districts = REAL_DISTRICTS.get(state)
        if not districts:
            print(f"⚠️  No district list defined for state '{state}' — leaving row {idx} unchanged.")
            continue
        n = counters.get(state, 0)
        name, lat, lon = districts[n % len(districts)]
        counters[state] = n + 1
        df.at[idx, "district"] = name
        df.at[idx, "lat"] = lat
        df.at[idx, "lon"] = lon
        repaired += 1

    df.to_csv(CSV_PATH, index=False)
    print(f"✅ Repaired {repaired:,} rows across {len(counters)} states.")

    # Summary per state
    for state in sorted(counters):
        dists = sorted(df[df["state"] == state]["district"].unique())
        print(f"   • {state}: {', '.join(dists)}")


if __name__ == "__main__":
    main()
