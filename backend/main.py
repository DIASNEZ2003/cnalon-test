import firebase_admin
from firebase_admin import credentials, auth, db
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
import time
import httpx
import math
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------
# 1. SETUP & INITIALIZATION
# ---------------------------------------------------------
cred = credentials.Certificate("serviceAccountKey.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://final-future-d1547-default-rtdb.firebaseio.com/' 
    })

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# 2. UTILITY: PHILIPPINE TIME
# ---------------------------------------------------------
def get_ph_time():
    """Returns current timestamp in milliseconds for Philippines (UTC+8)"""
    now_utc = datetime.now(timezone.utc)
    ph_time = now_utc + timedelta(hours=8)
    return int(ph_time.timestamp() * 1000)

# ---------------------------------------------------------
# 3. DATA MODELS
# ---------------------------------------------------------

class BatchSchema(BaseModel):
    batchName: str
    dateCreated: str
    expectedCompleteDate: str 
    startingPopulation: int
    vitaminBudget: Optional[float] = 0.0
    penCount: Optional[int] = 5
    averageChickWeight: Optional[float] = 50.0
    status: Optional[str] = None # Auto-assigned by backend

class BatchUpdateSchema(BaseModel):
    batchName: Optional[str] = None
    dateCreated: Optional[str] = None
    expectedCompleteDate: Optional[str] = None
    status: Optional[str] = None
    startingPopulation: Optional[int] = None
    penCount: Optional[int] = None
    averageChickWeight: Optional[float] = None

class UserRegisterSchema(BaseModel):
    firstName: str
    lastName: str
    username: str
    password: str

class MessageSchema(BaseModel):
    recipientUid: str
    text: str

class EditMessageSchema(BaseModel):
    targetUid: str
    messageId: str
    newText: str

class DeleteMessageSchema(BaseModel):
    targetUid: str
    messageId: str

class SalesRecordSchema(BaseModel):
    batchId: str  
    buyerName: str
    address: str
    quantity: int
    pricePerChicken: float
    dateOfPurchase: str

class EditSalesRecordSchema(BaseModel):
    batchId: str
    saleId: str
    buyerName: str
    address: str
    quantity: int
    pricePerChicken: float
    dateOfPurchase: str

class ExpenseSchema(BaseModel):
    batchId: str  
    category: str
    feedType: Optional[str] = None
    itemName: str
    description: Optional[str] = ""
    amount: float
    quantity: float
    purchaseCount: Optional[float] = 1.0  
    remaining: Optional[float] = None
    unit: str
    date: str

class EditExpenseSchema(BaseModel):
    batchId: str
    expenseId: str
    category: str
    feedType: Optional[str] = None
    itemName: str
    description: Optional[str] = ""
    amount: float
    quantity: float
    purchaseCount: Optional[float] = 1.0  
    remaining: Optional[float] = None
    unit: str
    date: str

class UpdateFeedCategorySchema(BaseModel):
    batchId: str
    expenseId: str
    category: str
    feedType: str 

class VitaminLogSchema(BaseModel):
    batchId: str
    day: int
    vitaminName: str
    actualAmount: float

class WeightLogSchema(BaseModel):
    batchId: str
    date: str
    day: int
    averageWeight: float
    unit: str = "g"
    updatedBy: Optional[str] = "Unknown"
    updaterName: Optional[str] = "Unknown"

class DeleteWeightLogSchema(BaseModel):
    batchId: str
    date: str

class PersonnelSchema(BaseModel):
    firstName: str
    lastName: str
    age: str
    address: str
    status: str
    photoUrl: Optional[str] = ""

class EditPersonnelSchema(BaseModel):
    personnelId: str
    firstName: str
    lastName: str
    age: str
    address: str
    status: str
    photoUrl: Optional[str] = ""

# ---------------------------------------------------------
# 4. KNOWLEDGE BASE (FEED & WEIGHT LOGIC)
# ---------------------------------------------------------

FEED_LOGIC_TEMPLATE = [
    (range(1, 2), 35.0, "Booster"),
    (range(2, 4), 35.0, "Booster"),
    (range(4, 7), 45.0, "Booster"),
    (range(7, 11), 55.0, "Booster"),
    (range(11, 15), 85.0, "Starter"),
    (range(15, 21), 115.0, "Starter"),
    (range(21, 26), 145.0, "Finisher"),
    (range(26, 31), 170.0, "Finisher"),
]

MEDICATION_DB = {
    "vetracin": {"adult_dose": 100.0, "unit": "g"}, 
    "amox": {"adult_dose": 100.0, "unit": "g"},
    "doxy": {"adult_dose": 100.0, "unit": "g"},
    "electrolytes": {"adult_dose": 100.0, "unit": "g"},
    "vitamin": {"adult_dose": 100.0, "unit": "g"},
    "multivitamins": {"adult_dose": 100.0, "unit": "ml"},
    "broncho": {"adult_dose": 120.0, "unit": "ml"},
    "gumboro": {"fixed_dose": 1.0, "unit": "vial"},
    "newcastle": {"fixed_dose": 1.0, "unit": "vial"},
    "ncd": {"fixed_dose": 1.0, "unit": "vial"},
}

# ---------------------------------------------------------
# 5. CALCULATION ENGINES
# ---------------------------------------------------------

def get_estimated_fcr(day: int) -> float:
    if day <= 5: return 1.3
    if day <= 12: return 1.4
    if day <= 21: return 1.5
    return 1.7

def generate_forecast_data(population: int):
    forecast_data = []
    print(f"--- Recalculating Feed for Pop: {population} ---")
    for day in range(1, 31):
        f_match = next((item for item in FEED_LOGIC_TEMPLATE if day in item[0]), None)
        if f_match:
            grams_per_bird = f_match[1]
            target_kilos = (grams_per_bird * population) / 1000.0
            
            forecast_data.append({
                "day": day,
                "feedType": f_match[2],
                "targetKilos": round(target_kilos, 2),
                "gramsPerBird": grams_per_bird 
            })
    return forecast_data

def generate_weight_forecast(start_weight: float, population: int, feed_forecast: list):
    weight_data = []
    current_weight_g = start_weight
    target_days = [1] + list(range(3, 31, 3))
    
    for day in range(1, 31):
        day_feed_data = next((f for f in feed_forecast if f["day"] == day), None)
        if day_feed_data:
            daily_feed_g = day_feed_data["gramsPerBird"]
            fcr = get_estimated_fcr(day)
            daily_gain_g = daily_feed_g / fcr
            current_weight_g += daily_gain_g
            if day in target_days:
                total_flock_weight_kg = (current_weight_g * population) / 1000.0
                weight_data.append({
                    "day": f"Day {day}",
                    "weight": round(total_flock_weight_kg, 2),
                    "avgWeight": int(current_weight_g),
                    "fcr": fcr,
                    "unit": "kg"
                })
    return weight_data

# --- HELPER 1: DEACTIVATE OTHERS ---
def deactivate_other_active_batches(current_batch_id=None):
    """If we make a batch active, turn off all others."""
    try:
        ref = db.reference('global_batches')
        snapshot = ref.get()
        if snapshot:
            for bid, bdata in snapshot.items():
                if bdata.get('status') == 'active' and bid != current_batch_id:
                    ref.child(bid).update({"status": "inactive"})
                    print(f"Deactivated batch: {bid}")
    except Exception as e:
        print(f"Error deactivating batches: {e}")

# --- HELPER 2: AUTO-ACTIVATE NEXT INACTIVE BATCH ---
def activate_next_inactive_batch():
    """Finds the oldest 'inactive' batch and turns it 'active'."""
    try:
        ref = db.reference('global_batches')
        snapshot = ref.get()
        if snapshot:
            # Filter for inactive batches
            inactive_batches = [
                (bid, bdata) for bid, bdata in snapshot.items()
                if bdata.get('status') == 'inactive'
            ]
            
            # Sort by dateCreated (oldest first)
            inactive_batches.sort(key=lambda x: x[1].get('dateCreated', '9999-99-99'))
            
            if inactive_batches:
                next_id = inactive_batches[0][0]
                next_name = inactive_batches[0][1].get('batchName')
                ref.child(next_id).update({"status": "active"})
                print(f"Auto-Activated next batch: {next_name}")
                return True
    except Exception as e:
        print(f"Error auto-activating next batch: {e}")
    return False

# ---------------------------------------------------------
# 6. API ENDPOINTS
# ---------------------------------------------------------

@app.post("/register-user")
async def register_user(data: dict, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ")[1]
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']
        user_ref = db.reference(f'users/{uid}')
        user_ref.set({
            "firstName": data.get("firstName"),
            "lastName": data.get("lastName"),
            "fullName": f"{data.get('firstName')} {data.get('lastName')}",
            "username": data.get("username"),
            "role": "admin",
            "status": "online",
            "dateCreated": get_ph_time()
        })
        return {"status": "success", "uid": uid}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/verify-login")
async def verify_login(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ")[1]
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']
        user_data = db.reference(f'users/{uid}').get()
        if not user_data or user_data.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        return {"status": "success", "user": user_data}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid session")

@app.post("/admin-create-user")
async def admin_create_user(data: UserRegisterSchema, authorization: str = Header(None)):
    try:
        email = f"{data.username}@poultry.com"
        user_record = auth.create_user(email=email, password=data.password, display_name=data.username)
        user_ref = db.reference(f'users/{user_record.uid}')
        user_ref.set({
            "firstName": data.firstName,
            "lastName": data.lastName,
            "fullName": f"{data.firstName} {data.lastName}",
            "username": data.username,
            "role": "user",
            "status": "offline",
            "dateCreated": get_ph_time()
        })
        return {"status": "success", "uid": user_record.uid}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get-users")
async def get_users(authorization: str = Header(None)):
    try:
        ref_users = db.reference('users')
        snapshot = ref_users.get()
        users_list = []
        if snapshot:
            for uid, data in snapshot.items():
                data['uid'] = uid
                users_list.append(data)
        return users_list
    except Exception as e:
        return []

@app.delete("/admin-delete-user/{target_uid}")
async def admin_delete_user(target_uid: str, authorization: str = Header(None)):
    try:
        auth.delete_user(target_uid)
        db.reference(f'users/{target_uid}').delete()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- UPDATED: CREATE BATCH (New Logic) ---
@app.post("/create-batch")
async def create_batch(data: BatchSchema, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ")[1]
    try:
        auth.verify_id_token(token)
        
        # 1. CHECK IF THERE IS ALREADY AN ACTIVE BATCH
        ref_all = db.reference('global_batches')
        snapshot = ref_all.get()
        has_active_batch = False
        if snapshot:
            for _, val in snapshot.items():
                if val.get('status') == 'active':
                    has_active_batch = True
                    break
        
        # 2. AUTO ASSIGN STATUS
        # If active batch exists -> New batch = INACTIVE (Wait in queue)
        # If no active batch -> New batch = ACTIVE (Start immediately)
        final_status = "inactive" if has_active_batch else "active"

        ref_batch = db.reference('global_batches')
        new_batch_ref = ref_batch.push()
        
        forecast_list = generate_forecast_data(data.startingPopulation)
        
        new_batch_ref.set({
            "batchName": data.batchName,
            "dateCreated": data.dateCreated,
            "expectedCompleteDate": data.expectedCompleteDate,
            "startingPopulation": data.startingPopulation,
            "vitaminBudget": data.vitaminBudget,
            "penCount": data.penCount,
            "averageChickWeight": data.averageChickWeight,
            "status": final_status, # AUTO ASSIGNED
            "feedForecast": forecast_list
        })
        return {"status": "success", "message": f"Batch created as {final_status}"}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.get("/get-batches")
async def get_batches(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ")[1]
    try:
        auth.verify_id_token(token)
        snapshot = db.reference('global_batches').get()
        batches_list = []
        if snapshot:
            for key, val in snapshot.items():
                val['id'] = key
                batches_list.append(val)
        return batches_list
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# --- UPDATED: UPDATE BATCH (Activation Logic) ---
@app.put("/update-batch/{batch_id}")
async def update_batch(batch_id: str, data: BatchUpdateSchema, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ")[1]
    try:
        auth.verify_id_token(token)
        
        # 1. If manually setting to 'active', pause others
        if data.status == "active":
            deactivate_other_active_batches(current_batch_id=batch_id)

        ref_batch = db.reference(f'global_batches/{batch_id}')
        
        updates = {}
        if data.batchName is not None: updates["batchName"] = data.batchName
        if data.dateCreated is not None: updates["dateCreated"] = data.dateCreated
        if data.expectedCompleteDate is not None: updates["expectedCompleteDate"] = data.expectedCompleteDate
        if data.status is not None: updates["status"] = data.status
        if data.penCount is not None: updates["penCount"] = data.penCount
        if data.averageChickWeight is not None: updates["averageChickWeight"] = data.averageChickWeight

        if data.startingPopulation is not None:
            updates["startingPopulation"] = data.startingPopulation
            new_forecast = generate_forecast_data(data.startingPopulation)
            updates["feedForecast"] = new_forecast
        
        ref_batch.update(updates)

        # 2. AUTO-ACTIVATE NEXT BATCH if this one is COMPLETED
        if data.status == "completed":
            activate_next_inactive_batch()

        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.put("/update-batch-settings/{batch_id}")
async def update_batch_settings(batch_id: str, data: BatchUpdateSchema, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        
        batch_ref = db.reference(f'global_batches/{batch_id}')
        updates = {}
        if data.startingPopulation is not None:
            updates["startingPopulation"] = data.startingPopulation
        if data.penCount is not None:
            updates["penCount"] = data.penCount
        if data.averageChickWeight is not None:
            updates["averageChickWeight"] = data.averageChickWeight
        if data.status is not None:
            updates["status"] = data.status
            
        batch_ref.update(updates)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/delete-batch/{batch_id}")
async def delete_batch(batch_id: str, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ")[1]
    try:
        auth.verify_id_token(token)
        db.reference(f'global_batches/{batch_id}').delete()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# ---------------------------------------------------------
# 7. MESSAGING
# ---------------------------------------------------------
@app.post("/admin-send-message")
async def admin_send_message(data: MessageSchema, authorization: str = Header(None)):
    try:
        recipient_data = db.reference(f'users/{data.recipientUid}').get()
        current_status = "sent"
        if recipient_data and recipient_data.get("status") == "online":
            current_status = "delivered"
        db.reference(f'chats/{data.recipientUid}').push({
            "text": data.text,
            "sender": "admin",
            "timestamp": get_ph_time(),
            "isEdited": False,
            "status": current_status,
            "seen": False
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/admin-edit-message")
async def admin_edit_message(data: EditMessageSchema, authorization: str = Header(None)):
    try:
        ref_msg = db.reference(f'chats/{data.targetUid}/{data.messageId}')
        ref_msg.update({"text": data.newText, "isEdited": True})
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/admin-delete-message")
async def admin_delete_message(data: DeleteMessageSchema, authorization: str = Header(None)):
    try:
        db.reference(f'chats/{data.targetUid}/{data.messageId}').delete()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ---------------------------------------------------------
# 8. EXPENSES & SALES
# ---------------------------------------------------------
@app.post("/add-expense")
async def add_expense(data: ExpenseSchema, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        db.reference(f'global_batches/{data.batchId}/expenses').push({
            **data.dict(exclude={"batchId"}),
            "timestamp": get_ph_time()
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/edit-expense")
async def edit_expense(data: EditExpenseSchema, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        ref_exp = db.reference(f'global_batches/{data.batchId}/expenses/{data.expenseId}')
        ref_exp.update({
            "category": data.category,
            "feedType": data.feedType,
            "itemName": data.itemName,
            "description": data.description,
            "amount": data.amount,
            "quantity": data.quantity,
            "purchaseCount": data.purchaseCount, 
            "remaining": data.remaining,
            "unit": data.unit,
            "date": data.date
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/delete-expense/{batch_id}/{expense_id}")
async def delete_expense(batch_id: str, expense_id: str, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        db.reference(f'global_batches/{batch_id}/expenses/{expense_id}').delete()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get-expenses/{batch_id}")
async def get_expenses(batch_id: str, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        snapshot = db.reference(f'global_batches/{batch_id}/expenses').get()
        return [{"id": k, **v} for k, v in snapshot.items()] if snapshot else []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/update-expense-category")
async def update_expense_category(data: UpdateFeedCategorySchema, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        ref_exp = db.reference(f'global_batches/{data.batchId}/expenses/{data.expenseId}')
        ref_exp.update({"category": data.category, "feedType": data.feedType})
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/add-sale")
async def add_sale(data: SalesRecordSchema, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        db.reference(f'global_batches/{data.batchId}/sales').push({
            **data.dict(exclude={"batchId"}),
            "totalAmount": data.quantity * data.pricePerChicken,
            "timestamp": get_ph_time()
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/edit-sale")
async def edit_sale(data: EditSalesRecordSchema, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        ref_sale = db.reference(f'global_batches/{data.batchId}/sales/{data.saleId}')
        ref_sale.update({
            "buyerName": data.buyerName,
            "address": data.address,
            "quantity": data.quantity,
            "pricePerChicken": data.pricePerChicken,
            "totalAmount": data.quantity * data.pricePerChicken,
            "dateOfPurchase": data.dateOfPurchase
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/delete-sale/{batch_id}/{sale_id}")
async def delete_sale(batch_id: str, sale_id: str, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        db.reference(f'global_batches/{batch_id}/sales/{sale_id}').delete()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get-sales/{batch_id}")
async def get_sales(batch_id: str, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        snapshot = db.reference(f'global_batches/{batch_id}/sales').get()
        return [{"id": k, **v} for k, v in snapshot.items()] if snapshot else []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ---------------------------------------------------------
# 9. FORECASTING & INVENTORY (FORCE UPDATE LOGIC)
# ---------------------------------------------------------

@app.get("/get-inventory-forecast/{batch_id}")
async def get_inventory_forecast(batch_id: str, authorization: str = Header(None)):
    # VITAMIN FORECAST LOGIC REMOVED AS REQUESTED
    return []

@app.get("/get-feed-forecast/{batch_id}")
async def get_feed_forecast(batch_id: str, authorization: str = Header(None)):
    try:
        batch_ref = db.reference(f'global_batches/{batch_id}')
        batch_data = batch_ref.get()
        if not batch_data: 
            raise HTTPException(status_code=404, detail="Batch not found")
        
        # 1. GET ACTUAL POPULATION FROM DB
        population = batch_data.get('startingPopulation', 1000)
        # UPDATED DEFAULT to 50.0
        start_weight = batch_data.get('averageChickWeight', 50.0) 
        
        # 2. FORCE RECALCULATE (Ignore old saved data)
        # Using 30.0 g/bird for day 1 -> (30 * 1000) / 1000 = 30.0 kg
        new_feed_forecast = generate_forecast_data(population)
        
        # 3. Calculate Weight Forecast - BASED DIRECTLY ON FEED CONSUMPTION + 3 DAY GAP
        new_weight_forecast = generate_weight_forecast(start_weight, population, new_feed_forecast)
        
        # 4. OVERWRITE DATABASE WITH CORRECT DATA
        batch_ref.child('feedForecast').set(new_feed_forecast)
        
        return {
            "batchName": batch_data.get('batchName'), 
            "feedForecast": new_feed_forecast,
            "weightForecast": new_weight_forecast
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get-temperature")
async def get_temperature(lat: float = 10.6765, lon: float = 122.9509):
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,weather_code,is_day"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            current = response.json().get("current", {})
            weather_payload = {
                "temperature": current.get("temperature_2m"),
                "humidity": current.get("relative_humidity_2m"),
                "weatherCode": current.get("weather_code"),
                "isDay": current.get("is_day"), 
                "unit": "°C",
                "last_updated": get_ph_time()
            }
            db.reference('current_weather').set(weather_payload)
            return weather_payload
    except Exception as e:
        db_data = db.reference('current_weather').get()
        return db_data if db_data else {"temperature": 0, "humidity": 0}
    
# ---------------------------------------------------------
# 10. ADMIN MASTER RECORDS
# ---------------------------------------------------------

@app.get("/get-all-records")
async def get_all_records(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        batches = db.reference('global_batches').get()
        all_records = []

        if not batches:
            return []

        for b_id, b_data in batches.items():
            b_name = b_data.get('batchName', 'Unnamed Batch')

            # Mortality Logs
            m_logs = b_data.get('mortality_logs', {})
            if m_logs:
                for date, log in m_logs.items():
                    total = int(log.get('am', 0)) + int(log.get('pm', 0))
                    all_records.append({
                        "id": f"mort-{b_id}-{date}",
                        "type": "Mortality",
                        "date": date,
                        "timestamp": log.get('timestamp', 0),
                        "title": f"Batch: {b_name}",
                        "subtitle": f"Mortality: {total} heads (AM: {log.get('am')}, PM: {log.get('pm')})",
                        "user": log.get('updaterName', 'System')
                    })

            # Feed Logs
            f_logs = b_data.get('feed_logs', {})
            if f_logs:
                forecast = b_data.get('feedForecast', [])
                for date, log in f_logs.items():
                    start_date = datetime.strptime(b_data.get('dateCreated'), "%Y-%m-%d")
                    log_date = datetime.strptime(date, "%Y-%m-%d")
                    day_num = (log_date - start_date).days + 1
                    
                    feed_type = "Feed"
                    for f in forecast:
                        if f.get('day') == day_num:
                            feed_type = f.get('feedType', 'Feed')
                            break

                    all_records.append({
                        "id": f"feed-{b_id}-{date}",
                        "type": "Feed",
                        "date": date,
                        "timestamp": log.get('timestamp', 0),
                        "title": f"Batch: {b_name}",
                        "subtitle": f"{feed_type}: {float(log.get('am', 0)) + float(log.get('pm', 0))} kg",
                        "user": log.get('updaterName', 'System')
                    })

            # Vitamin Logs
            v_logs = b_data.get('daily_vitamin_logs', {})
            if v_logs:
                for date, log in v_logs.items():
                    all_records.append({
                        "id": f"vit-{b_id}-{date}",
                        "type": "Vitamins",
                        "date": date,
                        "timestamp": log.get('timestamp', 0),
                        "title": f"Batch: {b_name}",
                        "subtitle": f"Supplement: {float(log.get('am_amount', 0)) + float(log.get('pm_amount', 0))} units",
                        "user": log.get('updaterName', 'System')
                    })

            # Weight Logs
            w_logs = b_data.get('weight_logs', {})
            if w_logs:
                for date, log in w_logs.items():
                    all_records.append({
                        "id": f"weight-{b_id}-{date}",
                        "type": "Weight",
                        "date": date,
                        "timestamp": log.get('timestamp', 0),
                        "title": f"Batch: {b_name}",
                        "subtitle": f"Average Weight: {log.get('averageWeight')} {log.get('unit', 'g')}",
                        "user": log.get('updaterName', 'System')
                    })

        all_records.sort(key=lambda x: x['timestamp'], reverse=True)
        return all_records

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ---------------------------------------------------------
# 11. PERSONNEL MANAGEMENT
# ---------------------------------------------------------

@app.post("/add-personnel")
async def add_personnel(data: PersonnelSchema, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        ref_personnel = db.reference('personnel')
        new_ref = ref_personnel.push()
        new_ref.set({
            "firstName": data.firstName,
            "lastName": data.lastName,
            "fullName": f"{data.firstName} {data.lastName}",
            "age": data.age,
            "address": data.address,
            "status": data.status,
            "photoUrl": data.photoUrl,
            "dateAdded": get_ph_time()
        })
        return {"status": "success", "id": new_ref.key}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get-personnel")
async def get_personnel(authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        snapshot = db.reference('personnel').get()
        if snapshot:
            return [{"id": k, **v} for k, v in snapshot.items()]
        return []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/edit-personnel")
async def edit_personnel(data: EditPersonnelSchema, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        ref_p = db.reference(f'personnel/{data.personnelId}')
        update_data = {
            "firstName": data.firstName,
            "lastName": data.lastName,
            "fullName": f"{data.firstName} {data.lastName}",
            "age": data.age,
            "address": data.address,
            "status": data.status
        }
        if data.photoUrl:
            update_data["photoUrl"] = data.photoUrl
            
        ref_p.update(update_data)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/delete-personnel/{personnel_id}")
async def delete_personnel(personnel_id: str, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        db.reference(f'personnel/{personnel_id}').delete()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)