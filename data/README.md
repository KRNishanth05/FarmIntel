# How to Add Your Dataset to FarmIntel

You can easily integrate your personally collected agricultural dataset into FarmIntel.

---

## 1. Where to Place Your File

Place your dataset file directly into this folder (the `data/` folder that
contains this README), e.g. on Windows:
```
C:\Users\<you>\Downloads\JeevanMitraAI\JeevanMitraAI\data\
```
Supported formats:
- **CSV format**: `my_dataset.csv` *(Recommended)*
- **Excel format**: `my_dataset.xlsx`
- **JSON format**: `my_dataset.json`

---

## 2. Supported Columns & Fields

Your dataset doesn't need to match an exact rigid naming schema. The ingestion engine automatically identifies common variations of column headers:

| Parameter Category | What it Powers in the App | Common Column Names Accepted |
| :--- | :--- | :--- |
| **Crop Name** | Crop recommendations, POP guide, yield forecasts | `crop`, `Crop`, `crop_name`, `commodity`, `crop_type` |
| **District / Location** | District dropdown, local APMC mandi selection | `district`, `District`, `location`, `mandi`, `city`, `market` |
| **State** | State classification and regional grouping | `state`, `State`, `region` |
| **Soil Type** | Soil dropdown, soil suitability matching | `soil`, `soil_type`, `Soil_Type`, `soil_name` |
| **Water / Irrigation** | Water source dropdown (Borewell, Canal, Rainfed) | `water`, `water_source`, `irrigation`, `irrigation_requirement` |
| **Season** | Sowing season (Kharif, Rabi, Summer/Zaid) | `season`, `Season`, `sowing_season` |
| **Mandi Price** | Live APMC mandi price card, profit model | `price`, `modal_price`, `mandi_price`, `Modal_Price`, `rate` (₹/Quintal) |
| **Yield** | Expected harvest per acre / hectare | `yield`, `yield_tonnes_per_ha`, `expected_yield`, `yield_per_acre` |
| **Profit / Cost** | Annual profit per acre estimation | `profit`, `expected_profit`, `net_profit`, `cost_per_acre` |
| **Soil N-P-K & pH** | Soil chemistry matching and fertilizer advisory | `soil_pH`, `pH`, `N`, `P`, `K`, `organic_carbon_pct` |

*Note: Even if your dataset only has a subset of these columns (e.g. just District, Crop, Soil, and Price), the engine will automatically impute missing fields using standard ICAR agricultural baselines!*

---

## 3. How to Run the Ingestion Script

Once you copy your dataset into the `data/` folder, open your terminal and run:

Run it from the project root (the folder that contains `scripts/`):

**macOS / Linux**

```bash
cd /path/to/JeevanMitraAI
python3 scripts/ingest_user_dataset.py
```

**Windows (Command Prompt / PowerShell)**

```bat
cd C:\path\to\JeevanMitraAI
python scripts\ingest_user_dataset.py
```

Or specify your exact file:
```bash
python3 scripts/ingest_user_dataset.py data/my_dataset.csv   # macOS/Linux
python scripts\ingest_user_dataset.py data\my_dataset.csv    # Windows
```

### What the script does:
1. Reads and validates your dataset records.
2. Extracts all unique crops, districts, soil profiles, and mandi price ranges.
3. Automatically computes expected profits and suitability scores.
4. Generates updated data in `agricultural_db.js` and `data/custom_dataset.json`.
5. Your web application immediately updates with your real data!

---

## 4. Alternative: In-App Browser Upload

You can also upload your CSV directly inside the web browser dashboard:
1. Open the application (`http://localhost:8080`).
2. Click on the **"📁 Dataset Manager"** or **"Architecture & ML Pipeline"** button in the top navigation bar.
3. Drag & drop your `.csv` file into the upload zone.
4. Click **"Sync Dataset"** — the application will parse and apply your dataset instantly in real time!
