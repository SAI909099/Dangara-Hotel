import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Home, User, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const RoomCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState('month');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [modalType, setModalType] = useState('');
  
  // Form states
  const [selectedGuest, setSelectedGuest] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [totalPrice, setTotalPrice] = useState(0);
  const [newRoomId, setNewRoomId] = useState('');

  // Uzbek month names
  const uzbekMonths = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
  ];

  // Uzbek day names
  const uzbekDays = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate price when dates or room changes
  useEffect(() => {
    if (checkInDate && checkOutDate && selectedRoom) {
      const days = Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24));
      if (days > 0) {
        setTotalPrice(days * selectedRoom.price_per_night);
      }
    }
  }, [checkInDate, checkOutDate, selectedRoom]);

  // Calculate price for new room when changing rooms
  useEffect(() => {
    if (newRoomId && checkInDate && checkOutDate) {
      const newRoom = rooms.find(r => r.id === newRoomId);
      if (newRoom) {
        const days = Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24));
        if (days > 0) {
          setTotalPrice(days * newRoom.price_per_night);
        }
      }
    } else if (selectedRoom && checkInDate && checkOutDate && !newRoomId) {
      const days = Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24));
      if (days > 0) {
        setTotalPrice(days * selectedRoom.price_per_night);
      }
    }
  }, [newRoomId, checkInDate, checkOutDate, selectedRoom, rooms]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [roomsRes, bookingsRes, guestsRes] = await Promise.all([
        fetch(`${API_URL}/rooms`, { headers }),
        fetch(`${API_URL}/bookings`, { headers }),
        fetch(`${API_URL}/guests`, { headers })
      ]);

      const roomsData = await roomsRes.json();
      const bookingsData = await bookingsRes.json();
      const guestsData = await guestsRes.json();

      setRooms(roomsData);
      setBookings(bookingsData);
      setGuests(guestsData);
      setLoading(false);
    } catch (error) {
      console.error('Ma\'lumotlarni yuklashda xatolik:', error);
      setLoading(false);
    }
  };

  const handleCellClick = (room, date, roomStatus) => {
    setSelectedRoom(room);
    setSelectedDate(date);
    setSelectedBooking(roomStatus.booking || null);
    
    if (roomStatus.status === 'available') {
      setModalType('available');
      setCheckInDate(date.toISOString().split('T')[0]);
      const tomorrow = new Date(date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setCheckOutDate(tomorrow.toISOString().split('T')[0]);
    } else if (roomStatus.status === 'reserved') {
      setModalType('reserved');
      setCheckInDate(roomStatus.booking.check_in_date);
      setCheckOutDate(roomStatus.booking.check_out_date);
    } else if (roomStatus.status === 'occupied') {
      setModalType('occupied');
      setCheckInDate(roomStatus.booking.check_in_date);
      setCheckOutDate(roomStatus.booking.check_out_date);
    }
    
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedRoom(null);
    setSelectedDate(null);
    setSelectedBooking(null);
    setSelectedGuest('');
    setCheckInDate('');
    setCheckOutDate('');
    setTotalPrice(0);
    setNewRoomId('');
  };

  const handleCreateBooking = async () => {
    if (!selectedGuest || !checkInDate || !checkOutDate) {
      alert('Iltimos, barcha maydonlarni to\'ldiring!');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guest_id: selectedGuest,
          room_id: selectedRoom.id,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
        }),
      });

      // MUHIM: Response'ni faqat bir marta o'qish
      const responseText = await response.text();
      let errorData;
      
      try {
        errorData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        errorData = { detail: responseText };
      }

      if (!response.ok) {
        const errorMessage = errorData.detail || errorData.message || 'Bron yaratib bo\'lmadi';
        alert(`Xatolik: ${errorMessage}`);
        return;
      }

      alert('Bron muvaffaqiyatli yaratildi!');
      closeModal();
      fetchData();
    } catch (error) {
      console.error('Bron yaratishda xatolik:', error);
      alert('Xatolik yuz berdi!');
    }
  };

  const handleCheckIn = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bookings/${selectedBooking.id}/checkin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        alert('Check-in muvaffaqiyatli amalga oshirildi!');
        closeModal();
        fetchData();
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText };
        }
        alert(`Xatolik: ${errorData.detail || 'Check-in amalga oshmadi'}`);
      }
    } catch (error) {
      console.error('Check-in xatolik:', error);
      alert('Xatolik yuz berdi!');
    }
  };

  const handleCheckOut = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bookings/${selectedBooking.id}/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        alert('Check-out muvaffaqiyatli amalga oshirildi!');
        closeModal();
        fetchData();
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText };
        }
        alert(`Xatolik: ${errorData.detail || 'Check-out amalga oshmadi'}`);
      }
    } catch (error) {
      console.error('Check-out xatolik:', error);
      alert('Xatolik yuz berdi!');
    }
  };

  const handleUpdateDates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bookings/${selectedBooking.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
        }),
      });

      if (response.ok) {
        alert('Sanalar muvaffaqiyatli yangilandi!');
        closeModal();
        fetchData();
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText };
        }
        alert(`Xatolik: ${errorData.detail || 'Sanalarni yangilab bo\'lmadi'}`);
      }
    } catch (error) {
      console.error('Sanalarni yangilashda xatolik:', error);
      alert('Xatolik yuz berdi!');
    }
  };

  const handleRoomChange = async () => {
    if (!newRoomId) {
      alert('Iltimos, yangi xonani tanlang!');
      return;
    }

    if (!window.confirm('Xonani almashtirmoqchimisiz? Bu amalni qaytarib bo\'lmaydi.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      
      // 1. Hozirgi xonadan check-out qilish
      const checkoutRes = await fetch(`${API_URL}/bookings/${selectedBooking.id}/checkout`, {
        method: 'POST',
        headers,
      });

      if (!checkoutRes.ok) {
        throw new Error('Check-out amalga oshmadi');
      }

      // 2. Yangi xonada yangi bron yaratish
      const newRoom = rooms.find(r => r.id === newRoomId);
      const today = new Date().toISOString().split('T')[0];
      
      const createRes = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          guest_id: selectedBooking.guest_id,
          room_id: newRoomId,
          check_in_date: today,
          check_out_date: checkOutDate,
        }),
      });

      if (!createRes.ok) {
        throw new Error('Yangi bron yaratib bo\'lmadi');
      }

      const newBookingText = await createRes.text();
      const newBooking = JSON.parse(newBookingText);
      
      // 3. Yangi bronga check-in qilish
      const checkinRes = await fetch(`${API_URL}/bookings/${newBooking.id}/checkin`, {
        method: 'POST',
        headers,
      });

      if (!checkinRes.ok) {
        throw new Error('Check-in amalga oshmadi');
      }

      alert(`Mehmon ${selectedRoom.room_number} xonasidan ${newRoom.room_number} xonasiga ko'chirildi!`);
      closeModal();
      fetchData();
    } catch (error) {
      console.error('Xonani almashtirish xatoligi:', error);
      alert(`Xatolik: ${error.message}`);
      fetchData();
    }
  };

  const handleCancelBooking = async () => {
    if (!window.confirm('Bronni bekor qilmoqchimisiz?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bookings/${selectedBooking.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert('Bron bekor qilindi!');
        closeModal();
        fetchData();
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText };
        }
        alert(`Xatolik: ${errorData.detail || 'Bronni bekor qilib bo\'lmadi'}`);
      }
    } catch (error) {
      console.error('Bronni bekor qilish xatoligi:', error);
      alert('Xatolik yuz berdi!');
    }
  };

  const getRoomStatus = (room, date) => {
    const dateStr = date.toISOString().split('T')[0];
    
    const activeBooking = bookings.find(booking => {
      const checkIn = new Date(booking.check_in_date);
      const checkOut = new Date(booking.check_out_date);
      const currentDate = new Date(dateStr);
      
      return booking.room_id === room.id &&
             currentDate >= checkIn &&
             currentDate < checkOut &&
             (booking.status === 'Confirmed' || booking.status === 'Checked In');
    });

    if (activeBooking) {
      const guest = guests.find(g => g.id === activeBooking.guest_id);
      const checkOutDate = new Date(activeBooking.check_out_date);
      
      return {
        status: activeBooking.status === 'Checked In' ? 'occupied' : 'reserved',
        booking: activeBooking,
        guest: guest,
        checkOutDate: checkOutDate
      };
    }

    return { status: 'available' };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'occupied':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'reserved':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'available':
        return 'bg-green-100 border-green-300 text-green-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'occupied':
        return 'bg-red-500';
      case 'reserved':
        return 'bg-yellow-500';
      case 'available':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getMonthsInYear = (date) => {
    const year = date.getFullYear();
    const months = [];
    for (let i = 0; i < 12; i++) {
      months.push(new Date(year, i, 1));
    }
    return months;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(currentDate.getMonth() + direction);
    } else {
      newDate.setFullYear(currentDate.getFullYear() + direction);
    }
    setCurrentDate(newDate);
  };

  const formatDate = (date) => {
    return `${uzbekMonths[date.getMonth()]} ${date.getFullYear()}`;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getMonthSummary = (month) => {
    const days = getDaysInMonth(month);
    let totalOccupied = 0;
    let totalReserved = 0;
    let totalAvailable = 0;

    rooms.forEach(room => {
      days.forEach(day => {
        const status = getRoomStatus(room, day);
        if (status.status === 'occupied') totalOccupied++;
        else if (status.status === 'reserved') totalReserved++;
        else totalAvailable++;
      });
    });

    return { totalOccupied, totalReserved, totalAvailable };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Taqvim yuklanmoqda...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Xonalar Taqvimi</h1>
          <p className="text-slate-600 mt-1">Xonalarning band bo'lishi va bronlarni ko'ring</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewType === 'month' ? 'default' : 'outline'}
            onClick={() => setViewType('month')}
          >
            Oylik Ko'rinish
          </Button>
          <Button
            variant={viewType === 'year' ? 'default' : 'outline'}
            onClick={() => setViewType('year')}
          >
            Yillik Ko'rinish
          </Button>
        </div>
      </div>

      {/* Izoh */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-sm font-medium">Bo'sh</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500"></div>
              <span className="text-sm font-medium">Bron qilingan</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span className="text-sm font-medium">Band</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigatsiya */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Oldingi
        </Button>
        <h2 className="text-2xl font-bold text-slate-900">
          {viewType === 'month' ? formatDate(currentDate) : currentDate.getFullYear()}
        </h2>
        <Button variant="outline" onClick={() => navigateMonth(1)}>
          Keyingi
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Oylik Ko'rinish */}
      {viewType === 'month' && (
        <Card>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-slate-300 bg-slate-50 p-3 text-left font-semibold text-slate-700 sticky left-0 z-10 bg-slate-50">
                      Xona
                    </th>
                    {getDaysInMonth(currentDate).map((day, idx) => (
                      <th
                        key={idx}
                        className={`border border-slate-300 p-2 text-center text-xs min-w-[100px] ${
                          isToday(day) ? 'bg-blue-50' : 'bg-slate-50'
                        }`}
                      >
                        <div className="font-semibold">{day.getDate()}</div>
                        <div className="text-slate-500 font-normal">
                          {uzbekDays[day.getDay()]}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id}>
                      <td className="border border-slate-300 p-3 font-medium sticky left-0 z-10 bg-white">
                        <div className="flex items-center gap-2">
                          <Home className="w-4 h-4 text-slate-500" />
                          <div>
                            <div className="font-semibold">{room.room_number}</div>
                            <div className="text-xs text-slate-500">{room.room_type}</div>
                          </div>
                        </div>
                      </td>
                      {getDaysInMonth(currentDate).map((day, idx) => {
                        const roomStatus = getRoomStatus(room, day);
                        return (
                          <td
                            key={idx}
                            onClick={() => handleCellClick(room, day, roomStatus)}
                            className={`border border-slate-300 p-2 text-center cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(roomStatus.status)}`}
                          >
                            {roomStatus.status === 'occupied' || roomStatus.status === 'reserved' ? (
                              <div className="text-xs space-y-1">
                                <Badge className={`${getStatusBadgeColor(roomStatus.status)} text-white text-[10px] px-1 py-0`}>
                                  {roomStatus.status === 'occupied' ? 'BAND' : 'BRON'}
                                </Badge>
                                {roomStatus.guest && (
                                  <div className="flex items-center justify-center gap-1 text-[10px]">
                                    <User className="w-3 h-3" />
                                    <span className="truncate max-w-[70px]">
                                      {roomStatus.guest.full_name.split(' ')[0]}
                                    </span>
                                  </div>
                                )}
                                {roomStatus.checkOutDate && (
                                  <div className="flex items-center justify-center gap-1 text-[10px]">
                                    <Clock className="w-3 h-3" />
                                    <span>Chiqish: {roomStatus.checkOutDate.getDate()}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs font-medium text-green-700">Bo'sh</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Yillik Ko'rinish */}
      {viewType === 'year' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {getMonthsInYear(currentDate).map((month, idx) => {
            const summary = getMonthSummary(month);
            const totalDays = summary.totalOccupied + summary.totalReserved + summary.totalAvailable;
            const occupancyRate = totalDays > 0 
              ? ((summary.totalOccupied / totalDays) * 100).toFixed(1)
              : 0;

            return (
              <Card key={idx} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    {uzbekMonths[month.getMonth()]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Bandlik darajasi:</span>
                      <span className="text-lg font-bold text-slate-900">{occupancyRate}%</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-red-500"></div>
                          <span>Band</span>
                        </div>
                        <span className="font-semibold">{summary.totalOccupied}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-yellow-500"></div>
                          <span>Bron qilingan</span>
                        </div>
                        <span className="font-semibold">{summary.totalReserved}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-green-500"></div>
                          <span>Bo'sh</span>
                        </div>
                        <span className="font-semibold">{summary.totalAvailable}</span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setCurrentDate(month);
                        setViewType('month');
                      }}
                    >
                      Batafsil Ko'rish
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Umumiy Statistika */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Jami Xonalar</p>
                <p className="text-2xl font-bold text-slate-900">{rooms.length}</p>
              </div>
              <Home className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Aktiv Bronlar</p>
                <p className="text-2xl font-bold text-slate-900">
                  {bookings.filter(b => b.status === 'Confirmed' || b.status === 'Checked In').length}
                </p>
              </div>
              <CalendarIcon className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Jami Mehmonlar</p>
                <p className="text-2xl font-bold text-slate-900">{guests.length}</p>
              </div>
              <User className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal - QISQARTIRILGAN (kodning qolgan qismi davom etadi) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {modalType === 'available' && 'Yangi Bron Yaratish'}
                  {modalType === 'reserved' && 'Bron Ma\'lumotlari'}
                  {modalType === 'occupied' && 'Mehmon Ma\'lumotlari'}
                </h2>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
              </div>

              <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Home className="w-6 h-6 text-slate-600" />
                  <div>
                    <h3 className="font-semibold text-lg">Xona: {selectedRoom?.room_number}</h3>
                    <p className="text-sm text-slate-600">{selectedRoom?.room_type}</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedRoom?.price_per_night?.toLocaleString()} so'm / kun
                    </p>
                  </div>
                </div>
              </div>

              {/* Available Room Modal */}
              {modalType === 'available' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Mehmonni tanlang</label>
                    <select value={selectedGuest} onChange={(e) => setSelectedGuest(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">Mehmon tanlang...</option>
                      {guests.map((guest) => (
                        <option key={guest.id} value={guest.id}>{guest.full_name} - {guest.phone}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Check-in sanasi</label>
                      <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Check-out sanasi</label>
                      <input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} min={checkInDate}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                    </div>
                  </div>
                  {checkInDate && checkOutDate && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">
                          Kunlar soni: {Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24))} kun
                        </span>
                        <span className="text-xl font-bold text-slate-900">Jami: {totalPrice?.toLocaleString()} so'm</span>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3 mt-6">
                    <Button onClick={handleCreateBooking} disabled={!selectedGuest || !checkInDate || !checkOutDate}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50">Bron Yaratish</Button>
                    <Button onClick={closeModal} variant="outline" className="flex-1">Bekor qilish</Button>
                  </div>
                </div>
              )}

              {/* Reserved Room Modal */}
              {modalType === 'reserved' && selectedBooking && (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-5 h-5 text-yellow-700" />
                      <span className="font-semibold">{guests.find(g => g.id === selectedBooking.guest_id)?.full_name}</span>
                    </div>
                    <p className="text-sm text-slate-600">Telefon: {guests.find(g => g.id === selectedBooking.guest_id)?.phone}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Check-in sanasi</label>
                      <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Check-out sanasi</label>
                      <input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} min={checkInDate}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                    </div>
                  </div>
                  {checkInDate && checkOutDate && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">
                          Kunlar soni: {Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24))} kun
                        </span>
                        <span className="text-xl font-bold text-slate-900">Jami: {totalPrice?.toLocaleString()} so'm</span>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3 mt-6">
                    <Button onClick={handleCheckIn} className="flex-1 bg-blue-600 hover:bg-blue-700">Check-in Qilish</Button>
                    <Button onClick={handleUpdateDates} variant="outline" className="flex-1">Sanalarni Yangilash</Button>
                  </div>
                  <Button onClick={handleCancelBooking} variant="outline" className="w-full border-red-300 text-red-600 hover:bg-red-50">
                    Bronni Bekor Qilish
                  </Button>
                </div>
              )}

              {/* Occupied Room Modal */}
              {modalType === 'occupied' && selectedBooking && (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-5 h-5 text-red-700" />
                      <span className="font-semibold">{guests.find(g => g.id === selectedBooking.guest_id)?.full_name}</span>
                    </div>
                    <p className="text-sm text-slate-600">Telefon: {guests.find(g => g.id === selectedBooking.guest_id)?.phone}</p>
                    <p className="text-sm text-slate-600 mt-2">Check-in: {new Date(selectedBooking.check_in_date).toLocaleDateString('uz-UZ')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Check-out sanasi</label>
                    <input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} min={checkInDate}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  {checkInDate && checkOutDate && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">
                            Kunlar soni: {Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24))} kun
                          </span>
                          <span className="text-lg font-bold text-slate-900">Jami: {totalPrice?.toLocaleString()} so'm</span>
                        </div>
                        {new Date(checkOutDate) > new Date(selectedBooking.check_out_date) && (
                          <p className="text-sm text-orange-600">
                            Qo'shimcha kunlar: {Math.ceil((new Date(checkOutDate) - new Date(selectedBooking.check_out_date)) / (1000 * 60 * 60 * 24))} kun
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Boshqa xonaga ko'chirish</label>
                    <select value={newRoomId} onChange={(e) => setNewRoomId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                      <option value="">Xona tanlang...</option>
                      {rooms.filter(r => r.id !== selectedRoom.id && r.status === 'Available').map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.room_number} - {room.room_type} ({room.price_per_night.toLocaleString()} so'm/kun)
                        </option>
                      ))}
                    </select>
                    {newRoomId && <p className="text-sm text-slate-600 mt-2">Hozirgi xonadan chiqib, yangi xonaga kirish amalga oshiriladi</p>}
                  </div>
                  <div className="flex gap-3 mt-6">
                    <Button onClick={handleCheckOut} className="flex-1 bg-orange-600 hover:bg-orange-700">Check-out Qilish</Button>
                    {checkOutDate !== selectedBooking.check_out_date && (
                      <Button onClick={handleUpdateDates} variant="outline" className="flex-1">Muddatni Uzaytirish</Button>
                    )}
                  </div>
                  {newRoomId && (
                    <Button onClick={handleRoomChange} className="w-full bg-purple-600 hover:bg-purple-700">Xonani Almashtirish</Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomCalendar;