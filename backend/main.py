import firebase_admin
from firebase_admin import credentials, auth, db
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
import time
import httpx
import math
from datetime import datetime, timedelta

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
# 2. DATA MODELS
# ---------------------------------------------------------

class BatchSchema(BaseModel):
    batchName: str
    dateCreated: str
    expectedCompleteDate: str 
    startingPopulation: int
    vitaminBudget: Optional[float] = 0.0

class BatchUpdateSchema(BaseModel):
    status: str

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
    description: str
    amount: float
    quantity: float
    unit: str
    date: str

class EditExpenseSchema(BaseModel):
    batchId: str
    expenseId: str
    category: str
    feedType: Optional[str] = None
    itemName: str
    description: str
    amount: float
    quantity: float
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

# ---------------------------------------------------------
# 3. KNOWLEDGE BASE (THE "BRAIN")
# ---------------------------------------------------------

# Feed Intake Curve (Kg per 1000 birds)
# We use this to calculate the "Size" of the bird.
FEED_LOGIC_TEMPLATE = [
    (range(1, 2), 12.0, "Booster"),   # Day 1: Tiny intake
    (range(2, 4), 16.0, "Booster"),
    (range(4, 7), 23.0, "Booster"),
    (range(7, 11), 35.0, "Booster"),
    (range(11, 14), 55.0, "Starter"), 
    (range(14, 17), 75.0, "Starter"),
    (range(17, 20), 95.0, "Starter"),
    (range(20, 23), 115.0, "Finisher"),
    (range(23, 26), 135.0, "Finisher"),
    (range(26, 28), 155.0, "Finisher"),
    (range(28, 31), 170.0, "Finisher"), # Day 30: Max intake
]

# STANDARD EFFICIENT DOSAGE (Per 1,000 Adult Birds)
# The system scales this down for chicks to save money.
# Example: "vetracin" is 100g for 1000 Adults. 
# For 1000 Chicks (Day 1), it will only recommend ~7g (Efficiency).
MEDICATION_DB = {
    # Antibiotics / Soluble Powders
    "vetracin": {"adult_dose": 100.0, "unit": "g"}, 
    "amox": {"adult_dose": 100.0, "unit": "g"},
    "doxy": {"adult_dose": 100.0, "unit": "g"},
    "electrolytes": {"adult_dose": 60.0, "unit": "g"}, # Lighter dose
    "vitamin": {"adult_dose": 60.0, "unit": "g"},
    
    # Liquids
    "multivitamins": {"adult_dose": 100.0, "unit": "ml"},
    "broncho": {"adult_dose": 120.0, "unit": "ml"},
    
    # Vaccines (Fixed - 1 vial usually covers 1000 regardless of age)
    "gumboro": {"fixed_dose": 1.0, "unit": "vial"},
    "newcastle": {"fixed_dose": 1.0, "unit": "vial"},
    "ncd": {"fixed_dose": 1.0, "unit": "vial"},
}

# ---------------------------------------------------------
# 4. AUTHENTICATION
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
            "dateCreated": int(time.time() * 1000)
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
            "dateCreated": int(time.time() * 1000)
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

# ---------------------------------------------------------
# 5. BATCH & FORECAST LOGIC
# ---------------------------------------------------------

def generate_forecast_data(starting_population: int):
    ratio = starting_population / 1000.0
    forecast_data = []
    
    for day in range(1, 31):
        f_match = next((item for item in FEED_LOGIC_TEMPLATE if day in item[0]), None)
        if f_match:
            forecast_data.append({
                "day": day,
                "feedType": f_match[2],
                "targetKilos": round(f_match[1] * ratio, 2)
            })
    return forecast_data

@app.post("/create-batch")
async def create_batch(data: BatchSchema, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ")[1]
    try:
        auth.verify_id_token(token)
        ref_batch = db.reference('global_batches')
        new_batch_ref = ref_batch.push()
        
        forecast_list = generate_forecast_data(data.startingPopulation)
        
        new_batch_ref.set({
            "batchName": data.batchName,
            "dateCreated": data.dateCreated,
            "expectedCompleteDate": data.expectedCompleteDate,
            "startingPopulation": data.startingPopulation,
            "vitaminBudget": data.vitaminBudget,
            "status": "active",
            "feedForecast": forecast_list
        })
        return {"status": "success", "message": "Batch created"}
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

@app.put("/update-batch/{batch_id}")
async def update_batch(batch_id: str, data: BatchUpdateSchema, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ")[1]
    try:
        auth.verify_id_token(token)
        ref_batch = db.reference(f'global_batches/{batch_id}')
        ref_batch.update({"status": data.status})
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

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
# 6. MESSAGING
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
            "timestamp": int(time.time() * 1000),
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
# 7. EXPENSES & SALES
# ---------------------------------------------------------
@app.post("/add-expense")
async def add_expense(data: ExpenseSchema, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        db.reference(f'global_batches/{data.batchId}/expenses').push({
            **data.dict(exclude={"batchId"}),
            "timestamp": int(time.time() * 1000)
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
            "timestamp": int(time.time() * 1000)
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
# 8. EFFICIENT INVENTORY ENGINE (Expense-Based & Population-Scaled)
# ---------------------------------------------------------

@app.post("/log-vitamin-usage")
async def log_vitamin_usage(data: VitaminLogSchema, authorization: str = Header(None)):
    try:
        safe_name = data.vitaminName.replace(".", "_").replace("#", "_").replace("$", "_").replace("[", "_").replace("]", "_")
        ref = db.reference(f'global_batches/{data.batchId}/vitamin_logs/{data.day}/{safe_name}')
        ref.set(data.actualAmount)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get-vitamin-logs/{batch_id}")
async def get_vitamin_logs(batch_id: str, authorization: str = Header(None)):
    try:
        snapshot = db.reference(f'global_batches/{batch_id}/vitamin_logs').get()
        return snapshot if snapshot else {}
    except Exception as e:
        return {}

@app.get("/get-inventory-forecast/{batch_id}")
async def get_inventory_forecast(batch_id: str, authorization: str = Header(None)):
    """
    EFFICIENT FORECASTING ALGORITHM
    1. Check Population.
    2. Check what was bought (Expense Name & Qty).
    3. Calculate daily need: (Adult_Standard * Population_Ratio * Growth_Factor).
       - Chick (Day 1) needs ~7% of adult dose.
       - Adult (Day 30) needs 100% of adult dose.
    4. Deduct from inventory until it runs out.
    """
    try:
        # 1. Get Batch Info
        batch_ref = db.reference(f'global_batches/{batch_id}')
        batch_data = batch_ref.get()
        if not batch_data:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        population = batch_data.get('startingPopulation', 0)
        batch_start_date = batch_data.get('dateCreated')
        
        # Scaling Ratio (e.g., 500 birds = 0.5 of standard)
        pop_ratio = population / 1000.0

        # Max Feed at Day 30 is approx 170g (used for scaling calculation)
        MAX_ADULT_FEED = 170.0 

        # 2. Get Expenses
        expenses_ref = db.reference(f'global_batches/{batch_id}/expenses')
        expenses_snapshot = expenses_ref.get()
        
        dynamic_forecast = []
        
        if expenses_snapshot and batch_start_date:
            start_date_obj = datetime.strptime(batch_start_date, "%Y-%m-%d")

            for key, item in expenses_snapshot.items():
                cat = item.get('category', '').lower()
                name = item.get('itemName', '').lower()
                expense_date_str = item.get('date')
                
                # Only process Medicines
                if "vitamin" in cat or "medicine" in cat or "vaccine" in cat:
                    
                    # A. Determine Standard Efficient Dosage (Per 1000 Adults)
                    adult_dose = 0.0
                    fixed_dose = 0.0
                    found_unit = item.get('unit', 'g')
                    is_scalable = True # True = grows with age, False = fixed per bird

                    matched_key = None
                    for db_key in MEDICATION_DB.keys():
                        if db_key in name:
                            matched_key = db_key
                            break
                    
                    if matched_key:
                        med_info = MEDICATION_DB[matched_key]
                        if "adult_dose" in med_info:
                            adult_dose = med_info["adult_dose"]
                            is_scalable = True
                        elif "fixed_dose" in med_info:
                            fixed_dose = med_info["fixed_dose"]
                            is_scalable = False
                        
                        # Use DB unit if generic
                        if found_unit == "unit" or found_unit == "units":
                             found_unit = med_info.get('unit', 'units')
                    else:
                        # Fallback for unknown medicine: 50g per 1000 birds (Safe average)
                        adult_dose = 50.0 
                        is_scalable = True
                        if found_unit == "unit" or found_unit == "units":
                             found_unit = "g"

                    # B. Determine Start Day relative to Batch
                    current_inventory = float(item.get('quantity', 0))
                    
                    if current_inventory > 0 and expense_date_str:
                        exp_date_obj = datetime.strptime(expense_date_str, "%Y-%m-%d")
                        diff_obj = exp_date_obj - start_date_obj
                        start_day_num = diff_obj.days + 1 
                        if start_day_num < 1: start_day_num = 1 

                        current_day = start_day_num
                        
                        # Loop: Simulate daily consumption until stock runs out or Day 45
                        while current_inventory > 0 and current_day <= 45:
                            
                            # 1. Determine Growth Factor (How big are they today?)
                            # Day 1 chick eats ~12g. Adult eats ~170g. Ratio = 12/170 = 0.07 (7%)
                            day_feed_intake = 12.0 # Minimum
                            
                            f_match = next((item for item in FEED_LOGIC_TEMPLATE if current_day in item[0]), None)
                            if f_match:
                                day_feed_intake = f_match[1]
                            elif current_day > 30:
                                day_feed_intake = 170.0 # Cap at adult size
                            
                            growth_factor = day_feed_intake / MAX_ADULT_FEED
                            
                            # 2. Calculate Required Daily Dose
                            daily_need = 0
                            
                            if is_scalable:
                                # (Adult Dose * Pop Ratio * Growth Factor)
                                # Example: 100g * 0.5 (500 birds) * 0.07 (Day 1) = 3.5g
                                daily_need = (adult_dose * pop_ratio) * growth_factor
                                
                                # Safety Floor: Never dose less than 10% of adult capacity to ensure efficacy
                                min_limit = (adult_dose * pop_ratio) * 0.10
                                if daily_need < min_limit: daily_need = min_limit
                                
                            else:
                                # Vaccines (Fixed)
                                daily_need = fixed_dose * pop_ratio

                            daily_need = round(daily_need, 2)

                            # 3. Deduct from Inventory
                            amount_to_use = min(daily_need, current_inventory)
                            
                            if amount_to_use > 0:
                                dynamic_forecast.append({
                                    "name": item.get('itemName'),
                                    "startDay": current_day,
                                    "endDay": current_day, 
                                    "dailyAmount": amount_to_use,
                                    "totalQuantity": amount_to_use,
                                    "unit": found_unit
                                })
                            
                            current_inventory -= amount_to_use
                            current_day += 1

        return dynamic_forecast
    except Exception as e:
        print(f"Inventory Forecast Error: {e}") 
        return []

# ---------------------------------------------------------
# 9. UTILITIES
# ---------------------------------------------------------

@app.get("/get-feed-forecast/{batch_id}")
async def get_feed_forecast(batch_id: str, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        batch_ref = db.reference(f'global_batches/{batch_id}')
        batch_data = batch_ref.get()
        if not batch_data: 
            raise HTTPException(status_code=404, detail="Batch not found")

        saved_forecast = batch_data.get('feedForecast')
        forecast_list = []
        if saved_forecast:
            if isinstance(saved_forecast, list):
                forecast_list = saved_forecast
            else:
                forecast_list = list(saved_forecast.values())
                forecast_list.sort(key=lambda x: x['day'])
        else:
            start_pop = batch_data.get('startingPopulation', 0)
            if start_pop > 0:
                forecast_list = generate_forecast_data(start_pop)
                batch_ref.child('feedForecast').set(forecast_list)

        return {"batchName": batch_data.get('batchName'), "forecast": forecast_list}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get-temperature")
async def get_temperature(lat: float = 10.68, lon: float = 122.95):
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,weather_code,is_day"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            data = response.json()
            current = data.get("current", {})
            weather_payload = {
                "temperature": current.get("temperature_2m"),
                "humidity": current.get("relative_humidity_2m"),
                "weatherCode": current.get("weather_code"),
                "isDay": current.get("is_day"), 
                "unit": "°C",
                "last_updated": int(time.time() * 1000)
            }
            db.reference('current_weather').set(weather_payload)
            return weather_payload
    except Exception as e:
        db_data = db.reference('current_weather').get()
        return db_data if db_data else {"temperature": 0, "humidity": 0, "weatherCode": None, "isDay": 1, "unit": "°C"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)