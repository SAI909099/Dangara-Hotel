import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, LogOut, Plus } from 'lucide-react';

const API = '';

const Bronlar = () => {
  const [bookings, setBronlar] = useState([]);
  const [rooms, setXonas] = useState([]);
  const [guests, setMehmons] = useState([]);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isReserveDialogOpen, setIsReserveDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    guest_ids: [],
    room_id: '',
    check_in_date: '',
    check_out_date: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bookingsRes, roomsRes, guestsRes] = await Promise.all([
        api.get(`${API}/bookings`),
        api.get(`${API}/rooms`),
        api.get(`${API}/guests`)
      ]);
      setBronlar(bookingsRes.data);
      setXonas(roomsRes.data);
      setMehmons(guestsRes.data);
    } catch (error) {
      toast.error('Ma`lumotlarni yuklab bo‘lmadi');
    }
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    try {
      // Create booking (Confirmed status) then immediately check in
      const bookingRes = await api.post(`${API}/bookings`, formData);
      const newBooking = bookingRes.data;
      await api.post(`${API}/bookings/${newBooking.id}/checkin`);
      toast.success('Check-in muvaffaqiyatli!');
      fetchData();
      resetForm();
      setIsCheckInDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Check-in bajarilmadi');
    }
  };

  const handleReservation = async (e) => {
    e.preventDefault();
    try {
      // Backend endpoint is /bookings (creates with Confirmed status = reservation)
      await api.post(`${API}/bookings`, formData);
      toast.success('Bron muvaffaqiyatli yaratildi!');
      fetchData();
      resetForm();
      setIsReserveDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Bron yaratilmadi');
    }
  };

  const handleCheckOut = async (bookingId) => {
    if (window.confirm('Check-outni tasdiqlaysizmi?')) {
      try {
        // Backend uses POST for checkout, not PUT
        const response = await api.post(`${API}/bookings/${bookingId}/checkout`);
        toast.success(`Check-out muvaffaqiyatli! Jami: ${formatCurrency(response.data.total_price)}`);
        fetchData();
      } catch (error) {
        toast.error('Check-out bajarilmadi');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      guest_ids: [],
      room_id: '',
      check_in_date: '',
      check_out_date: ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('uz-UZ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace(/,/g, ' ') + ' UZS';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Confirmed': 'bg-blue-50 text-blue-700 ring-blue-600/20',
      'Checked In': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
      'Checked Out': 'bg-slate-50 text-slate-600 ring-slate-500/10',
      'Cancelled': 'bg-red-50 text-red-700 ring-red-600/20',
    };
    return badges[status] || 'bg-slate-50 text-slate-600 ring-slate-500/10';
  };

  const getStatusText = (status) => {
    const texts = {
      'Confirmed': 'Bron qilingan',
      'Checked In': 'Ichkarida',
      'Checked Out': 'Chiqib ketgan',
      'Cancelled': 'Bekor qilingan',
    };
    return texts[status] || status;
  };

  const availableXonas = rooms.filter(room => room.status === 'Available');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Bronlar</h1>
          <p className="text-slate-600">Check-in, check-out va bronlarni boshqarish</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isReserveDialogOpen} onOpenChange={(open) => {
            setIsReserveDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="reserve-room-btn" className="bg-blue-600 hover:bg-blue-700 text-white">
                <CalendarIcon className="w-4 h-4 mr-2" />
                Xonani bron qilish
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bron yaratish</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleReservation} className="space-y-4">
                <div>
                  <Label htmlFor="guest_reserve">Mehmon</Label>
                  <Select value={formData.guest_ids[0] || ''} onValueChange={(value) => setFormData({ ...formData, guest_ids: [value] })}>
                    <SelectTrigger data-testid="reserve-guest-select" className="mt-2">
                      <SelectValue placeholder="Mehmonni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {guests.map(guest => (
                        <SelectItem key={guest.id} value={guest.id}>{guest.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="room_reserve">Xona</Label>
                  <Select value={formData.room_id} onValueChange={(value) => setFormData({ ...formData, room_id: value })}>
                    <SelectTrigger data-testid="reserve-room-select" className="mt-2">
                      <SelectValue placeholder="Xonani tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableXonas.map(room => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.room_number} - {room.room_type} ({formatCurrency(room.price_per_night)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="check_in_reserve">Check-in sanasi</Label>
                  <Input
                    id="check_in_reserve"
                    data-testid="reserve-checkin-input"
                    type="date"
                    value={formData.check_in_date}
                    onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                    required
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="check_out_reserve">Check-out sanasi</Label>
                  <Input
                    id="check_out_reserve"
                    data-testid="reserve-checkout-input"
                    type="date"
                    value={formData.check_out_date}
                    onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                    required
                    className="mt-2"
                  />
                </div>
                <Button data-testid="submit-reservation-btn" type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Bron yaratish
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isCheckInDialogOpen} onOpenChange={(open) => {
            setIsCheckInDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="check-in-btn" className="bg-[#1e1b4b] hover:bg-[#312e81] text-white">
                <Plus className="w-4 h-4 mr-2" />
                Check-in
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yangi check-in</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCheckIn} className="space-y-4">
                <div>
                  <Label htmlFor="guest">Mehmon</Label>
                  <Select value={formData.guest_ids[0] || ''} onValueChange={(value) => setFormData({ ...formData, guest_ids: [value] })}>
                    <SelectTrigger data-testid="checkin-guest-select" className="mt-2">
                      <SelectValue placeholder="Mehmonni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {guests.map(guest => (
                        <SelectItem key={guest.id} value={guest.id}>{guest.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="room">Xona</Label>
                  <Select value={formData.room_id} onValueChange={(value) => setFormData({ ...formData, room_id: value })}>
                    <SelectTrigger data-testid="checkin-room-select" className="mt-2">
                      <SelectValue placeholder="Xonani tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableXonas.map(room => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.room_number} - {room.room_type} ({formatCurrency(room.price_per_night)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="check_in">Check-in sanasi</Label>
                  <Input
                    id="check_in"
                    data-testid="checkin-date-input"
                    type="date"
                    value={formData.check_in_date}
                    onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                    required
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="check_out">Check-out sanasi</Label>
                  <Input
                    id="check_out"
                    data-testid="checkout-date-input"
                    type="date"
                    value={formData.check_out_date}
                    onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                    required
                    className="mt-2"
                  />
                </div>
                <Button data-testid="submit-checkin-btn" type="submit" className="w-full bg-[#1e1b4b] hover:bg-[#312e81] text-white">
                  Check-in Mehmon
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Mehmon</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Xona</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Check-in</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Check-out</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Total Price</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Status</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} data-testid={`booking-row-${booking.id}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                    {booking.guest_names && booking.guest_names.length > 0
                      ? booking.guest_names.join(', ')
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{booking.room_number}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{booking.check_in_date}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{booking.check_out_date}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">{formatCurrency(booking.total_price)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusBadge(booking.status)}`}>
                      {getStatusText(booking.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {booking.status === 'Checked In' && (
                      <Button
                        data-testid={`checkout-btn-${booking.id}`}
                        onClick={() => handleCheckOut(booking.id)}
                        size="sm"
                        className="bg-amber-50 text-amber-700 hover:bg-amber-100"
                      >
                        <LogOut className="w-4 h-4 mr-1" />
                        Check-Out
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Bronlar;