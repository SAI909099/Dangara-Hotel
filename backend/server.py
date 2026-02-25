from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dangara-hotel-secret-key-2025')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    password: str
    role: str

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: User

class Room(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_number: str
    room_type: str
    price_per_night: float
    status: str
    description: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RoomCreate(BaseModel):
    room_number: str
    room_type: str
    price_per_night: float
    status: str = "Available"
    description: Optional[str] = ""

class RoomUpdate(BaseModel):
    room_number: Optional[str] = None
    room_type: Optional[str] = None
    price_per_night: Optional[float] = None
    status: Optional[str] = None
    description: Optional[str] = None

class Guest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    full_name: str
    phone: str
    passport_id: Optional[str] = None
    id_type: Optional[str] = "passport"
    id_number: Optional[str] = None
    birth_date: Optional[str] = None
    nation: Optional[str] = None
    region: Optional[str] = None
    street: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GuestCreate(BaseModel):
    full_name: str
    phone: str
    id_type: Optional[str] = "passport"
    id_number: Optional[str] = None
    passport_id: Optional[str] = None
    birth_date: Optional[str] = None
    nation: Optional[str] = None
    region: Optional[str] = None
    street: Optional[str] = None

class GuestUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    passport_id: Optional[str] = None
    birth_date: Optional[str] = None
    nation: Optional[str] = None
    region: Optional[str] = None
    street: Optional[str] = None

class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    guest_id: str
    room_id: str
    check_in_date: str
    check_out_date: str
    total_price: float
    status: str  # Confirmed | Checked In | Checked Out | Cancelled
    
    # YANGI: Check-in qilingan vaqt (bugungi daromad uchun)
    checked_in_at: Optional[str] = None
    checked_out_at: Optional[str] = None
    
    guest_name: Optional[str] = None
    room_number: Optional[str] = None
    nights: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BookingCreate(BaseModel):
    guest_id: str
    room_id: str
    check_in_date: str
    check_out_date: str

class BookingUpdate(BaseModel):
    check_in_date: Optional[str] = None
    check_out_date: Optional[str] = None

class DashboardStats(BaseModel):
    total_rooms: int
    available_rooms: int
    occupied_rooms: int
    today_income: float
    upcoming_reservations: int

class DailyReport(BaseModel):
    date: str
    guests_today: int
    check_ins: int
    check_outs: int
    total_revenue: float

class MonthlyReport(BaseModel):
    month: str
    total_guests: int
    total_occupied_days: int
    total_income: float
    most_used_room_type: str

# Auth functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"username": username}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Initialize demo data
async def initialize_demo_data():
    users_count = await db.users.count_documents({})
    if users_count == 0:
        admin_user = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "password": get_password_hash("admin123"),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        reception_user = {
            "id": str(uuid.uuid4()),
            "username": "reception",
            "password": get_password_hash("reception123"),
            "role": "receptionist",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_many([admin_user, reception_user])
        
    rooms_count = await db.rooms.count_documents({})
    if rooms_count == 0:
        rooms = [
            {"id": str(uuid.uuid4()), "room_number": "101", "room_type": "Single", "price_per_night": 150000, "status": "Available", "description": "Cozy single room", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "102", "room_type": "Single", "price_per_night": 150000, "status": "Available", "description": "Cozy single room", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "201", "room_type": "Double", "price_per_night": 250000, "status": "Available", "description": "Comfortable double room", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "202", "room_type": "Double", "price_per_night": 250000, "status": "Available", "description": "Comfortable double room", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "301", "room_type": "Suite", "price_per_night": 500000, "status": "Available", "description": "Luxury suite", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "302", "room_type": "VIP", "price_per_night": 750000, "status": "Available", "description": "Premium VIP room", "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await db.rooms.insert_many(rooms)
        
    guests_count = await db.guests.count_documents({})
    if guests_count == 0:
        guests = [
            {"id": str(uuid.uuid4()), "full_name": "Alisher Karimov", "phone": "+998901234567", "passport_id": "AB1234567", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "full_name": "Malika Rahimova", "phone": "+998907654321", "passport_id": "AB7654321", "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await db.guests.insert_many(guests)

@app.on_event("startup")
async def startup_event():
    await initialize_demo_data()

# Auth routes
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    user = await db.users.find_one({"username": login_data.username}, {"_id": 0})
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    access_token = create_access_token(data={"sub": user["username"]})
    user_data = {k: v for k, v in user.items() if k != "password"}
    return {"token": access_token, "user": user_data}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# User routes
@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: User = Depends(get_admin_user)):
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(username=user_data.username, role=user_data.role)
    doc = user.model_dump()
    doc["password"] = get_password_hash(user_data.password)
    doc["created_at"] = doc["created_at"].isoformat()
    await db.users.insert_one(doc)
    return user

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return users

# Room routes
@api_router.get("/rooms", response_model=List[Room])
async def get_rooms(status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    rooms = await db.rooms.find(query, {"_id": 0}).to_list(1000)
    for room in rooms:
        if isinstance(room.get('created_at'), str):
            room['created_at'] = datetime.fromisoformat(room['created_at'])
    return rooms

@api_router.post("/rooms", response_model=Room)
async def create_room(room_data: RoomCreate, current_user: User = Depends(get_admin_user)):
    existing = await db.rooms.find_one({"room_number": room_data.room_number})
    if existing:
        raise HTTPException(status_code=400, detail="Room number already exists")
    
    room = Room(**room_data.model_dump())
    doc = room.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.rooms.insert_one(doc)
    return room

@api_router.put("/rooms/{room_id}", response_model=Room)
async def update_room(room_id: str, room_data: RoomUpdate, current_user: User = Depends(get_admin_user)):
    update_data = {k: v for k, v in room_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.rooms.update_one({"id": room_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if isinstance(room.get('created_at'), str):
        room['created_at'] = datetime.fromisoformat(room['created_at'])
    return Room(**room)

@api_router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, current_user: User = Depends(get_admin_user)):
    result = await db.rooms.delete_one({"id": room_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"message": "Room deleted"}

# Guest routes
@api_router.get("/guests", response_model=List[Guest])
async def get_guests(search: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"passport_id": {"$regex": search, "$options": "i"}},
        ]
    guests = await db.guests.find(query, {"_id": 0}).to_list(1000)
    for guest in guests:
        if isinstance(guest.get('created_at'), str):
            guest['created_at'] = datetime.fromisoformat(guest['created_at'])
    return guests

@api_router.get("/guests/{guest_id}", response_model=Guest)
async def get_guest(guest_id: str, current_user: User = Depends(get_current_user)):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    if isinstance(guest.get('created_at'), str):
        guest['created_at'] = datetime.fromisoformat(guest['created_at'])
    return Guest(**guest)

@api_router.post("/guests", response_model=Guest)
async def create_guest(guest_data: GuestCreate, current_user: User = Depends(get_current_user)):
    guest = Guest(**guest_data.model_dump())
    doc = guest.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.guests.insert_one(doc)
    return guest

@api_router.put("/guests/{guest_id}", response_model=Guest)
async def update_guest(guest_id: str, guest_data: GuestUpdate, current_user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in guest_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.guests.update_one({"id": guest_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if isinstance(guest.get('created_at'), str):
        guest['created_at'] = datetime.fromisoformat(guest['created_at'])
    return Guest(**guest)

# Booking routes
@api_router.get("/bookings", response_model=List[Booking])
async def get_bookings(status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)
    for booking in bookings:
        if isinstance(booking.get('created_at'), str):
            booking['created_at'] = datetime.fromisoformat(booking['created_at'])
        guest = await db.guests.find_one({"id": booking["guest_id"]}, {"_id": 0})
        room = await db.rooms.find_one({"id": booking["room_id"]}, {"_id": 0})
        booking["guest_name"] = guest["full_name"] if guest else "Unknown"
        booking["room_number"] = room["room_number"] if room else "Unknown"
    return bookings

@api_router.post("/bookings", response_model=Booking)
async def create_booking(booking_data: BookingCreate, current_user: User = Depends(get_current_user)):
    """
    Yangi bron yaratish - status: Confirmed
    Xona statusini Reserved ga o'zgartiradi
    """
    room = await db.rooms.find_one({"id": booking_data.room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["status"] not in ["Available"]:
        raise HTTPException(status_code=400, detail="Room is not available")
    
    try:
        check_in = datetime.strptime(booking_data.check_in_date, "%Y-%m-%d")
        check_out = datetime.strptime(booking_data.check_out_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    nights = (check_out - check_in).days
    if nights <= 0:
        raise HTTPException(status_code=400, detail="Check-out date must be after check-in date")
    
    total_price = room["price_per_night"] * nights
    
    booking = Booking(
        guest_id=booking_data.guest_id,
        room_id=booking_data.room_id,
        check_in_date=booking_data.check_in_date,
        check_out_date=booking_data.check_out_date,
        total_price=total_price,
        status="Confirmed",
        checked_in_at=None,
        checked_out_at=None
    )
    doc = booking.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.bookings.insert_one(doc)
    
    await db.rooms.update_one({"id": booking_data.room_id}, {"$set": {"status": "Reserved"}})
    
    guest = await db.guests.find_one({"id": booking_data.guest_id}, {"_id": 0})
    booking_dict = booking.model_dump()
    booking_dict["guest_name"] = guest["full_name"] if guest else "Unknown"
    booking_dict["room_number"] = room["room_number"]
    return Booking(**booking_dict)

@api_router.post("/bookings/{booking_id}/checkin")
async def checkin_booking(booking_id: str, current_user: User = Depends(get_current_user)):
    """
    Check-in: Confirmed -> Checked In
    Xona: Reserved -> Occupied
    MUHIM: checked_in_at vaqtini saqlash (bugungi daromad uchun)
    """
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] != "Confirmed":
        raise HTTPException(status_code=400, detail="Booking must be Confirmed to check-in")
    
    # MUHIM: Hozirgi vaqtni saqlash
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    await db.bookings.update_one(
        {"id": booking_id}, 
        {"$set": {
            "status": "Checked In",
            "checked_in_at": now  # Bu maydon bugungi daromad uchun
        }}
    )
    await db.rooms.update_one({"id": booking["room_id"]}, {"$set": {"status": "Occupied"}})
    
    return {"message": "Check-in successful"}

@api_router.post("/bookings/{booking_id}/checkout")
async def checkout_booking(booking_id: str, current_user: User = Depends(get_current_user)):
    """
    Check-out: Checked In -> Checked Out
    Xona: Occupied -> Available
    """
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] != "Checked In":
        raise HTTPException(status_code=400, detail="Booking must be Checked In to check-out")
    
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    await db.bookings.update_one(
        {"id": booking_id}, 
        {"$set": {
            "status": "Checked Out",
            "checked_out_at": now
        }}
    )
    await db.rooms.update_one({"id": booking["room_id"]}, {"$set": {"status": "Available"}})
    
    return {"message": "Check-out successful", "total_price": booking["total_price"]}

@api_router.put("/bookings/{booking_id}", response_model=Booking)
async def update_booking(booking_id: str, booking_data: BookingUpdate, current_user: User = Depends(get_current_user)):
    """
    Bron sanalarini yangilash va narxni qayta hisoblash
    """
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] not in ["Confirmed", "Checked In"]:
        raise HTTPException(status_code=400, detail="Cannot update completed or cancelled booking")
    
    new_check_in = booking_data.check_in_date or booking["check_in_date"]
    new_check_out = booking_data.check_out_date or booking["check_out_date"]
    
    try:
        check_in = datetime.strptime(new_check_in, "%Y-%m-%d")
        check_out = datetime.strptime(new_check_out, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    nights = (check_out - check_in).days
    if nights <= 0:
        raise HTTPException(status_code=400, detail="Invalid date range")
    
    room = await db.rooms.find_one({"id": booking["room_id"]}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    new_total_price = room["price_per_night"] * nights
    
    update_data = {
        "check_in_date": new_check_in,
        "check_out_date": new_check_out,
        "total_price": new_total_price
    }
    
    await db.bookings.update_one({"id": booking_id}, {"$set": update_data})
    
    updated_booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if isinstance(updated_booking.get('created_at'), str):
        updated_booking['created_at'] = datetime.fromisoformat(updated_booking['created_at'])
    
    guest = await db.guests.find_one({"id": updated_booking["guest_id"]}, {"_id": 0})
    updated_booking["guest_name"] = guest["full_name"] if guest else "Unknown"
    updated_booking["room_number"] = room["room_number"]
    
    return Booking(**updated_booking)

@api_router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str, current_user: User = Depends(get_current_user)):
    """
    Bronni bekor qilish
    """
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] == "Confirmed":
        await db.rooms.update_one({"id": booking["room_id"]}, {"$set": {"status": "Available"}})
    
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "Cancelled"}})
    
    return {"message": "Booking cancelled successfully"}

# Dashboard route - TO'LIQ TUZATILGAN (Eski va Yangi bronlar uchun)
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    total_rooms = await db.rooms.count_documents({})
    available_rooms = await db.rooms.count_documents({"status": "Available"})
    occupied_rooms = await db.rooms.count_documents({"status": "Occupied"})
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # IKKALA HOLATNI HAM HISOBLASH:
    # 1. Yangi tizim: Bugun check-in qilingan bronlar (checked_in_at = bugun)
    today_checkins = await db.bookings.find({"checked_in_at": today}, {"_id": 0}).to_list(1000)
    
    # 2. Eski tizim: check_in_date = bugun va status = Checked In (checked_in_at yo'q)
    legacy_checkins = await db.bookings.find({
        "check_in_date": today,
        "status": "Checked In",
        "$or": [
            {"checked_in_at": None},
            {"checked_in_at": {"$exists": False}}
        ]
    }, {"_id": 0}).to_list(1000)
    
    # Ikkala ro'yxatni birlashtirish va umumiy summani hisoblash
    all_today_checkins = today_checkins + legacy_checkins
    today_income = sum(booking["total_price"] for booking in all_today_checkins)
    
    # Kutilayotgan bronlar (Confirmed status)
    upcoming_reservations = await db.bookings.count_documents({"status": "Confirmed"})
    
    return DashboardStats(
        total_rooms=total_rooms,
        available_rooms=available_rooms,
        occupied_rooms=occupied_rooms,
        today_income=today_income,
        upcoming_reservations=upcoming_reservations
    )

# Reports routes - TUZATILGAN
@api_router.get("/reports/daily", response_model=DailyReport)
async def get_daily_report(date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    target_date = date if date else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check-in qilinganlar (checked_in_at)
    check_ins = await db.bookings.count_documents({"checked_in_at": target_date})
    
    # Check-out qilinganlar (checked_out_at)
    check_outs = await db.bookings.count_documents({"checked_out_at": target_date})
    
    # O'sha kunda check-in qilingan bronlarning umumiy narxi
    bookings = await db.bookings.find({"checked_in_at": target_date}, {"_id": 0}).to_list(1000)
    total_revenue = sum(booking["total_price"] for booking in bookings)
    
    guests_today = check_ins
    
    return DailyReport(
        date=target_date,
        guests_today=guests_today,
        check_ins=check_ins,
        check_outs=check_outs,
        total_revenue=total_revenue
    )

@api_router.get("/reports/monthly", response_model=MonthlyReport)
async def get_monthly_report(month: Optional[str] = None, current_user: User = Depends(get_current_user)):
    target_month = month if month else datetime.now(timezone.utc).strftime("%Y-%m")
    
    # O'sha oyda check-in qilingan bronlar
    bookings = await db.bookings.find(
        {"checked_in_at": {"$regex": f"^{target_month}"}}, 
        {"_id": 0}
    ).to_list(1000)
    
    total_guests = len(bookings)
    total_income = sum(booking["total_price"] for booking in bookings)
    
    total_occupied_days = 0
    for booking in bookings:
        try:
            check_in = datetime.strptime(booking["check_in_date"], "%Y-%m-%d")
            check_out = datetime.strptime(booking["check_out_date"], "%Y-%m-%d")
            total_occupied_days += (check_out - check_in).days
        except:
            pass
    
    room_type_counts = {}
    for booking in bookings:
        room = await db.rooms.find_one({"id": booking["room_id"]}, {"_id": 0})
        if room:
            room_type = room["room_type"]
            room_type_counts[room_type] = room_type_counts.get(room_type, 0) + 1
    
    most_used_room_type = max(room_type_counts, key=room_type_counts.get) if room_type_counts else "N/A"
    
    return MonthlyReport(
        month=target_month,
        total_guests=total_guests,
        total_occupied_days=total_occupied_days,
        total_income=total_income,
        most_used_room_type=most_used_room_type
    )

@api_router.get("/reports/revenue")
async def get_revenue_data(year: int = datetime.now().year, current_user: User = Depends(get_current_user)):
    """
    Oylik daromad - check-in qilingan sanaga qarab
    """
    monthly_data = []
    for month in range(1, 13):
        month_str = f"{year}-{month:02d}"
        
        # O'sha oyda check-in qilingan bronlar
        bookings = await db.bookings.find(
            {"checked_in_at": {"$regex": f"^{month_str}"}}, 
            {"_id": 0}
        ).to_list(1000)
        
        total_income = sum(booking["total_price"] for booking in bookings)
        
        monthly_data.append({
            "month": datetime(year, month, 1).strftime("%B"),
            "revenue": total_income
        })
    return monthly_data

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()