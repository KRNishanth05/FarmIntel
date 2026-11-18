#!/usr/bin/env python3
"""
FarmIntel — User Dataset Ingestion Engine
Automatically ingests, cleans, analyzes, and syncs user-collected agricultural datasets
into FarmIntel (both data/custom_dataset.json and agricultural_db.js).
"""

import sys
import os
import glob
import json
import re
import pandas as pd

# Windows consoles default to cp1252, which cannot encode the emoji this
# script prints — force UTF-8 output so it runs on Windows too.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
OUTPUT_JSON = os.path.join(DATA_DIR, "custom_dataset.json")
AGRI_DB_JS = os.path.join(PROJECT_ROOT, "agricultural_db.js")

# Standard column aliases for intelligent auto-detection
COLUMN_ALIASES = {
    "crop": ["crop", "crop_name", "commodity", "produce", "crop_type", "crop_name_clean"],
    "district": ["district", "district_name", "location", "market", "mandi", "city", "taluk", "center"],
    "state": ["state", "state_name", "region", "zone"],
    "soil": ["soil", "soil_type", "soil_name", "soil_group"],
    "water": ["water", "water_source", "irrigation", "irrigation_type", "irrigation_requirement"],
    "season": ["season", "sowing_season", "crop_season"],
    "yield": ["yield", "yield_tonnes_per_ha", "yield_per_acre", "expected_yield", "production_tonnes"],
    "price": ["price", "modal_price", "modal_x0020_price", "mandi_price", "market_price", "rate"],
    "profit": ["profit", "expected_profit", "net_profit", "margin", "profit_per_acre"],
    "ph": ["ph", "soil_ph", "soil_ph_val"],
    "nitrogen": ["n", "available_n_kg_ha", "soil_nitrogen", "nitrogen"],
    "phosphorus": ["p", "available_p_kg_ha", "soil_phosphorus", "phosphorus"],
    "potassium": ["k", "available_k_kg_ha", "soil_potassium", "potassium"],
    "organic_carbon": ["organic_carbon_pct", "soil_soc", "organic_carbon"]
}

def find_dataset_file(given_path=None):
    if given_path:
        if os.path.exists(given_path):
            return given_path
        joined = os.path.join(DATA_DIR, given_path)
        if os.path.exists(joined):
            return joined
        print(f"❌ Error: Specified file '{given_path}' does not exist.")
        sys.exit(1)

    # Search in Dataset / and Dataset/ and data/
    candidates = []
    for d in [os.path.join(PROJECT_ROOT, "Dataset "), os.path.join(PROJECT_ROOT, "Dataset"), DATA_DIR]:
        if os.path.exists(d):
            for ext in ("*.csv", "*.xlsx", "*.xls"):
                candidates.extend(glob.glob(os.path.join(d, ext)))

    if not candidates:
        # Check parent folder "Mini project datasets" as fallback
        parent_datasets = os.path.expanduser("~/Mini project datasets")
        if os.path.exists(parent_datasets):
            for ext in ("*.csv", "*.xlsx"):
                candidates.extend(glob.glob(os.path.join(parent_datasets, ext)))

    if not candidates:
        print("❌ No dataset found.")
        print(f"👉 Please place your CSV file into: {DATA_DIR}")
        print("   Example: data/my_crop_dataset.csv")
        sys.exit(1)

    # Pick the most recently modified file
    candidates.sort(key=os.path.getmtime, reverse=True)
    return candidates[0]

def normalize_col_name(col):
    c = str(col).strip().lower()
    c = re.sub(r'[\s\-_]+', '_', c)
    c = re.sub(r'[^a-z0-9_]', '', c)
    return c

def map_columns(df):
    mapping = {}
    normalized_cols = {normalize_col_name(c): c for c in df.columns}
    
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            norm_alias = normalize_col_name(alias)
            if norm_alias in normalized_cols:
                mapping[canonical] = normalized_cols[norm_alias]
                break
    return mapping

def process_dataset(filepath):
    print(f"📂 Reading dataset: {filepath}")
    filename = os.path.basename(filepath)

    try:
        if filepath.endswith('.xlsx') or filepath.endswith('.xls'):
            df = pd.read_excel(filepath)
        else:
            try:
                df = pd.read_csv(filepath, encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(filepath, encoding='latin1')
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        sys.exit(1)

    print(f"📊 Loaded {len(df):,} rows and {len(df.columns)} columns.")
    col_map = map_columns(df)
    print("🔍 Detected Column Mappings:")
    for canonical, actual in col_map.items():
        print(f"   • {canonical.upper():<14} ➔ '{actual}'")

    if "crop" not in col_map:
        print("⚠️ Warning: Could not detect a 'crop' or 'commodity' column.")
    
    # Process Crops summary
    crop_col = col_map.get("crop")
    price_col = col_map.get("price")
    yield_col = col_map.get("yield")
    profit_col = col_map.get("profit")
    district_col = col_map.get("district")
    soil_col = col_map.get("soil")
    water_col = col_map.get("water")
    season_col = col_map.get("season")

    crops_summary = {}
    if crop_col and crop_col in df.columns:
        grouped = df.groupby(crop_col)
        for crop_name, group in grouped:
            c_name = str(crop_name).strip()
            if not c_name or c_name.lower() in ('nan', 'none', 'total'):
                continue
            
            entry = {
                "name": c_name,
                "recordCount": int(len(group))
            }

            if price_col and price_col in group.columns:
                prices = pd.to_numeric(group[price_col], errors='coerce').dropna()
                if len(prices) > 0:
                    entry["mandiPriceMin"] = round(float(prices.min()), 1)
                    entry["mandiPriceMax"] = round(float(prices.max()), 1)
                    entry["mandiPriceMean"] = round(float(prices.mean()), 1)
                    entry["mandiPriceMedian"] = round(float(prices.median()), 1)

            if yield_col and yield_col in group.columns:
                yields = pd.to_numeric(group[yield_col], errors='coerce').dropna()
                if len(yields) > 0:
                    entry["avgYield"] = round(float(yields.mean()), 2)
                    entry["maxYield"] = round(float(yields.max()), 2)

            if profit_col and profit_col in group.columns:
                profits = pd.to_numeric(group[profit_col], errors='coerce').dropna()
                if len(profits) > 0:
                    entry["avgProfit"] = round(float(profits.mean()), 2)

            if district_col and district_col in group.columns:
                dists = group[district_col].dropna().astype(str).str.strip().unique()
                entry["topDistricts"] = [d for d in dists[:10] if d]

            if soil_col and soil_col in group.columns:
                soils = group[soil_col].dropna().astype(str).str.strip().unique()
                entry["suitableSoils"] = [s for s in soils if s]

            if season_col and season_col in group.columns:
                seasons = group[season_col].dropna().astype(str).str.strip().unique()
                entry["seasons"] = [s for s in seasons if s]

            crops_summary[c_name.lower().replace(" ", "_")] = entry

    # Process Districts summary
    districts_list = []
    if district_col and district_col in df.columns:
        d_grouped = df.groupby(district_col)
        for dist_name, d_group in d_grouped:
            d_name = str(dist_name).strip()
            if not d_name or d_name.lower() in ('nan', 'none', 'total'):
                continue
            
            top_crops = []
            if crop_col and crop_col in d_group.columns:
                top_crops = [str(c) for c in d_group[crop_col].value_counts().head(5).index]

            state_val = ""
            if "state" in col_map and col_map["state"] in d_group.columns:
                states = d_group[col_map["state"]].dropna().unique()
                if len(states) > 0:
                    state_val = str(states[0])

            districts_list.append({
                "name": d_name,
                "state": state_val,
                "topCrops": top_crops,
                "recordCount": int(len(d_group))
            })

    output_payload = {
        "sourceFile": filename,
        "totalRows": int(len(df)),
        "detectedColumns": {k: v for k, v in col_map.items()},
        "crops": crops_summary,
        "districts": districts_list[:50],
        "generatedAt": pd.Timestamp.now().isoformat()
    }

    # Write to custom_dataset.json
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2, ensure_ascii=False)
    print(f"✅ Generated JSON summary: {OUTPUT_JSON}")

    # Inject into agricultural_db.js
    sync_to_agricultural_db(output_payload)

def sync_to_agricultural_db(payload):
    if not os.path.exists(AGRI_DB_JS):
        print("⚠️ agricultural_db.js not found, skipping JS injection.")
        return

    with open(AGRI_DB_JS, "r", encoding="utf-8") as f:
        content = f.read()

    injection_comment = "// ==================== USER CUSTOM DATASET SYNC ===================="
    injection_code = f"""{injection_comment}
// Automatically ingested from user dataset: {payload['sourceFile']}
// Records: {payload['totalRows']:,} rows | Crops: {len(payload['crops'])}
window.USER_DATASET_SUMMARY = {json.dumps(payload, indent=2, ensure_ascii=False)};
"""

    if injection_comment in content:
        # Replace existing block
        pattern = re.compile(rf"{re.escape(injection_comment)}.*?window\.USER_DATASET_SUMMARY\s*=\s*\{{.*?\}};\n", re.DOTALL)
        content = pattern.sub(injection_code, content)
    else:
        # Prepend to file
        content = injection_code + "\n" + content

    with open(AGRI_DB_JS, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"🚀 Injected user dataset into: {AGRI_DB_JS}")
    print(f"✨ FarmIntel is now synced with your custom dataset ({len(payload['crops'])} crops imported)!")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    dataset_path = find_dataset_file(target)
    builder_script = os.path.join(os.path.dirname(__file__), "build_dataset_db.py")
    if os.path.exists(builder_script):
        import subprocess
        print("🔄 Invoking primary database compiler (build_dataset_db.py)...")
        subprocess.run([sys.executable, builder_script], check=True)
    process_dataset(dataset_path)
