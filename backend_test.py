import requests
import sys
from datetime import datetime, timedelta
import json

class HotelAPITester:
    def __init__(self, base_url="https://dangara-admin.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.receptionist_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            if not success:
                details += f", Expected: {expected_status}"
                if response.text:
                    details += f", Response: {response.text[:200]}"

            self.log_test(name, success, details)
            return success, response.json() if success and response.text else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_authentication(self):
        """Test login functionality"""
        print("\n🔐 Testing Authentication...")
        
        # Test admin login
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            self.log_test("Admin Token Retrieved", True)
        else:
            self.log_test("Admin Token Retrieved", False, "No token in response")

        # Test receptionist login
        success, response = self.run_test(
            "Receptionist Login",
            "POST",
            "auth/login",
            200,
            data={"username": "reception", "password": "reception123"}
        )
        if success and 'token' in response:
            self.receptionist_token = response['token']
            self.log_test("Receptionist Token Retrieved", True)
        else:
            self.log_test("Receptionist Token Retrieved", False, "No token in response")

        # Test invalid login
        self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"username": "invalid", "password": "invalid"}
        )

        # Test auth/me endpoint
        if self.admin_token:
            self.run_test(
                "Get Current User (Admin)",
                "GET",
                "auth/me",
                200,
                token=self.admin_token
            )

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print("\n📊 Testing Dashboard...")
        
        if not self.admin_token:
            self.log_test("Dashboard Stats", False, "No admin token available")
            return

        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.admin_token
        )
        
        if success:
            required_fields = ['total_rooms', 'available_rooms', 'occupied_rooms', 'today_income', 'upcoming_reservations']
            for field in required_fields:
                if field in response:
                    self.log_test(f"Dashboard - {field} present", True)
                else:
                    self.log_test(f"Dashboard - {field} present", False, f"Missing field: {field}")

    def test_rooms_management(self):
        """Test rooms CRUD operations"""
        print("\n🏨 Testing Rooms Management...")
        
        if not self.admin_token:
            self.log_test("Rooms Management", False, "No admin token available")
            return

        # Get all rooms
        success, rooms = self.run_test(
            "Get All Rooms",
            "GET",
            "rooms",
            200,
            token=self.admin_token
        )

        # Filter rooms by status
        self.run_test(
            "Filter Rooms by Status",
            "GET",
            "rooms?status=Available",
            200,
            token=self.admin_token
        )

        # Create new room (admin only)
        room_data = {
            "room_number": "999",
            "room_type": "Test",
            "price_per_night": 100000,
            "status": "Available",
            "description": "Test room"
        }
        success, new_room = self.run_test(
            "Create Room (Admin)",
            "POST",
            "rooms",
            200,
            data=room_data,
            token=self.admin_token
        )

        room_id = None
        if success and 'id' in new_room:
            room_id = new_room['id']
            self.log_test("Room ID Retrieved", True)

        # Test receptionist cannot create room
        self.run_test(
            "Create Room (Receptionist - Should Fail)",
            "POST",
            "rooms",
            403,
            data=room_data,
            token=self.receptionist_token
        )

        # Update room (admin only)
        if room_id:
            update_data = {"description": "Updated test room"}
            self.run_test(
                "Update Room (Admin)",
                "PUT",
                f"rooms/{room_id}",
                200,
                data=update_data,
                token=self.admin_token
            )

            # Delete room (admin only)
            self.run_test(
                "Delete Room (Admin)",
                "DELETE",
                f"rooms/{room_id}",
                200,
                token=self.admin_token
            )

    def test_guests_management(self):
        """Test guests CRUD operations"""
        print("\n👥 Testing Guests Management...")
        
        if not self.receptionist_token:
            self.log_test("Guests Management", False, "No receptionist token available")
            return

        # Get all guests
        self.run_test(
            "Get All Guests",
            "GET",
            "guests",
            200,
            token=self.receptionist_token
        )

        # Search guests
        self.run_test(
            "Search Guests",
            "GET",
            "guests?search=Alisher",
            200,
            token=self.receptionist_token
        )

        # Create new guest
        guest_data = {
            "full_name": "Test Guest",
            "phone": "+998901111111",
            "passport_id": "TEST123456"
        }
        success, new_guest = self.run_test(
            "Create Guest",
            "POST",
            "guests",
            200,
            data=guest_data,
            token=self.receptionist_token
        )

        guest_id = None
        if success and 'id' in new_guest:
            guest_id = new_guest['id']

        # Update guest
        if guest_id:
            update_data = {"phone": "+998901111112"}
            self.run_test(
                "Update Guest",
                "PUT",
                f"guests/{guest_id}",
                200,
                data=update_data,
                token=self.receptionist_token
            )

            # Get guest history
            self.run_test(
                "Get Guest History",
                "GET",
                f"guests/{guest_id}/history",
                200,
                token=self.receptionist_token
            )

    def test_bookings_management(self):
        """Test bookings operations"""
        print("\n📅 Testing Bookings Management...")
        
        if not self.receptionist_token:
            self.log_test("Bookings Management", False, "No receptionist token available")
            return

        # Get all bookings
        success, bookings = self.run_test(
            "Get All Bookings",
            "GET",
            "bookings",
            200,
            token=self.receptionist_token
        )

        # Filter bookings by status
        self.run_test(
            "Filter Bookings by Status",
            "GET",
            "bookings?status=active",
            200,
            token=self.receptionist_token
        )

        # Get available rooms and guests for booking test
        success, rooms = self.run_test(
            "Get Available Rooms for Booking",
            "GET",
            "rooms?status=Available",
            200,
            token=self.receptionist_token
        )

        success, guests = self.run_test(
            "Get Guests for Booking",
            "GET",
            "guests",
            200,
            token=self.receptionist_token
        )

        if rooms and guests and len(rooms) > 0 and len(guests) > 0:
            # Create reservation
            reservation_data = {
                "guest_id": guests[0]['id'],
                "room_id": rooms[0]['id'],
                "check_in_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
                "check_out_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
            }
            success, reservation = self.run_test(
                "Create Reservation",
                "POST",
                "bookings/reserve",
                200,
                data=reservation_data,
                token=self.receptionist_token
            )

            # Create check-in (if we have another available room)
            if len(rooms) > 1:
                checkin_data = {
                    "guest_id": guests[0]['id'],
                    "room_id": rooms[1]['id'],
                    "check_in_date": datetime.now().strftime("%Y-%m-%d"),
                    "check_out_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
                }
                success, booking = self.run_test(
                    "Create Check-in",
                    "POST",
                    "bookings",
                    200,
                    data=checkin_data,
                    token=self.receptionist_token
                )

                # Test checkout
                if success and 'id' in booking:
                    self.run_test(
                        "Check-out Booking",
                        "PUT",
                        f"bookings/{booking['id']}/checkout",
                        200,
                        token=self.receptionist_token
                    )

    def test_reports(self):
        """Test reports functionality"""
        print("\n📈 Testing Reports...")
        
        if not self.receptionist_token:
            self.log_test("Reports", False, "No receptionist token available")
            return

        # Daily report
        today = datetime.now().strftime("%Y-%m-%d")
        success, daily_report = self.run_test(
            "Daily Report",
            "GET",
            f"reports/daily?date={today}",
            200,
            token=self.receptionist_token
        )

        if success:
            required_fields = ['date', 'guests_today', 'check_ins', 'check_outs', 'total_revenue']
            for field in required_fields:
                if field in daily_report:
                    self.log_test(f"Daily Report - {field} present", True)
                else:
                    self.log_test(f"Daily Report - {field} present", False, f"Missing field: {field}")

        # Monthly report
        current_month = datetime.now().strftime("%Y-%m")
        success, monthly_report = self.run_test(
            "Monthly Report",
            "GET",
            f"reports/monthly?month={current_month}",
            200,
            token=self.receptionist_token
        )

        if success:
            required_fields = ['month', 'total_guests', 'total_occupied_days', 'total_income', 'most_used_room_type']
            for field in required_fields:
                if field in monthly_report:
                    self.log_test(f"Monthly Report - {field} present", True)
                else:
                    self.log_test(f"Monthly Report - {field} present", False, f"Missing field: {field}")

        # Revenue data
        self.run_test(
            "Revenue Data",
            "GET",
            "reports/revenue?year=2025",
            200,
            token=self.receptionist_token
        )

    def test_users_management(self):
        """Test user management (admin only)"""
        print("\n👤 Testing Users Management...")
        
        if not self.admin_token:
            self.log_test("Users Management", False, "No admin token available")
            return

        # Get all users (admin only)
        self.run_test(
            "Get All Users (Admin)",
            "GET",
            "users",
            200,
            token=self.admin_token
        )

        # Test receptionist cannot access users
        self.run_test(
            "Get Users (Receptionist - Should Fail)",
            "GET",
            "users",
            403,
            token=self.receptionist_token
        )

        # Create new user (admin only)
        user_data = {
            "username": f"testuser_{datetime.now().strftime('%H%M%S')}",
            "password": "testpass123",
            "role": "receptionist"
        }
        success, new_user = self.run_test(
            "Create User (Admin)",
            "POST",
            "users",
            200,
            data=user_data,
            token=self.admin_token
        )

        # Test receptionist cannot create user
        self.run_test(
            "Create User (Receptionist - Should Fail)",
            "POST",
            "users",
            403,
            data=user_data,
            token=self.receptionist_token
        )

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Hotel Management API Tests...")
        print(f"Testing against: {self.base_url}")
        
        self.test_authentication()
        self.test_dashboard_stats()
        self.test_rooms_management()
        self.test_guests_management()
        self.test_bookings_management()
        self.test_reports()
        self.test_users_management()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = HotelAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())