import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "@/utils/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, History } from "lucide-react";

const API = "";

const pick = (...vals) => vals.find((v) => v !== null && v !== undefined && String(v).trim() !== "");

const fmt = (v) => (v === null || v === undefined || v === "" ? "-" : String(v));

const fmtAddress = (g) => {
  const region = (g?.region || "").trim();
  const street = (g?.street || "").trim();
  if (!region && !street) return "-";
  if (region && street) return `${region}, ${street}`;
  return region || street;
};

export default function GuestDetail() {
  const { guestId } = useParams();
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get(`${API}/guests/${guestId}`);
      setGuest(res.data || null);
    } catch (e) {
      toast.error("Mehmon ma’lumotini yuklab bo‘lmadi");
      setGuest(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestId]);

  // ✅ Derive display values safely from your backend schema
  const docTypeLabel = useMemo(() => {
    const t = (guest?.id_type || "").toLowerCase();
    if (t === "driver_license") return "Haydovchilik guvohnomasi";
    if (t === "passport") return "Pasport";
    return guest?.id_type ? String(guest.id_type) : "-";
  }, [guest]);

  const docNumber = useMemo(
    () => pick(guest?.id_number, guest?.passport_id),
    [guest]
  );

  const nation = useMemo(
    () => pick(guest?.nation),
    [guest]
  );

  const address = useMemo(
    () => fmtAddress(guest),
    [guest]
  );

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
            <h1 className="text-3xl font-bold text-slate-900">Mehmon ma’lumotlari</h1>
            <p className="text-slate-600">{loading ? "Yuklanmoqda..." : fmt(guest?.full_name)}</p>
          </div>
        </div>

        <Link to={`/guests/${guestId}/history`}>
          <Button variant="outline" className="border-slate-200 hover:bg-slate-50">
            <History className="w-4 h-4 mr-2" />
            Tarix
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        {loading ? (
          <div className="text-slate-500">Yuklanmoqda...</div>
        ) : !guest ? (
          <div className="text-slate-500">Ma’lumot topilmadi</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><b>F.I.Sh:</b> {fmt(guest.full_name)}</div>
            <div><b>Telefon:</b> {fmt(guest.phone)}</div>

            <div><b>Hujjat turi:</b> {fmt(docTypeLabel)}</div>
            <div><b>Pasport/ID raqami:</b> {fmt(docNumber)}</div>

            <div><b>Tug‘ilgan sana:</b> {fmt(guest.birth_date)}</div>
            <div><b>Fuqaroligi:</b> {fmt(nation)}</div>

            <div className="md:col-span-2"><b>Manzil:</b> {fmt(address)}</div>

            <div className="md:col-span-2 text-xs text-slate-500 pt-2">
              ID: {fmt(guest.id)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
