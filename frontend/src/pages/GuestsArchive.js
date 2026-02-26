import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, History } from 'lucide-react';
import { toast } from 'sonner';

const API = '';

const fmtMoney = (v) => {
  const n = Number(v || 0);
  if (Number.isNaN(n)) return '-';
  return `${n.toLocaleString('uz-UZ')} so'm`;
};

const fmtDate = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('uz-UZ');
};

const statusLabel = (s) => {
  const m = {
    'Confirmed': 'Bron qilingan',
    'Checked In': 'Check-in',
    'Checked Out': 'Check-out',
    'Cancelled': 'Bekor qilingan',
  };
  return m[s] || s || '-';
};

export default function GuestsArchive() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    q: '',
    status: 'all',
    date_from: '',
    date_to: '',
    sort_by: 'check_in_date',
    sort_dir: 'desc',
    page: 1,
    limit: 50,
  });

  const fetchArchive = async () => {
    try {
      setLoading(true);
      const params = {
        q: filters.q || undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        sort_by: filters.sort_by,
        sort_dir: filters.sort_dir,
        page: filters.page,
        limit: filters.limit,
      };

      const res = await api.get(`${API}/guests/archive`, { params });
      const data = res.data || {};
      const items = Array.isArray(data) ? data : (data.items || []);
      setRows(items);
      setTotal(Number(data.total || items.length || 0));
    } catch (e) {
      setRows([]);
      setTotal(0);
      toast.error("Mehmonlar arxivini yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit]);

  const applyFilters = () => {
    setFilters((prev) => ({ ...prev, page: 1 }));
    setTimeout(fetchArchive, 0);
  };

  const totalPages = useMemo(() => {
    if (!total || !filters.limit) return null;
    return Math.max(1, Math.ceil(total / filters.limit));
  }, [total, filters.limit]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-slate-200 hover:bg-slate-50"
            onClick={() => navigate('/guests')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Orqaga
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Mehmonlar arxivi</h1>
            <p className="text-slate-600">Mehmonning qachon kelgani, qaysi xonada turgani, necha kun va qancha to'lagani</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <Label>Qidiruv</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                className="pl-10"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="Mehmon, xona, holat..."
              />
            </div>
          </div>

          <div>
            <Label>Holat</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hammasi</SelectItem>
                <SelectItem value="confirmed">Bron qilingan</SelectItem>
                <SelectItem value="checked_in">Check-in</SelectItem>
                <SelectItem value="checked_out">Check-out</SelectItem>
                <SelectItem value="cancelled">Bekor qilingan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Dan</Label>
            <Input className="mt-2" type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
          </div>

          <div>
            <Label>Gacha</Label>
            <Input className="mt-2" type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
          </div>

          <div>
            <Label>Har sahifada</Label>
            <Select value={String(filters.limit)} onValueChange={(v) => setFilters({ ...filters, limit: Number(v), page: 1 })}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Saralash</Label>
            <Select value={filters.sort_by} onValueChange={(v) => setFilters({ ...filters, sort_by: v })}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="check_in_date">Check-in sanasi</SelectItem>
                <SelectItem value="check_out_date">Check-out sanasi</SelectItem>
                <SelectItem value="guest_name">Mehmon</SelectItem>
                <SelectItem value="room_number">Xona</SelectItem>
                <SelectItem value="nights">Kun</SelectItem>
                <SelectItem value="total_amount">To'lov</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Yo'nalish</Label>
            <Select value={filters.sort_dir} onValueChange={(v) => setFilters({ ...filters, sort_dir: v })}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Kamayish</SelectItem>
                <SelectItem value="asc">O'sish</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-6">
            <Button onClick={applyFilters} className="bg-[#1e1b4b] hover:bg-[#312e81] text-white">
              Filtrni qo'llash
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Mehmon</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Telefon</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Xona</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Kelgan sana</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Ketgan sana</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Kun</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">To'lov</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Holat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Amal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">Yuklanmoqda...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">Arxivda ma'lumot topilmadi</td>
                </tr>
              ) : rows.map((r) => (
                <tr key={`${r.booking_id}-${r.guest_id}`} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{r.guest_name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{r.guest_phone || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{r.room_number || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmtDate(r.check_in_date)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmtDate(r.check_out_date)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{r.nights ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(r.total_price)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{statusLabel(r.status)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <Link to={`/guests/${r.guest_id}/history`}>
                      <Button variant="outline" className="border-slate-200 hover:bg-slate-50">
                        <History className="w-4 h-4 mr-2" />
                        Tarix
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <div className="text-sm text-slate-600">
            Jami yozuvlar: <b>{total}</b>
            {totalPages ? <> | Sahifa: <b>{filters.page}</b> / <b>{totalPages}</b></> : null}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-slate-200 hover:bg-slate-50"
              disabled={filters.page <= 1}
              onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
            >
              Oldingi
            </Button>
            <Button
              variant="outline"
              className="border-slate-200 hover:bg-slate-50"
              disabled={totalPages ? filters.page >= totalPages : rows.length < filters.limit}
              onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
            >
              Keyingi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
