import firebase_admin
from firebase_admin import credentials, auth, db
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import time
import httpx  # For fetching weather data

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
# 2. DATA MODELS (SCHEMAS)
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

# ---------------------------------------------------------
# 3. ENDPOINTS
# ---------------------------------------------------------

# --- USER MANAGEMENT ---

@app.post("/admin-create-user")
async def admin_create_user(data: UserRegisterSchema, authorization: str = Header(None)):
    try:
        email = f"{data.username}@poultry.com"
        user_record = auth.create_user(
            email=email,
            password=data.password,
            display_name=data.username
        )
        
        user_ref = db.reference(f'users/{user_record.uid}/profile')
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
                if isinstance(data, dict) and 'profile' in data:
                    user_info = data['profile']
                    user_info['uid'] = uid
                    users_list.append(user_info)
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


# --- BATCH MANAGEMENT ---

@app.post("/create-batch")
async def create_batch(data: BatchSchema, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ")[1]
    try:
        auth.verify_id_token(token)
        ref_batch = db.reference('global_batches')
        new_batch_ref = ref_batch.push()
        new_batch_ref.set({
            "batchName": data.batchName,
            "dateCreated": data.dateCreated,
            "expectedCompleteDate": data.expectedCompleteDate,
            "startingPopulation": data.startingPopulation,
            "vitaminBudget": data.vitaminBudget,
            "status": "active"
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
        return {"status": "success", "message": "Batch status updated"}
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
        return {"status": "success", "message": "Batch deleted"}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# --- MESSAGING ---

@app.post("/admin-send-message")
async def admin_send_message(data: MessageSchema, authorization: str = Header(None)):
    try:
        db.reference(f'chats/{data.recipientUid}').push({
            "text": data.text,
            "sender": "admin",
            "timestamp": int(time.time() * 1000),
            "isEdited": False
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

# --- EXPENSES ---

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

# --- SALES ---

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

# --- FORECAST ---

FEED_LOGIC = [
    (range(1, 2), 0.60, "Booster"), (range(2, 4), 0.70, "Booster"),
    (range(4, 7), 0.80, "Booster"), (range(7, 11), 0.90, "Booster"),
    (range(11, 14), 1.00, "Starter"), (range(14, 17), 1.20, "Starter"),
    (range(17, 20), 1.40, "Starter"), (range(20, 22), 1.50, "Starter"),
    (range(22, 24), 1.60, "Starter"), (range(24, 25), 2.00, "Finisher"),
    (range(25, 26), 2.40, "Finisher"), (range(26, 27), 2.60, "Finisher"),
    (range(27, 28), 3.00, "Finisher"), (range(28, 29), 3.20, "Finisher"),
    (range(29, 31), 3.40, "Finisher"),
]

@app.get("/get-feed-forecast/{batch_id}")
async def get_feed_forecast(batch_id: str, authorization: str = Header(None)):
    try:
        token = authorization.split("Bearer ")[1]
        auth.verify_id_token(token)
        batch_data = db.reference(f'global_batches/{batch_id}').get()
        if not batch_data: raise HTTPException(status_code=404, detail="Batch not found")
        
        population = batch_data.get('startingPopulation', 0)
        multiplier = population / 1000 
        
        forecast_list = []
        for day in range(1, 31):
            f_match = next((item for item in FEED_LOGIC if day in item[0]), None)
            if f_match:
                forecast_list.append({
                    "day": day, 
                    "feedType": f_match[2],
                    "targetKilos": round(f_match[1] * multiplier, 2)
                })
        
        return {"batchName": batch_data.get('batchName'), "forecast": forecast_list}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- ACCURATE WEATHER & TEMPERATURE (Bacolod Coordinates) ---

@app.get("/get-temperature")
async def get_temperature():
    """
    Fetches real-time temperature and weather code for Bacolod.
    Coordinates: 10.68, 122.95
    """
    url = "https://api.open-meteo.com/v1/forecast?latitude=10.68&longitude=122.95&current=temperature_2m,weather_code"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            data = response.json()
            current = data.get("current", {})
            return {
                "temperature": current.get("temperature_2m"),
                "weatherCode": current.get("weather_code"),
                "unit": "°C"
            }
    except Exception as e:
        return {"temperature": "N/A", "weatherCode": None, "unit": ""}