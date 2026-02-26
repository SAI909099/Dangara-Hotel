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

PAGE_KEYS = ["dashboard", "rooms", "guests", "bookings", "calendar", "reports", "users"]


def get_default_permissions_for_role(role: Optional[str]) -> List[str]:
    role_key = (role or "").strip().lower()
    if role_key == "admin":
        return PAGE_KEYS.copy()
    if role_key == "accountant":
        return ["dashboard", "reports"]
    if role_key in {"receptionist", "reception", "reseption"}:
        return ["dashboard", "rooms", "guests", "bookings", "calendar"]
    return ["dashboard"]


def normalize_permissions(permissions: Optional[List[str]], role: Optional[str]) -> List[str]:
    source = permissions if isinstance(permissions, list) and permissions else get_default_permissions_for_role(role)
    cleaned = []
    seen = set()
    for item in source:
        if not item:
            continue
        key = str(item).strip().lower()
        if key in PAGE_KEYS and key not in seen:
            seen.add(key)
            cleaned.append(key)
    if "dashboard" not in cleaned:
        cleaned.insert(0, "dashboard")
    return cleaned

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: str
    permissions: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    permissions: Optional[List[str]] = None

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
    room_type: str  # "1 kishilik" | "2 kishilik" | "3 kishilik" | "4 kishilik" | "5 kishilik" | "VIP" | "Lux"
    capacity: int  # Xonaning sig'imi
    price_per_night: float
    status: str  # "Available" | "Reserved" | "Occupied" | "Cleaning"
    description: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RoomCreate(BaseModel):
    room_number: str
    room_type: str
    capacity: int
    price_per_night: float
    status: str = "Available"
    description: Optional[str] = ""

class RoomUpdate(BaseModel):
    room_number: Optional[str] = None
    room_type: Optional[str] = None
    capacity: Optional[int] = None
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
    guest_ids: List[str]  # YANGI: Ko'p mehmonlar
    room_id: str
    check_in_date: str
    check_out_date: str
    total_price: float
    status: str  # Confirmed | Checked In | Checked Out | Cancelled
    
    checked_in_at: Optional[str] = None
    checked_out_at: Optional[str] = None
    
    guest_names: Optional[List[str]] = []  # YANGI: Mehmonlar ismlari
    room_number: Optional[str] = None
    nights: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BookingCreate(BaseModel):
    guest_ids: List[str]  # YANGI: Ko'p mehmonlar
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
    cleaning_rooms: int  # YANGI
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

# ============== YANGI: Chiqimlar (Expenses) Models ==============

class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str                    # Chiqim nomi
    category: str                 # Kategoriya: "Maosh" | "Kommunal" | "Ta'mirlash" | "Oziq-ovqat" | "Boshqa"
    amount: float                 # Summa
    description: Optional[str] = ""
    date: str                     # Sana: "2025-01-15"
    created_by: Optional[str] = None  # Kim qo'shdi
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExpenseCreate(BaseModel):
    title: str
    category: str
    amount: float
    description: Optional[str] = ""
    date: Optional[str] = None     # Agar berilmasa bugungi sana

class ExpenseUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    date: Optional[str] = None

class ExpenseSummary(BaseModel):
    total_expenses: float
    total_income: float
    net_profit: float
    expenses_by_category: dict
    expense_count: int


STATUS_ALIASES = {
    "reserved": "Confirmed",
    "confirmed": "Confirmed",
    "checked_in": "Checked In",
    "checked in": "Checked In",
    "checked_out": "Checked Out",
    "checked out": "Checked Out",
    "cancelled": "Cancelled",
    "canceled": "Cancelled",
}


def normalize_booking_status(status_value: Optional[str]) -> Optional[str]:
    if not status_value:
        return None
    normalized = status_value.strip()
    if not normalized:
        return None
    return STATUS_ALIASES.get(normalized.lower(), normalized)


def parse_iso_day(day_str: Optional[str]) -> Optional[datetime]:
    if not day_str:
        return None
    try:
        return datetime.strptime(day_str, "%Y-%m-%d")
    except ValueError:
        return None


def calculate_nights(check_in_date: Optional[str], check_out_date: Optional[str]) -> Optional[int]:
    check_in = parse_iso_day(check_in_date)
    check_out = parse_iso_day(check_out_date)
    if not check_in or not check_out:
        return None
    return max((check_out - check_in).days, 0)

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
        user["permissions"] = normalize_permissions(user.get("permissions"), user.get("role"))
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

# Initialize demo data - YANGILANGAN
async def initialize_demo_data():
    users_count = await db.users.count_documents({})
    if users_count == 0:
        admin_user = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "password": get_password_hash("admin123"),
            "role": "admin",
            "permissions": get_default_permissions_for_role("admin"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        reception_user = {
            "id": str(uuid.uuid4()),
            "username": "reception",
            "password": get_password_hash("reception123"),
            "role": "receptionist",
            "permissions": get_default_permissions_for_role("receptionist"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_many([admin_user, reception_user])
        
    rooms_count = await db.rooms.count_documents({})
    if rooms_count == 0:
        rooms = [
            {"id": str(uuid.uuid4()), "room_number": "101", "room_type": "1 kishilik", "capacity": 1, "price_per_night": 150000, "status": "Available", "description": "Bir kishilik xona", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "102", "room_type": "1 kishilik", "capacity": 1, "price_per_night": 150000, "status": "Available", "description": "Bir kishilik xona", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "201", "room_type": "2 kishilik", "capacity": 2, "price_per_night": 250000, "status": "Available", "description": "Ikki kishilik xona", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "202", "room_type": "2 kishilik", "capacity": 2, "price_per_night": 250000, "status": "Available", "description": "Ikki kishilik xona", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "301", "room_type": "3 kishilik", "capacity": 3, "price_per_night": 350000, "status": "Available", "description": "Uch kishilik xona", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "302", "room_type": "4 kishilik", "capacity": 4, "price_per_night": 450000, "status": "Available", "description": "To'rt kishilik xona", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "401", "room_type": "5 kishilik", "capacity": 5, "price_per_night": 550000, "status": "Available", "description": "Besh kishilik xona", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "501", "room_type": "VIP", "capacity": 2, "price_per_night": 750000, "status": "Available", "description": "VIP xona", "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "room_number": "502", "room_type": "Lux", "capacity": 3, "price_per_night": 1000000, "status": "Available", "description": "Lux xona", "created_at": datetime.now(timezone.utc).isoformat()},
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
    
    user["permissions"] = normalize_permissions(user.get("permissions"), user.get("role"))
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
    
    permissions = normalize_permissions(user_data.permissions, user_data.role)
    user = User(username=user_data.username, role=user_data.role, permissions=permissions)
    doc = user.model_dump()
    doc["password"] = get_password_hash(user_data.password)
    doc["created_at"] = doc["created_at"].isoformat()
    await db.users.insert_one(doc)
    return user

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    for user in users:
        user["permissions"] = normalize_permissions(user.get("permissions"), user.get("role"))
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

# YANGI: Xonani tozalash holatiga o'tkazish
@api_router.post("/rooms/{room_id}/mark-cleaning")
async def mark_room_cleaning(room_id: str, current_user: User = Depends(get_current_user)):
    """
    Xonani tozalash holatiga o'tkazish
    """
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    await db.rooms.update_one({"id": room_id}, {"$set": {"status": "Cleaning"}})
    return {"message": "Room marked for cleaning"}

# YANGI: Tozalash tugadi, xona bo'sh
@api_router.post("/rooms/{room_id}/mark-available")
async def mark_room_available(room_id: str, current_user: User = Depends(get_current_user)):
    """
    Tozalash tugadi - xona bo'sh
    """
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    await db.rooms.update_one({"id": room_id}, {"$set": {"status": "Available"}})
    return {"message": "Room is now available"}

# Guest routes
@api_router.get("/guests", response_model=List[Guest])
async def get_guests(
    search: Optional[str] = None,
    sort_by: Optional[str] = "created_at",
    sort_dir: Optional[str] = "desc",
    page: int = 1,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    query = {}
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"passport_id": {"$regex": search, "$options": "i"}},
        ]

    allowed_sort_fields = {"created_at", "full_name", "phone", "passport_id", "id_number"}
    actual_sort_by = sort_by if sort_by in allowed_sort_fields else "created_at"
    sort_direction = -1 if str(sort_dir).lower() != "asc" else 1

    page = max(page, 1)
    limit = min(max(limit, 1), 1000)
    skip = (page - 1) * limit

    cursor = db.guests.find(query, {"_id": 0}).sort(actual_sort_by, sort_direction).skip(skip).limit(limit)
    guests = await cursor.to_list(limit)
    for guest in guests:
        if isinstance(guest.get('created_at'), str):
            guest['created_at'] = datetime.fromisoformat(guest['created_at'])
    return guests


@api_router.get("/guests/archive")
async def get_guests_archive(
    q: Optional[str] = None,
    guest_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "check_in_date",
    sort_dir: str = "desc",
    page: int = 1,
    limit: int = 200,
    current_user: User = Depends(get_current_user),
):
    """
    Mehmonlar arxivi: har bir bron yozuvi guest bo'yicha flatten qilinadi.
    """
    page = max(page, 1)
    limit = min(max(limit, 1), 1000)

    booking_query = {}
    normalized_status = normalize_booking_status(status)
    if normalized_status and normalized_status.lower() != "all":
        booking_query["status"] = normalized_status

    if date_from and date_to:
        booking_query["check_in_date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        booking_query["check_in_date"] = {"$gte": date_from}
    elif date_to:
        booking_query["check_in_date"] = {"$lte": date_to}

    if guest_id:
        booking_query["guest_ids"] = guest_id

    bookings = await db.bookings.find(booking_query, {"_id": 0}).to_list(10000)

    room_ids = {b.get("room_id") for b in bookings if b.get("room_id")}
    guest_ids = set()
    for booking in bookings:
        for gid in booking.get("guest_ids", []):
            if gid:
                guest_ids.add(gid)

    rooms = await db.rooms.find({"id": {"$in": list(room_ids)}} if room_ids else {}, {"_id": 0, "id": 1, "room_number": 1}).to_list(5000)
    guests = await db.guests.find({"id": {"$in": list(guest_ids)}} if guest_ids else {}, {"_id": 0, "id": 1, "full_name": 1, "phone": 1, "passport_id": 1, "id_number": 1}).to_list(5000)
    room_map = {r["id"]: r for r in rooms}
    guest_map = {g["id"]: g for g in guests}

    items = []
    q_lower = q.strip().lower() if q else None
    for booking in bookings:
        booking_guest_ids = booking.get("guest_ids") or []
        if not booking_guest_ids:
            continue

        room = room_map.get(booking.get("room_id"), {})
        room_number = room.get("room_number", "Unknown")
        nights = calculate_nights(booking.get("check_in_date"), booking.get("check_out_date"))
        total_price = float(booking.get("total_price", 0) or 0)
        share_price = total_price / len(booking_guest_ids) if booking_guest_ids else total_price

        for gid in booking_guest_ids:
            if guest_id and gid != guest_id:
                continue

            guest_doc = guest_map.get(gid, {})
            item = {
                "booking_id": booking.get("id"),
                "guest_id": gid,
                "guest_name": guest_doc.get("full_name", "Unknown"),
                "guest_phone": guest_doc.get("phone"),
                "guest_passport_id": guest_doc.get("passport_id") or guest_doc.get("id_number"),
                "room_id": booking.get("room_id"),
                "room_number": room_number,
                "check_in_date": booking.get("check_in_date"),
                "check_out_date": booking.get("check_out_date"),
                "nights": nights,
                "status": booking.get("status"),
                "total_price": total_price,
                "guest_share_price": share_price,
                "checked_in_at": booking.get("checked_in_at"),
                "checked_out_at": booking.get("checked_out_at"),
                "created_at": booking.get("created_at"),
            }

            if q_lower:
                haystack = " ".join([
                    str(item.get("guest_name", "")),
                    str(item.get("guest_phone", "")),
                    str(item.get("room_number", "")),
                    str(item.get("status", "")),
                    str(item.get("check_in_date", "")),
                    str(item.get("check_out_date", "")),
                ]).lower()
                if q_lower not in haystack:
                    continue

            items.append(item)

    sort_key_map = {
        "check_in_date": "check_in_date",
        "check_out_date": "check_out_date",
        "created_at": "created_at",
        "total_amount": "total_price",
        "total_price": "total_price",
        "summa": "total_price",
        "nights": "nights",
        "room_number": "room_number",
        "guest_name": "guest_name",
        "status": "status",
    }
    actual_sort_key = sort_key_map.get(sort_by, "check_in_date")
    reverse = str(sort_dir).lower() != "asc"

    def sort_value(x):
        val = x.get(actual_sort_key)
        if val is None:
            return ""
        return val

    items.sort(key=sort_value, reverse=reverse)

    total = len(items)
    start = (page - 1) * limit
    end = start + limit

    return {
        "items": items[start:end],
        "total": total,
        "page": page,
        "limit": limit,
    }

@api_router.get("/guests/{guest_id}", response_model=Guest)
async def get_guest(guest_id: str, current_user: User = Depends(get_current_user)):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    if isinstance(guest.get('created_at'), str):
        guest['created_at'] = datetime.fromisoformat(guest['created_at'])
    return Guest(**guest)


@api_router.get("/guests/{guest_id}/history")
async def get_guest_history(
    guest_id: str,
    q: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "check_in_date",
    sort_dir: str = "desc",
    page: int = 1,
    limit: int = 200,
    current_user: User = Depends(get_current_user),
):
    """
    Bitta mehmonning bron tarixi.
    """
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0, "id": 1})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    archive = await get_guests_archive(
        q=q,
        guest_id=guest_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        limit=limit,
        current_user=current_user,
    )
    return archive

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

# Booking routes - YANGILANGAN (Ko'p mehmonlar)
@api_router.get("/bookings", response_model=List[Booking])
async def get_bookings(
    status: Optional[str] = None,
    sort_by: Optional[str] = "created_at",
    sort_dir: Optional[str] = "desc",
    page: int = 1,
    limit: int = 200,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status

    allowed_sort_fields = {
        "created_at",
        "check_in_date",
        "check_out_date",
        "total_price",
        "status",
    }
    actual_sort_by = sort_by if sort_by in allowed_sort_fields else "created_at"
    sort_direction = -1 if str(sort_dir).lower() != "asc" else 1

    page = max(page, 1)
    limit = min(max(limit, 1), 1000)
    skip = (page - 1) * limit

    cursor = (
        db.bookings.find(query, {"_id": 0})
        .sort(actual_sort_by, sort_direction)
        .skip(skip)
        .limit(limit)
    )
    bookings = await cursor.to_list(limit)
    for booking in bookings:
        if isinstance(booking.get('created_at'), str):
            booking['created_at'] = datetime.fromisoformat(booking['created_at'])
        
        # Mehmonlar ismlari
        guest_names = []
        for guest_id in booking.get("guest_ids", []):
            guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
            if guest:
                guest_names.append(guest["full_name"])
        booking["guest_names"] = guest_names
        
        room = await db.rooms.find_one({"id": booking["room_id"]}, {"_id": 0})
        booking["room_number"] = room["room_number"] if room else "Unknown"
    return bookings

@api_router.post("/bookings", response_model=Booking)
async def create_booking(booking_data: BookingCreate, current_user: User = Depends(get_current_user)):
    """
    Yangi bron yaratish - Ko'p mehmonlar bilan
    """
    room = await db.rooms.find_one({"id": booking_data.room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["status"] not in ["Available"]:
        raise HTTPException(status_code=400, detail="Room is not available")
    
    # Mehmonlar sonini tekshirish
    if len(booking_data.guest_ids) > room["capacity"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Xona sig'imi: {room['capacity']} kishi. Siz {len(booking_data.guest_ids)} mehmon tanladingiz."
        )
    
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
        guest_ids=booking_data.guest_ids,
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
    
    # Mehmonlar ismlari
    guest_names = []
    for guest_id in booking_data.guest_ids:
        guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
        if guest:
            guest_names.append(guest["full_name"])
    
    booking_dict = booking.model_dump()
    booking_dict["guest_names"] = guest_names
    booking_dict["room_number"] = room["room_number"]
    return Booking(**booking_dict)

@api_router.post("/bookings/{booking_id}/checkin")
async def checkin_booking(booking_id: str, current_user: User = Depends(get_current_user)):
    """
    Check-in: Confirmed -> Checked In
    """
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] != "Confirmed":
        raise HTTPException(status_code=400, detail="Booking must be Confirmed to check-in")
    
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    await db.bookings.update_one(
        {"id": booking_id}, 
        {"$set": {
            "status": "Checked In",
            "checked_in_at": now
        }}
    )
    await db.rooms.update_one({"id": booking["room_id"]}, {"$set": {"status": "Occupied"}})
    
    return {"message": "Check-in successful"}

@api_router.post("/bookings/{booking_id}/checkout")
async def checkout_booking(booking_id: str, current_user: User = Depends(get_current_user)):
    """
    Check-out: Checked In -> Checked Out
    Xona: Occupied -> Cleaning (YANGI!)
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
    # YANGI: Check-out qilganda xona tozalash holatiga o'tadi
    await db.rooms.update_one({"id": booking["room_id"]}, {"$set": {"status": "Cleaning"}})
    
    return {"message": "Check-out successful. Room marked for cleaning", "total_price": booking["total_price"]}

@api_router.put("/bookings/{booking_id}", response_model=Booking)
async def update_booking(booking_id: str, booking_data: BookingUpdate, current_user: User = Depends(get_current_user)):
    """
    Bron sanalarini yangilash
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
    
    # Mehmonlar ismlari
    guest_names = []
    for guest_id in updated_booking.get("guest_ids", []):
        guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
        if guest:
            guest_names.append(guest["full_name"])
    
    updated_booking["guest_names"] = guest_names
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

# Dashboard route - YANGILANGAN
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    total_rooms = await db.rooms.count_documents({})
    available_rooms = await db.rooms.count_documents({"status": "Available"})
    occupied_rooms = await db.rooms.count_documents({"status": "Occupied"})
    cleaning_rooms = await db.rooms.count_documents({"status": "Cleaning"})  # YANGI
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    today_checkins = await db.bookings.find({"checked_in_at": today}, {"_id": 0}).to_list(1000)
    legacy_checkins = await db.bookings.find({
        "check_in_date": today,
        "status": "Checked In",
        "$or": [
            {"checked_in_at": None},
            {"checked_in_at": {"$exists": False}}
        ]
    }, {"_id": 0}).to_list(1000)
    
    all_today_checkins = today_checkins + legacy_checkins
    today_income = sum(booking["total_price"] for booking in all_today_checkins)
    
    upcoming_reservations = await db.bookings.count_documents({"status": "Confirmed"})
    
    return DashboardStats(
        total_rooms=total_rooms,
        available_rooms=available_rooms,
        occupied_rooms=occupied_rooms,
        cleaning_rooms=cleaning_rooms,
        today_income=today_income,
        upcoming_reservations=upcoming_reservations
    )

# Reports routes
@api_router.get("/reports/daily", response_model=DailyReport)
async def get_daily_report(date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    target_date = date if date else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    check_ins = await db.bookings.count_documents({"checked_in_at": target_date})
    check_outs = await db.bookings.count_documents({"checked_out_at": target_date})
    
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
    monthly_data = []
    for month in range(1, 13):
        month_str = f"{year}-{month:02d}"
        
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


# ============== YANGI: Chiqimlar (Expenses) Routes ==============

@api_router.get("/expenses")
async def get_expenses(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Barcha chiqimlarni olish (filter bilan)
    """
    query = {}
    
    if category and category != "all":
        query["category"] = category
    
    if date_from and date_to:
        query["date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        query["date"] = {"$gte": date_from}
    elif date_to:
        query["date"] = {"$lte": date_to}
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("date", -1).to_list(5000)
    
    for expense in expenses:
        if isinstance(expense.get('created_at'), str):
            expense['created_at'] = datetime.fromisoformat(expense['created_at'])
    
    return expenses

@api_router.get("/expenses/{expense_id}")
async def get_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if isinstance(expense.get('created_at'), str):
        expense['created_at'] = datetime.fromisoformat(expense['created_at'])
    return expense

@api_router.post("/expenses", response_model=Expense)
async def create_expense(
    expense_data: ExpenseCreate, 
    current_user: User = Depends(get_current_user)
):
    """
    Yangi chiqim qo'shish
    """
    expense_date = expense_data.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    expense = Expense(
        title=expense_data.title,
        category=expense_data.category,
        amount=expense_data.amount,
        description=expense_data.description or "",
        date=expense_date,
        created_by=current_user.username
    )
    
    doc = expense.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.expenses.insert_one(doc)
    
    # Return the Pydantic model (without MongoDB's _id/ObjectId) to avoid JSON serialization errors.
    return expense

@api_router.put("/expenses/{expense_id}")
async def update_expense(
    expense_id: str, 
    expense_data: ExpenseUpdate, 
    current_user: User = Depends(get_current_user)
):
    """
    Chiqimni tahrirlash
    """
    update_data = {k: v for k, v in expense_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.expenses.update_one({"id": expense_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if isinstance(expense.get('created_at'), str):
        expense['created_at'] = datetime.fromisoformat(expense['created_at'])
    return expense

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    """
    Chiqimni o'chirish
    """
    result = await db.expenses.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted successfully"}

@api_router.get("/expenses/summary/stats")
async def get_expense_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Chiqimlar va daromadlar umumiy statistikasi
    """
    expense_query = {}
    booking_query = {}
    
    if date_from and date_to:
        expense_query["date"] = {"$gte": date_from, "$lte": date_to}
        booking_query["checked_in_at"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        expense_query["date"] = {"$gte": date_from}
        booking_query["checked_in_at"] = {"$gte": date_from}
    elif date_to:
        expense_query["date"] = {"$lte": date_to}
        booking_query["checked_in_at"] = {"$lte": date_to}
    
    # Chiqimlar
    expenses = await db.expenses.find(expense_query, {"_id": 0}).to_list(5000)
    total_expenses = sum(e["amount"] for e in expenses)
    
    # Kategoriya bo'yicha
    expenses_by_category = {}
    for e in expenses:
        cat = e.get("category", "Boshqa")
        expenses_by_category[cat] = expenses_by_category.get(cat, 0) + e["amount"]
    
    # Daromad
    bookings = await db.bookings.find(booking_query, {"_id": 0}).to_list(5000)
    total_income = sum(b["total_price"] for b in bookings)
    
    net_profit = total_income - total_expenses
    
    return {
        "total_expenses": total_expenses,
        "total_income": total_income,
        "net_profit": net_profit,
        "expenses_by_category": expenses_by_category,
        "expense_count": len(expenses)
    }

@api_router.get("/expenses/monthly/chart")
async def get_expenses_monthly_chart(
    year: int = datetime.now().year,
    current_user: User = Depends(get_current_user)
):
    """
    Oylik chiqimlar va daromadlar grafik uchun
    """
    monthly_data = []
    for month in range(1, 13):
        month_str = f"{year}-{month:02d}"
        
        # Chiqimlar
        expenses = await db.expenses.find(
            {"date": {"$regex": f"^{month_str}"}},
            {"_id": 0}
        ).to_list(5000)
        total_expenses = sum(e["amount"] for e in expenses)
        
        # Daromad
        bookings = await db.bookings.find(
            {"checked_in_at": {"$regex": f"^{month_str}"}},
            {"_id": 0}
        ).to_list(5000)
        total_income = sum(b["total_price"] for b in bookings)
        
        monthly_data.append({
            "month": datetime(year, month, 1).strftime("%B"),
            "month_num": month,
            "income": total_income,
            "expenses": total_expenses,
            "profit": total_income - total_expenses
        })
    
    return monthly_data 

app.include_router(api_router)
