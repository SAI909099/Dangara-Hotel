import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PAGE_PERMISSION_OPTIONS, ROLE_DEFAULT_PERMISSIONS, normalizePermissions } from '@/lib/permissions';
import { toast } from 'sonner';
import { Plus, UserCog } from 'lucide-react';

const API = '';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'receptionist',
    permissions: ROLE_DEFAULT_PERMISSIONS.receptionist,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      toast.error('Foydalanuvchilarni yuklab bo‘lmadi');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        permissions: normalizePermissions(formData.permissions, formData.role),
      };
      await api.post(`${API}/users`, payload);
      toast.success('Foydalanuvchi yaratildi');
      fetchUsers();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Foydalanuvchi yaratilmadi');
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      role: 'receptionist',
      permissions: ROLE_DEFAULT_PERMISSIONS.receptionist,
    });
  };

  const handleRoleChange = (role) => {
    setFormData((prev) => ({
      ...prev,
      role,
      permissions: normalizePermissions(ROLE_DEFAULT_PERMISSIONS[role] || ['dashboard'], role),
    }));
  };

  const togglePermission = (permissionKey, checked) => {
    setFormData((prev) => {
      const next = checked
        ? [...(prev.permissions || []), permissionKey]
        : (prev.permissions || []).filter((p) => p !== permissionKey);
      return {
        ...prev,
        permissions: normalizePermissions(next, prev.role),
      };
    });
  };

  const getRolBadge = (role) => {
    if (role === 'admin') return 'bg-[#1e1b4b] text-white ring-[#1e1b4b]/20';
    if (role === 'accountant') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
    return 'bg-blue-50 text-blue-700 ring-blue-600/20';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Foydalanuvchilar</h1>
          <p className="text-slate-600">Tizim foydalanuvchilari va rollarini boshqarish</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="add-user-btn" className="bg-[#1e1b4b] hover:bg-[#312e81] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Foydalanuvchi qo‘shish
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yangi foydalanuvchi</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">Login</Label>
                <Input
                  id="username"
                  data-testid="user-username-input"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="password">Parol</Label>
                <Input
                  id="password"
                  data-testid="user-password-input"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="role">Rol</Label>
                <Select value={formData.role} onValueChange={handleRoleChange}>
                  <SelectTrigger data-testid="user-role-select" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="receptionist">Resepsion</SelectItem>
                    <SelectItem value="accountant">Hisobchi (Accountant)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ruxsatlar (Pages)</Label>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-slate-200 p-3">
                  {PAGE_PERMISSION_OPTIONS.map((perm) => {
                    const checked = normalizePermissions(formData.permissions, formData.role).includes(perm.key);
                    const locked = formData.role === 'admin';
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-center gap-3 rounded-md px-2 py-2 ${locked ? 'bg-slate-50' : 'hover:bg-slate-50 cursor-pointer'}`}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={locked || perm.key === 'users'}
                          onCheckedChange={(value) => togglePermission(perm.key, Boolean(value))}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-800">{perm.label}</span>
                          <span className="text-xs text-slate-500">{perm.path}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  `Users` sahifasi faqat admin uchun. `Dashboard` doim yoqilgan.
                </p>
              </div>
              <Button data-testid="submit-user-btn" type="submit" className="w-full bg-[#1e1b4b] hover:bg-[#312e81] text-white">
                Saqlash
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Login</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Rol</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Ruxsatlar</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Yaratilgan sana</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} data-testid={`user-row-${user.username}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-[#d4af37] flex items-center justify-center text-white font-semibold text-xs mr-3">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      {user.username}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize ${getRolBadge(user.role)}`}>
                      <UserCog className="w-3 h-3 mr-1" />
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    <div className="flex flex-wrap gap-1.5 max-w-md">
                      {normalizePermissions(user.permissions, user.role).map((perm) => (
                        <span
                          key={`${user.id}-${perm}`}
                          className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        >
                          {PAGE_PERMISSION_OPTIONS.find((p) => p.key === perm)?.label || perm}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {new Date(user.created_at).toLocaleDateString('uz-UZ')}
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

export default Users;
