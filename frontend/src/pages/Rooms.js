import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Filter } from 'lucide-react';

const API = '';

const Rooms = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [filterHolati, setFilterHolati] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState({
    room_number: '',
    room_type: '',
    price_per_night: '',
    status: 'Available',
    description: ''
  });

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (filterHolati === 'all') {
      setFilteredRooms(rooms);
    } else {
      setFilteredRooms(rooms.filter(room => room.status === filterHolati));
    }
  }, [rooms, filterHolati]);

  const fetchRooms = async () => {
    try {
      const response = await api.get(`${API}/rooms`);
      setRooms(response.data);
    } catch (error) {
      toast.error('Xonalarni yuklab bo‘lmadi');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await api.put(`${API}/rooms/${editingRoom.id}`, formData);
        toast.success('Xona muvaffaqiyatli yangilandi');
      } else {
        await api.post(`${API}/rooms`, formData);
        toast.success('Xona muvaffaqiyatli qo‘shildi');
      }
      fetchRooms();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Amal bajarilmadi');
    }
  };

  const handleDelete = async (roomId) => {
    if (window.confirm('Haqiqatan ham bu xonani o‘chirmoqchimisiz?')) {
      try {
        await api.delete(`${API}/rooms/${roomId}`);
        toast.success('Xona o‘chirildi');
        fetchRooms();
      } catch (error) {
        toast.error('Xonani o‘chirib bo‘lmadi');
      }
    }
  };

  const openEditDialog = (room) => {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number,
      room_type: room.room_type,
      price_per_night: room.price_per_night,
      status: room.status,
      description: room.description || ''
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRoom(null);
    setFormData({
      room_number: '',
      room_type: '',
      price_per_night: '',
      status: 'Available',
      description: ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('uz-UZ', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount).replace(/,/g, ' ') + ' UZS';
  };

  const getHolatiBadge = (status) => {
    const badges = {
      Available: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
      Occupied: 'bg-amber-50 text-amber-700 ring-amber-600/20',
      Reserved: 'bg-blue-50 text-blue-700 ring-blue-600/20',
      Cleaning: 'bg-slate-50 text-slate-700 ring-slate-600/20'
    };
    return badges[status] || badges.Available;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Xonalar</h1>
          <p className="text-slate-600">Xonalar va bandlik holatini boshqarish</p>
        </div>
        {user.role === 'admin' && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="add-room-btn" className="bg-[#1e1b4b] hover:bg-[#312e81] text-white">
                <Plus className="w-4 h-4 mr-2" />
                Xona qo‘shish
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRoom ? 'Xonani tahrirlash' : 'Yangi xona qo‘shish'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="room_number">Xona raqami</Label>
                  <Input
                    id="room_number"
                    data-testid="room-number-input"
                    value={formData.room_number}
                    onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                    required
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="room_type">Xona turi</Label>
                  <Select value={formData.room_type} onValueChange={(value) => setFormData({ ...formData, room_type: value })}>
                    <SelectTrigger data-testid="room-type-select" className="mt-2">
                      <SelectValue placeholder="Xona turini tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Yakka</SelectItem>
                      <SelectItem value="Double">Ikki kishilik</SelectItem>
                      <SelectItem value="Suite">Lyuks</SelectItem>
                      <SelectItem value="VIP">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="price_per_night">Bir kecha narxi (so‘m)</Label>
                  <Input
                    id="price_per_night"
                    data-testid="room-price-input"
                    type="number"
                    value={formData.price_per_night}
                    onChange={(e) => setFormData({ ...formData, price_per_night: e.target.value })}
                    required
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="status">Holati</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger data-testid="room-status-select" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Available">Bo‘sh</SelectItem>
                      <SelectItem value="Occupied">Band</SelectItem>
                      <SelectItem value="Reserved">Bron qilingan</SelectItem>
                      <SelectItem value="Cleaning">Tozalanmoqda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Izoh</Label>
                  <Input
                    id="description"
                    data-testid="room-description-input"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <Button data-testid="submit-room-btn" type="submit" className="w-full bg-[#1e1b4b] hover:bg-[#312e81] text-white">
                  {editingRoom ? 'Yangilash' : 'Saqlash'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Filter className="w-5 h-5 text-slate-600" />
        <Select value={filterHolati} onValueChange={setFilterHolati}>
          <SelectTrigger data-testid="filter-status-select" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha xonalar</SelectItem>
            <SelectItem value="Available">Bo‘sh</SelectItem>
            <SelectItem value="Occupied">Band</SelectItem>
            <SelectItem value="Reserved">Bron qilingan</SelectItem>
            <SelectItem value="Cleaning">Tozalanmoqda</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Xona raqami</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Turi</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Narx/kecha</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Holati</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Izoh</th>
                {user.role === 'admin' && (
                  <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Amallar</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => (
                <tr key={room.id} data-testid={`room-row-${room.room_number}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-700 font-medium">{room.room_number}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{room.room_type}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{formatCurrency(room.price_per_night)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getHolatiBadge(room.status)}`}>
                      {room.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{room.description || '-'}</td>
                  {user.role === 'admin' && (
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button
                          data-testid={`edit-room-btn-${room.room_number}`}
                          onClick={() => openEditDialog(room)}
                          size="sm"
                          className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          data-testid={`delete-room-btn-${room.room_number}`}
                          onClick={() => handleDelete(room.id)}
                          size="sm"
                          className="bg-red-50 text-red-600 hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Rooms;