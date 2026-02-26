import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Printer, Search, Plus, Eye, History } from "lucide-react";

// api.js baseURL: http://localhost:8000/api  (shuning uchun bu yerda /api qo‘shmang)
const API = "";

/**
 * Agar backend /api/guests ro‘yxatda "fuqaroligi", "manzil", "oxirgi xona", "jami sarf" kabi maydonlarni qaytarmasa,
 * quyidagi enrich funksiyalar bu qiymatlarni detail/history endpointlardan olib to‘ldiradi.
 *
 * Eslatma: Har sahifada odatda 20 ta mehmon bo‘lgani uchun bu usul odatda tez ishlaydi.
 */
const ENRICH_MISSING_FROM_DETAIL = true;     // /guests/:id dan nation/region/street va h.k. olish
const ENRICH_SUMMARY_FROM_HISTORY = true;    // /guests/:id/history dan oxirgi xona + jami sarf hisoblash
const ENRICH_CONCURRENCY = 4;                // bir vaqtda nechta request
const HISTORY_LIMIT = 1000;

// --- helpers ---
const getGuestId = (g) => g?.id || g?._id || g?.guest_id;

const pick = (...vals) => vals.find((v) => v !== null && v !== undefined && v !== "");

const fmt = (v) => (v === null || v === undefined || v === "" ? "-" : String(v));

const fmtPhone = (v) => {
  if (!v) return "-";
  return String(v).replace(/\s+/g, " ").trim();
};

const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("uz-UZ");
};

const fmtMoney = (v) => {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("uz-UZ");
};

const getAmount = (r) =>
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
  r?.booking?.total_amount ??
  r?.booking?.total_price ??
  r?.reservation?.total_amount ??
  r?.payment?.amount ??
  r?.payment?.total_amount ??
  r?.payment?.summa ??
  null;

// ✅ Backend model bo‘yicha manzil yig‘ish: region + street
const buildAddress = (g) => {
  const region = pick(g?.region, g?.state, g?.province, g?.district);
  const street = pick(g?.street, g?.street_name, g?.address_line, g?.addressLine);
  const addressText = pick(g?.address, g?.home_address, g?.living_address);

  // 1) Agar region/street bo‘lsa, shuni chiqaramiz
  const combined = [region, street].filter(Boolean).join(", ");
  if (combined) return combined;

  // 2) Aks holda, bor bo‘lsa addressText
  if (addressText) return String(addressText);

  return "";
};

// try to read common guest fields (fallbacks for different schemas)
const mapGuestRow = (g) => {
  const fullName = pick(
    g?.full_name,
    g?.fullname,
    g?.name,
    `${g?.first_name || ""} ${g?.last_name || ""}`.trim()
  );

  // Backend: passport_id (eski), id_number (yangi)
  const passport = pick(
    g?.passport_id,
    g?.id_number,
    g?.passport,
    g?.document_no,
    g?.documentNo
  );

  // ✅ Backend: nation = Fuqaroligi
  const citizenship = pick(
    g?.nation,                // <<<<< MUHIM
    g?.citizenship,
    g?.nationality,
    g?.country,
    g?.citizen
  );

  // ✅ Backend: region+street = Manzil
  const address = pick(
    buildAddress(g),          // <<<<< MUHIM
    g?.address,
    g?.home_address,
    g?.homeAddress,
    g?.living_address,
    g?.livingAddress
  );

  const company = pick(g?.company, g?.workplace, g?.job, g?.organization);
  const notes = pick(g?.notes, g?.comment, g?.description);

  // optional summary fields (if backend provides)
  const lastRoom = pick(
    g?.last_room,
    g?.lastRoom,
    g?.room_number,
    g?.roomNo,
    g?.room?.number,
    g?.last_booking?.room_number,
    g?.lastBooking?.room_number
  );

  const totalSpent = pick(
    g?.total_spent,
    g?.spent_total,
    g?.total_amount,
    g?.total_price,
    g?.amount_total,
    g?.total,
    g?.payments_total,
    g?.paid_total
  );

  const visits = pick(g?.visits, g?.visits_count, g?.bookings_count, g?.stays_count);

  return {
    id: getGuestId(g),
    full_name: fullName || "-",
    phone: pick(g?.phone, g?.phone_number, g?.mobile) || "-",
    passport_id: passport || "-",
    gender: pick(g?.gender, g?.sex) || "-",
    birth_date: pick(g?.birth_date, g?.dob, g?.birthday) || null,

    // ✅ endi to‘g‘ri chiqadi
    citizenship: citizenship || "-",
    address: address || "-",

    company: company || "-",
    notes: notes || "-",
    created_at: pick(g?.created_at, g?.createdAt) || null,

    last_room: lastRoom || "-",
    total_spent: totalSpent ?? null,
    visits: visits ?? null,
  };
};

// CSV export
const toCSV = (rows) => {
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = ["F.I.Sh", "Telefon", "Pasport/ID", "Fuqaroligi", "Manzil", "Oxirgi xona", "Jami sarf (UZS)", "Yaratilgan"];
  const lines = [header.map(esc).join(",")];

  rows.forEach((r) => {
    lines.push(
      [
        r.full_name,
        r.phone,
        r.passport_id,
        r.citizenship,
        r.address,
        r.last_room,
        fmtMoney(r.total_spent),
        r.created_at ? fmtDate(r.created_at) : "-",
      ].map(esc).join(",")
    );
  });

  return lines.join("\n");
};

// --- Enrich helpers (concurrency-limited pool) ---
async function runPool(items, limit, worker) {
  const out = new Array(items.length);
  let idx = 0;

  async function runOne() {
    while (idx < items.length) {
      const current = idx;
      idx += 1;
      // eslint-disable-next-line no-await-in-loop
      out[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, runOne);
  await Promise.all(workers);
  return out;
}

// Fill missing data from GET /guests/:id
async function enrichFromDetail(row) {
  try {
    const guestId = row.id;
    if (!guestId) return row;

    const needCit = !row.citizenship || row.citizenship === "-";
    const needAddr = !row.address || row.address === "-";
    const needName = !row.full_name || row.full_name === "-";
    const needPhone = !row.phone || row.phone === "-";
    const needPass = !row.passport_id || row.passport_id === "-";

    if (!needCit && !needAddr && !needName && !needPhone && !needPass) return row;

    const res = await api.get(`${API}/guests/${guestId}`);
    const g = res.data || {};

    const merged = mapGuestRow({ ...g, ...row });
    return {
      ...merged,
      last_room: row.last_room ?? merged.last_room,
      total_spent: row.total_spent ?? merged.total_spent,
      visits: row.visits ?? merged.visits,
    };
  } catch {
    return row;
  }
}

// Compute last_room + total_spent from history
async function enrichFromHistory(row) {
  try {
    const guestId = row.id;
    if (!guestId) return row;

    const needRoom = !row.last_room || row.last_room === "-";
    const needSum = row.total_spent === null || row.total_spent === undefined;
    const needVisits = row.visits === null || row.visits === undefined;

    if (!needRoom && !needSum && !needVisits) return row;

    const histRes = await api.get(`${API}/guests/${guestId}/history`, {
      params: { sort_by: "check_in_date", sort_dir: "desc", limit: HISTORY_LIMIT },
    });

    const data = histRes.data;
    const items = Array.isArray(data) ? data : (data?.items || data?.history || data?.data || []);
    if (!items.length) {
      return {
        ...row,
        visits: needVisits ? 0 : row.visits,
        total_spent: needSum ? 0 : row.total_spent,
      };
    }

    const latest = items[0];
    const last_room = pick(
      latest?.room_number,
      latest?.room?.number,
      latest?.room_name,
      latest?.room?.name,
      row.last_room
    );

    const sum = items.reduce((acc, r) => {
      const v = getAmount(r);
      const n = Number(v);
      return acc + (Number.isNaN(n) ? 0 : n);
    }, 0);

    return {
      ...row,
      last_room: needRoom ? (last_room || "-") : row.last_room,
      total_spent: needSum ? sum : row.total_spent,
      visits: needVisits ? items.length : row.visits,
    };
  } catch {
    return row;
  }
}

export default function Guests() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState([]);

  const [filters, setFilters] = useState({
    q: "",
    sort_by: "created_at",
    sort_dir: "desc",
    page: 1,
    limit: 50,
  });

  const [total, setTotal] = useState(null);

  const fetchGuests = async () => {
    try {
      setLoading(true);

      // ⚠️ Backend /guests da search param nomi: search
      // Siz frontend’da q ishlatyapsiz — shuni search ga map qilyapmiz
      const params = {
        search: filters.q || undefined,
        // Backend’da pagination/sort yo‘q — lekin jo‘natish zarar qilmaydi
        sort_by: filters.sort_by || undefined,
        sort_dir: filters.sort_dir || undefined,
        page: filters.page,
        limit: filters.limit,
      };

      const res = await api.get(`${API}/guests`, { params });

      const data = res.data;
      const items = Array.isArray(data) ? data : (data?.items || data?.data || []);
      let mapped = items.map(mapGuestRow);

      if (mapped.length && (ENRICH_MISSING_FROM_DETAIL || ENRICH_SUMMARY_FROM_HISTORY)) {
        mapped = await runPool(mapped, ENRICH_CONCURRENCY, async (row) => {
          let r = row;
          if (ENRICH_MISSING_FROM_DETAIL) r = await enrichFromDetail(r);
          if (ENRICH_SUMMARY_FROM_HISTORY) r = await enrichFromHistory(r);
          return r;
        });
      }

      setGuests(mapped);
      // Backend hozircha List qaytaradi; total aniq emas.
      // Best-effort: joriy sahifada limitga teng bo'lsa keyingi sahifa bo'lishi mumkin.
      setTotal(mapped.length < filters.limit ? ((filters.page - 1) * filters.limit) + mapped.length : null);
    } catch (e) {
      toast.error("Mehmonlar roʻyxatini yuklab bo‘lmadi");
      setGuests([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit]);

  const applyFilters = () => {
    setFilters((p) => ({ ...p, page: 1 }));
    setTimeout(fetchGuests, 0);
  };

  const rows = useMemo(() => guests, [guests]);

  const handleExport = () => {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mehmonlar.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const title = "Mehmonlar roʻyxati";
    const htmlRows = rows
      .map(
        (r, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${fmt(r.full_name)}</td>
        <td>${fmtPhone(r.phone)}</td>
        <td>${fmt(r.passport_id)}</td>
        <td>${fmt(r.citizenship)}</td>
        <td>${fmt(r.address)}</td>
        <td>${fmt(r.last_room)}</td>
        <td>${fmtMoney(r.total_spent)}</td>
      </tr>`
      )
      .join("");

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
          <div class="meta">Chop etilgan vaqt: ${new Date().toLocaleString("uz-UZ")}</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>F.I.Sh</th>
                <th>Telefon</th>
                <th>Pasport/ID</th>
                <th>Fuqaroligi</th>
                <th>Manzil</th>
                <th>Oxirgi xona</th>
                <th>Jami sarf (UZS)</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.length
                  ? htmlRows
                  : `<tr><td colspan="8" style="text-align:center;color:#666;">Ma'lumot yo‘q</td></tr>`
              }
            </tbody>
          </table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>`;

    const w = window.open("", "_blank");
    if (!w) return toast.error("Print oynasi ochilmadi (popup bloklangan bo‘lishi mumkin).");
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const canPrev = filters.page > 1;
  const canNext = total ? filters.page * filters.limit < total : rows.length === filters.limit;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Mehmonlar</h1>
          <p className="text-slate-600">Barcha mehmonlar roʻyxati va ma’lumotlari</p>
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
          <Button variant="outline" onClick={() => navigate("/guests/archive")} className="border-slate-200 hover:bg-slate-50">
            <History className="w-4 h-4 mr-2" />
            Arxiv
          </Button>
          <Button onClick={() => navigate("/guests/new")} className="bg-[#1e1b4b] hover:bg-[#312e81] text-white">
            <Plus className="w-4 h-4 mr-2" />
            Mehmon qo‘shish
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-3">
            <Label>Qidiruv</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="F.I.Sh, telefon, pasport, manzil..."
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label>Saralash</Label>
            <Select value={filters.sort_by} onValueChange={(v) => setFilters({ ...filters, sort_by: v })}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Yaratilgan vaqt</SelectItem>
                <SelectItem value="full_name">Ism</SelectItem>
                <SelectItem value="phone">Telefon</SelectItem>
                <SelectItem value="total_spent">Jami sarf</SelectItem>
                <SelectItem value="visits">Tashriflar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Yo‘nalish</Label>
            <Select value={filters.sort_dir} onValueChange={(v) => setFilters({ ...filters, sort_dir: v })}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Kamayish</SelectItem>
                <SelectItem value="asc">O‘sish</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Har sahifada</Label>
            <Select
              value={String(filters.limit)}
              onValueChange={(v) => setFilters({ ...filters, limit: Number(v), page: 1 })}
            >
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-6">
            <Button onClick={applyFilters} className="bg-[#1e1b4b] hover:bg-[#312e81] text-white">
              Filtrni qo‘llash
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">F.I.Sh</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Telefon</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Pasport/ID</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Fuqaroligi</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Manzil</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Oxirgi xona</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Jami sarf</th>
                <th className="text-left px-6 py-3 text-xs uppercase font-semibold tracking-wider text-slate-500">Amallar</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500">Yuklanmoqda...</td>
                </tr>
              ) : rows.length ? (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-800 font-medium">{fmt(r.full_name)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{fmtPhone(r.phone)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{fmt(r.passport_id)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{fmt(r.citizenship)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700 max-w-[280px] truncate" title={r.address}>
                      {fmt(r.address)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{fmt(r.last_room)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{fmtMoney(r.total_spent)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="border-slate-200 hover:bg-slate-50"
                          onClick={() => navigate(`/guests/${r.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ko‘rish
                        </Button>

                        <Link to={`/guests/${r.id}/history`}>
                          <Button variant="outline" className="border-slate-200 hover:bg-slate-50">
                            <History className="w-4 h-4 mr-2" />
                            Tarix
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500">Ma'lumot yo‘q</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <div className="text-sm text-slate-600">
            Sahifa: <b>{filters.page}</b>
            {typeof total === "number" ? (
              <>
                {" "} | Jami: <b>{total}</b>
              </>
            ) : null}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-slate-200 hover:bg-slate-50"
              disabled={!canPrev}
              onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
            >
              Oldingi
            </Button>
            <Button
              variant="outline"
              className="border-slate-200 hover:bg-slate-50"
              disabled={!canNext}
              onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
            >
              Keyingi
            </Button>
          </div>
        </div>
      </div>

      {(ENRICH_MISSING_FROM_DETAIL || ENRICH_SUMMARY_FROM_HISTORY) ? (
        <div className="text-xs text-slate-500">
          Eslatma: Ro‘yxatda yo‘q ma’lumotlar detail/history endpointlardan olinmoqda.
        </div>
      ) : null}
    </div>
  );
}
