import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL || '/api';

export default function GuestCreate() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    id_type: "passport",
    id_number: "",
    birth_date: "",
    nation: "",
    region: "",
    street: "",
  });

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    if (!form.full_name.trim()) return "F.I.Sh majburiy";
    if (!form.phone.trim()) return "Telefon majburiy";
    if (!form.id_number.trim()) return "Pasport/ID raqami majburiy";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    try {
      setSaving(true);

      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        id_type: form.id_type || "passport",
        id_number: form.id_number.trim(),
        passport_id: form.id_type === "passport" ? form.id_number.trim() : "",
        birth_date: form.birth_date || null,
        nation: form.nation?.trim() || null,
        region: form.region?.trim() || null,
        street: form.street?.trim() || null,
      };

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/guests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Mehmon qo\'shib bo\'lmadi');
      }

      const data = await response.json();
      toast.success("Mehmon muvaffaqiyatli qo'shildi");
      navigate("/guests");
    } catch (error) {
      console.error('Mehmon qo\'shish xatoligi:', error);
      toast.error(error.message || "Mehmon qo'shishda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
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
            <h1 className="text-3xl font-bold text-slate-900">Yangi mehmon</h1>
            <p className="text-slate-600">Mehmon ma'lumotlarini kiriting</p>
          </div>
        </div>

        <Button
          onClick={onSubmit}
          disabled={saving}
          className="bg-[#1e1b4b] hover:bg-[#312e81] text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saqlanmoqda..." : "Saqlash"}
        </Button>
      </div>

      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label>F.I.Sh *</Label>
            <Input
              className="mt-2"
              value={form.full_name}
              onChange={(e) => onChange("full_name", e.target.value)}
              placeholder="Masalan: Tursinbekov Yotsin"
              required
            />
          </div>

          <div>
            <Label>Telefon *</Label>
            <Input
              className="mt-2"
              value={form.phone}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="+998..."
              required
            />
          </div>

          <div>
            <Label>Hujjat turi</Label>
            <Select value={form.id_type} onValueChange={(v) => onChange("id_type", v)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="passport">Pasport</SelectItem>
                <SelectItem value="driver_license">Haydovchilik guvohnomasi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Pasport/ID raqami *</Label>
            <Input
              className="mt-2"
              value={form.id_number}
              onChange={(e) => onChange("id_number", e.target.value)}
              placeholder="AB1234567"
              required
            />
          </div>

          <div>
            <Label>Tug'ilgan sana</Label>
            <Input
              className="mt-2"
              type="date"
              value={form.birth_date}
              onChange={(e) => onChange("birth_date", e.target.value)}
            />
          </div>

          <div>
            <Label>Fuqaroligi</Label>
            <Input
              className="mt-2"
              value={form.nation}
              onChange={(e) => onChange("nation", e.target.value)}
              placeholder="Masalan: O'zbekiston"
            />
          </div>

          <div>
            <Label>Viloyat / Tuman</Label>
            <Input
              className="mt-2"
              value={form.region}
              onChange={(e) => onChange("region", e.target.value)}
              placeholder="Masalan: Farg'ona, Dang'ara"
            />
          </div>

          <div>
            <Label>Ko'cha / Manzil</Label>
            <Input
              className="mt-2"
              value={form.street}
              onChange={(e) => onChange("street", e.target.value)}
              placeholder="Masalan: Mustaqillik ko'chasi 12-uy"
            />
          </div>

          <div className="md:col-span-2 flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#1e1b4b] hover:bg-[#312e81] text-white"
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-slate-200 hover:bg-slate-50"
              onClick={() => navigate("/guests")}
            >
              Bekor qilish
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}