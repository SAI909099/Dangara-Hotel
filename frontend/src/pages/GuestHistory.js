import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Download, Printer, Search } from 'lucide-react';

// IMPORTANT:
// api.js already uses baseURL = http://localhost:8000/api
// so here we must NOT add "/api" again.
const API = '';

const statusLabel = (s) => {
  const m = {
    // Backend statuses (exact match)
    'Confirmed': 'Bron qilingan',
    'Checked In': 'Check-in',
    'Checked Out': 'Check-out',
    'Cancelled': 'Bekor qilingan',
    // Legacy lowercase fallbacks
    reserved: 'Bron qilingan',
    checked_in: 'Check-in',
    checked_out: 'Check-out',
    cancelled: 'Bekor qilingan',
  };
  return m[s] || s || '-';
};

// ✅ get amount from different possible backend field names (with nested fallbacks)
const getAmount = (r) =>
  // direct
  r?.total_amount ??
  r?.totalAmount ??
  r?.total_price ??
  r?.totalPrice ??
  r?.amount ??
  r?.price ??
  r?.summa ??
  r?.total ??
  r?.booking_total ??
  r?.bookingTotal ??
  // nested: booking / reservation / payment
  r?.booking?.total_amount ??
  r?.booking?.totalAmount ??
  r?.booking?.total_price ??
  r?.booking?.totalPrice ??
  r?.booking?.amount ??
  r?.reservation?.total_amount ??
  r?.reservation?.total_price ??
  r?.payment?.amount ??
  r?.payment?.total_amount ??
  r?.payment?.summa ??
  null;

// ✅ format UZS nicely
const formatUZS = (v) => {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString('uz-UZ');
};

const toCSV = (rows) => {
  const esc = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = ['Mehmon', 'Xona', 'Check-in', 'Check-out', 'Kun', 'Holat', 'Summa (UZS)'];
  const lines = [header.map(esc).join(',')];

  rows.forEach((r) => {
    lines.push(
      [
        r.guest_name || r.guest?.full_name || '-', // fallback
        r.room_number || r.room?.number || '-',
        r.check_in_date || r.check_in || '-',
        r.check_out_date || r.check_out || '-',
        r.nights ?? '-',
        statusLabel(r.status),
        formatUZS(getAmount(r)), // ✅ fixed
      ].map(esc).join(',')
    );
  });

  return lines.join('\n');
};

const GuestHistory = () => {
  const { guestId } = useParams();

  const [guest, setGuest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    q: '',
    status: 'all',
    date_from: '',
    date_to: '',
    sort_by: 'check_in_date',
    sort_dir: 'desc',
  });

  const fetchAll = async () => {
    try {
      setLoading(true);

      // ✅ NO /api here (api.js already has /api)
      const guestRes = await api.get(`${API}/guests/${guestId}`);
      setGuest(guestRes.data);

      const params = {};
      if (filters.q) params.q = filters.q;
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.sort_dir) params.sort_dir = filters.sort_dir;

      // ✅ NO /api here too
      const histRes = await api.get(`${API}/guests/${guestId}/history`, { params });

      // support either: array OR {items:[...]}
      const data = histRes.data;
      const items = Array.isArray(data) ? data : (data?.items || data?.history || []);
      setHistory(items);
    } catch (e) {
      toast.error('Tarixni yuklab bo‘lmadi');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestId]);

  const applyFilters = () => fetchAll();

  const rows = useMemo(() => history, [history]);

  const handleExport = () => {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mehmon-tarix-${guestId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const title = `Mehmon tarixi - ${guest?.full_name || guestId}`;
    const html = `
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 18px; margin: 0 0 12px; }
            .meta { margin: 0 0 18px; color: #555; font-size: 12px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">
            Telefon: ${guest?.phone || '-'} &nbsp; | &nbsp;
            ID: ${(guest?.id_number || guest?.passport_id || '-')}
          </div>
          <table>
            <thead>
              <tr>
                <th>Xona</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Kun</th>
                <th>Holat</th>
                <th>Summa (UZS)</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length
        ? rows.map(r => `
                    <tr>
                      <td>${r.room_number || r.room?.number || '-'}</td>
                      <td>${r.check_in_date || r.check_in || '-'}</td>
                      <td>${r.check_out_date || r.check_out || '-'}</td>
                      <td>${r.nights ?? '-'}</td>
                      <td>${statusLabel(r.status)}</td>
                      <td>${formatUZS(getAmount(r))}</td>
                    </tr>
                  `).join('')
        : `<tr><td colspan="6" style="text-align:center;color:#666;">Ma'lumot yo‘q</td></tr>`
      }
            </tbody>
          </table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>`;

    const w = window.open('', '_blank');
    if (!w) return toast.error('Print oynasi ochilmadi (popup bloklangan bo‘lishi mumkin).');
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/guests">
            <Button variant="outline" className="border-slate-200 hover:bg-slate-50">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Orqaga
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Mehmon tarixi</h1>
            <p className="text-slate-600">
              {guest ? `${guest.full_name} — ${guest.phone || ''}` : 'Yuklanmoqda...'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="border-slate-200 hover:bg-slate-50">
            <Download className="w-4 h-4 mr-2" />
            Excel (CSV)
          </Button>
          <Button variant="outline" onClick={handlePrint} className="border-slate-200 hover:bg-slate-50">
            <Printer className="w-4 h-4 mr-2" />
            Chop etish
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <Label>Qidiruv</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="Xona raqami, holat va h.k."
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label>Holat</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hammasi</SelectItem>
                <SelectItem value="reserved">Bron qilingan</SelectItem>
                <SelectItem value="checked_in">Check-in</SelectItem>
                <SelectItem value="checked_out">Check-out</SelectItem>
                <SelectItem value="cancelled">Bekor qilingan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Dan (sana)</Label>
            <Input
              className="mt-2"
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            />
          </div>

          <div>
            <Label>Gacha (sana)</Label>
            <Input
              className="mt-2"
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            />
          </div>

          <div>
            <Label>Saralash</Label>
            <Select value={filters.sort_by} onValueChange={(v) => setFilters({ ...filters, sort_by: v })}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="check_in_date">Check-in sanasi</SelectItem>
                <SelectItem value="created_at">Yaratilgan vaqt</SelectItem>
                <SelectItem value="total_amount">Summa</SelectItem>
                <SelectItem value="nights">Kun</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Yo‘nalish</Label>
            <Select value={filters.sort_dir} onValueChange={(v) => setFilters({ ...filters, sort_dir: v })}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Kamayish</SelectItem>
                <SelectItem value="asc">O‘sish</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-5">
            <Button onClick={applyFilters} className="bg-[#1e1b4b] hover:bg-[#312e81] text-white">
              Filtrni qo‘llash
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Xona</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Check-in</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Check-out</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Kun</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Holat</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Summa</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">Yuklanmoqda...</td>
                </tr>
              ) : rows.length ? (
                rows.map((r) => (
                  <tr key={r.id || `${r.room_number}-${r.check_in_date}-${r.check_out_date}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-700 font-medium">{r.room_number || r.room?.number || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{r.check_in_date || r.check_in || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{r.check_out_date || r.check_out || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{r.nights ?? '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{statusLabel(r.status)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{formatUZS(getAmount(r))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">Ma'lumot yo‘q</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GuestHistory;