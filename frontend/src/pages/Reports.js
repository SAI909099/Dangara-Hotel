import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Calendar, TrendingUp, Users, DollarSign, Printer,
  FileSpreadsheet, Filter, Plus, Trash2, Edit, X,
  ArrowDownCircle, ArrowUpCircle, Wallet, Eye, EyeOff
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:8000/api';

const EXPENSE_CATEGORIES = [
  { value: 'Maosh', label: 'Maosh (Oylik)', color: '#ef4444' },
  { value: 'Kommunal', label: 'Kommunal xizmatlar', color: '#3b82f6' },
  { value: 'Tamirlash', label: "Ta'mirlash", color: '#f59e0b' },
  { value: 'Oziq-ovqat', label: 'Oziq-ovqat', color: '#10b981' },
  { value: 'Transport', label: 'Transport', color: '#8b5cf6' },
  { value: 'Inventar', label: 'Inventar/Jihozlar', color: '#ec4899' },
  { value: 'Reklama', label: 'Reklama', color: '#06b6d4' },
  { value: 'Boshqa', label: 'Boshqa', color: '#6b7280' },
];

const PIE_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280'];

const Reports = () => {
  // Existing states
  const [dailyReport, setDailyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('daily');

  // Expense states
  const [expenses, setExpenses] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [expenseChartData, setExpenseChartData] = useState([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showExpenseList, setShowExpenseList] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseFilterCategory, setExpenseFilterCategory] = useState('all');
  const [expenseDateFrom, setExpenseDateFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [expenseDateTo, setExpenseDateTo] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Expense form
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'Boshqa',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const token = localStorage.getItem('token');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  useEffect(() => {
    fetchReports();
  }, [selectedDate, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchExpenses();
    fetchExpenseSummary();
  }, [expenseDateFrom, expenseDateTo, expenseFilterCategory]);

  useEffect(() => {
    fetchExpenseChart();
  }, [selectedYear]);

  // ============ FETCH FUNCTIONS ============

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [dailyRes, monthlyRes, revenueRes] = await Promise.all([
        fetch(`${API_URL}/reports/daily?date=${selectedDate}`, { headers }),
        fetch(`${API_URL}/reports/monthly?month=${selectedMonth}`, { headers }),
        fetch(`${API_URL}/reports/revenue?year=${selectedYear}`, { headers })
      ]);

      if (dailyRes.ok) setDailyReport(await dailyRes.json());
      if (monthlyRes.ok) setMonthlyReport(await monthlyRes.json());
      if (revenueRes.ok) setRevenueData(await revenueRes.json());
    } catch (error) {
      console.error('Hisobotlarni yuklashda xatolik:', error);
      toast.error('Hisobotlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      let url = `${API_URL}/expenses?date_from=${expenseDateFrom}&date_to=${expenseDateTo}`;
      if (expenseFilterCategory && expenseFilterCategory !== 'all') {
        url += `&category=${expenseFilterCategory}`;
      }
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      } else {
        console.error('Expenses fetch failed:', res.status);
        setExpenses([]);
      }
    } catch (error) {
      console.error('Chiqimlarni yuklashda xatolik:', error);
      setExpenses([]);
    }
  };

  const fetchExpenseSummary = async () => {
    try {
      const url = `${API_URL}/expenses/summary/stats?date_from=${expenseDateFrom}&date_to=${expenseDateTo}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setExpenseSummary(data);
      } else {
        console.error('Expense summary fetch failed:', res.status);
        setExpenseSummary(null);
      }
    } catch (error) {
      console.error('Statistika yuklashda xatolik:', error);
      setExpenseSummary(null);
    }
  };

  const fetchExpenseChart = async () => {
    try {
      const res = await fetch(
        `${API_URL}/expenses/monthly/chart?year=${selectedYear}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        setExpenseChartData(data);
      } else {
        console.error('Expense chart fetch failed:', res.status);
        setExpenseChartData([]);
      }
    } catch (error) {
      console.error('Chart data xatolik:', error);
      setExpenseChartData([]);
    }
  };

  // ============ EXPENSE CRUD ============

  // ✅ FIX: Use res.text() instead of res.json() to avoid "body stream already read" error
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();

    if (!expenseForm.title.trim()) {
      toast.error('Chiqim nomini kiriting');
      return;
    }
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      toast.error("Summani to'g'ri kiriting");
      return;
    }

    try {
      const body = {
        ...expenseForm,
        amount: parseFloat(expenseForm.amount),
      };

      let res;
      if (editingExpense) {
        res = await fetch(`${API_URL}/expenses/${editingExpense.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API_URL}/expenses`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
      }

      if (res.ok) {
        toast.success(
          editingExpense
            ? 'Chiqim muvaffaqiyatli yangilandi!'
            : "Chiqim muvaffaqiyatli qo'shildi!"
        );
        resetExpenseForm();
        fetchExpenses();
        fetchExpenseSummary();
        fetchExpenseChart();
      } else {
        // ✅ FIX: Read as text first, then try to parse as JSON
        const errorText = await res.text();
        let errorMessage = 'Xatolik yuz berdi';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Expense submit xatolik:', error);
      toast.error('Xatolik yuz berdi');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Haqiqatan ham bu chiqimni o'chirmoqchimisiz?")) return;

    try {
      const res = await fetch(`${API_URL}/expenses/${expenseId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        toast.success("Chiqim o'chirildi");
        fetchExpenses();
        fetchExpenseSummary();
        fetchExpenseChart();
      } else {
        const errorText = await res.text();
        let errorMessage = "O'chirishda xatolik";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorMessage;
        } catch {
          // use default message
        }
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("O'chirishda xatolik:", error);
      toast.error("O'chirishda xatolik");
    }
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      title: expense.title,
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description || '',
      date: expense.date,
    });
    setShowExpenseModal(true);
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      title: '',
      category: 'Boshqa',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
    setEditingExpense(null);
    setShowExpenseModal(false);
  };

  // ============ FORMAT ============

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "0 so'm";
    return (
      new Intl.NumberFormat('uz-UZ', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
        .format(amount)
        .replace(/,/g, ' ') + " so'm"
    );
  };

  // ============ EXPORT EXCEL ============

  const exportToExcel = () => {
    try {
      let data = [];
      let filename = '';

      if (viewMode === 'expenses') {
        data = [
          ['CHIQIMLAR HISOBOTI', '', '', '', ''],
          [`Davr: ${expenseDateFrom} - ${expenseDateTo}`, '', '', '', ''],
          [''],
          ['#', 'Nomi', 'Kategoriya', 'Summa', 'Sana', 'Izoh'],
          ...expenses.map((e, i) => [
            i + 1,
            e.title,
            e.category,
            e.amount,
            e.date,
            e.description || '',
          ]),
          [''],
          ['', '', "JAMI CHIQIM:", expenses.reduce((s, e) => s + e.amount, 0), '', ''],
        ];

        if (expenseSummary) {
          data.push(
            [''],
            ['MOLIYAVIY XULOSA', ''],
            ['Jami daromad:', expenseSummary.total_income],
            ['Jami chiqim:', expenseSummary.total_expenses],
            ['Sof foyda:', expenseSummary.net_profit],
            [''],
            ["KATEGORIYA BO'YICHA:", ''],
            ...Object.entries(expenseSummary.expenses_by_category).map(
              ([cat, amt]) => [cat, amt]
            )
          );
        }

        filename = `Chiqimlar_${expenseDateFrom}_${expenseDateTo}.xlsx`;
      } else if (viewMode === 'daily') {
        data = [
          ['KUNLIK HISOBOT', ''],
          ['Sana:', selectedDate],
          [''],
          ["Ko'rsatkich", 'Qiymat'],
          ['Bugungi mehmonlar', dailyReport?.guests_today || 0],
          ['Check-inlar', dailyReport?.check_ins || 0],
          ['Check-outlar', dailyReport?.check_outs || 0],
          ['Jami tushum', (dailyReport?.total_revenue || 0) + " so'm"],
        ];
        filename = `Kunlik_Hisobot_${selectedDate}.xlsx`;
      } else if (viewMode === 'monthly') {
        data = [
          ['OYLIK HISOBOT', ''],
          ['Oy:', selectedMonth],
          [''],
          ["Ko'rsatkich", 'Qiymat'],
          ['Jami mehmonlar', monthlyReport?.total_guests || 0],
          ['Band kunlar', monthlyReport?.total_occupied_days || 0],
          ['Jami daromad', (monthlyReport?.total_income || 0) + " so'm"],
          ["Eng ko'p ishlatilgan xona turi", monthlyReport?.most_used_room_type || 'N/A'],
        ];
        filename = `Oylik_Hisobot_${selectedMonth}.xlsx`;
      } else {
        data = [
          ['YILLIK HISOBOT', '', '', ''],
          ['Yil:', selectedYear, '', ''],
          [''],
          ['Oy', 'Daromad', 'Chiqim', 'Foyda'],
          ...expenseChartData.map((item) => [
            item.month,
            item.income || 0,
            item.expenses || 0,
            item.profit || 0,
          ]),
          [
            'JAMI:',
            expenseChartData.reduce((s, i) => s + (i.income || 0), 0),
            expenseChartData.reduce((s, i) => s + (i.expenses || 0), 0),
            expenseChartData.reduce((s, i) => s + (i.profit || 0), 0),
          ],
        ];
        filename = `Yillik_Hisobot_${selectedYear}.xlsx`;
      }

      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Hisobot');
      ws['!cols'] = [
        { wch: 5 },
        { wch: 30 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 30 },
      ];
      XLSX.writeFile(wb, filename);
      toast.success('Excel fayl muvaffaqiyatli yuklandi!');
    } catch (error) {
      console.error('Excel export xatolik:', error);
      toast.error('Excel export xatolik');
    }
  };

  // ============ PRINT ============

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Pop-up bloklangan. Iltimos pop-up'ga ruxsat bering.");
      return;
    }

    let content = '';

    const baseStyle = `
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        h1 { color: #1e1b4b; border-bottom: 3px solid #d4af37; padding-bottom: 10px; }
        h2 { color: #1e1b4b; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #1e1b4b; color: white; }
        .total-row { font-weight: bold; background-color: #f8fafc; }
        .profit { color: #10b981; font-weight: bold; }
        .loss { color: #ef4444; font-weight: bold; }
        .summary-box { background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px; border: 1px solid #e2e8f0; }
        .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
      </style>
    `;

    if (viewMode === 'expenses') {
      content = `
        <html><head><title>Chiqimlar Hisoboti</title>${baseStyle}</head>
        <body>
          <h1>📊 CHIQIMLAR HISOBOTI</h1>
          <p><strong>Davr:</strong> ${expenseDateFrom} — ${expenseDateTo}</p>
          
          <table>
            <tr><th>#</th><th>Nomi</th><th>Kategoriya</th><th>Summa</th><th>Sana</th><th>Izoh</th></tr>
            ${expenses.map((e, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${e.title}</td>
                <td>${e.category}</td>
                <td>${formatCurrency(e.amount)}</td>
                <td>${e.date}</td>
                <td>${e.description || '-'}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3">JAMI CHIQIM:</td>
              <td colspan="3">${formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}</td>
            </tr>
          </table>

          ${expenseSummary ? `
            <div class="summary-box">
              <h2>💰 Moliyaviy Xulosa</h2>
              <table>
                <tr><td>Jami daromad:</td><td class="profit">${formatCurrency(expenseSummary.total_income)}</td></tr>
                <tr><td>Jami chiqim:</td><td class="loss">${formatCurrency(expenseSummary.total_expenses)}</td></tr>
                <tr class="total-row">
                  <td>Sof foyda:</td>
                  <td class="${expenseSummary.net_profit >= 0 ? 'profit' : 'loss'}">
                    ${formatCurrency(expenseSummary.net_profit)}
                  </td>
                </tr>
              </table>
            </div>
          ` : ''}
          
          <div class="footer">
            Dangara Hotel — Hisobot tizimi | Chop etilgan: ${new Date().toLocaleString('uz-UZ')}
          </div>
        </body></html>
      `;
    } else if (viewMode === 'daily') {
      content = `
        <html><head><title>Kunlik Hisobot</title>${baseStyle}</head>
        <body>
          <h1>📅 KUNLIK HISOBOT</h1>
          <p><strong>Sana:</strong> ${selectedDate}</p>
          <table>
            <tr><th>Ko'rsatkich</th><th>Qiymat</th></tr>
            <tr><td>Bugungi mehmonlar</td><td>${dailyReport?.guests_today || 0}</td></tr>
            <tr><td>Check-inlar</td><td>${dailyReport?.check_ins || 0}</td></tr>
            <tr><td>Check-outlar</td><td>${dailyReport?.check_outs || 0}</td></tr>
            <tr class="total-row"><td>Jami tushum</td><td>${formatCurrency(dailyReport?.total_revenue || 0)}</td></tr>
          </table>
          <div class="footer">Dangara Hotel | ${new Date().toLocaleString('uz-UZ')}</div>
        </body></html>
      `;
    } else if (viewMode === 'monthly') {
      content = `
        <html><head><title>Oylik Hisobot</title>${baseStyle}</head>
        <body>
          <h1>📆 OYLIK HISOBOT</h1>
          <p><strong>Oy:</strong> ${selectedMonth}</p>
          <table>
            <tr><th>Ko'rsatkich</th><th>Qiymat</th></tr>
            <tr><td>Jami mehmonlar</td><td>${monthlyReport?.total_guests || 0}</td></tr>
            <tr><td>Band kunlar</td><td>${monthlyReport?.total_occupied_days || 0}</td></tr>
            <tr><td>Eng ko'p ishlatilgan xona</td><td>${monthlyReport?.most_used_room_type || 'N/A'}</td></tr>
            <tr class="total-row"><td>Jami daromad</td><td>${formatCurrency(monthlyReport?.total_income || 0)}</td></tr>
          </table>
          <div class="footer">Dangara Hotel | ${new Date().toLocaleString('uz-UZ')}</div>
        </body></html>
      `;
    } else {
      content = `
        <html><head><title>Yillik Hisobot</title>${baseStyle}</head>
        <body>
          <h1>📊 YILLIK HISOBOT</h1>
          <p><strong>Yil:</strong> ${selectedYear}</p>
          <table>
            <tr><th>Oy</th><th>Daromad</th><th>Chiqim</th><th>Foyda</th></tr>
            ${expenseChartData.map(item => `
              <tr>
                <td>${item.month}</td>
                <td>${formatCurrency(item.income || 0)}</td>
                <td>${formatCurrency(item.expenses || 0)}</td>
                <td class="${(item.profit || 0) >= 0 ? 'profit' : 'loss'}">${formatCurrency(item.profit || 0)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>JAMI:</td>
              <td>${formatCurrency(expenseChartData.reduce((s, i) => s + (i.income || 0), 0))}</td>
              <td>${formatCurrency(expenseChartData.reduce((s, i) => s + (i.expenses || 0), 0))}</td>
              <td>${formatCurrency(expenseChartData.reduce((s, i) => s + (i.profit || 0), 0))}</td>
            </tr>
          </table>
          <div class="footer">Dangara Hotel | ${new Date().toLocaleString('uz-UZ')}</div>
        </body></html>
      `;
    }

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  // ============ UI COMPONENTS ============

  const MetricCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-600">{title}</h3>
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );

  // ============ EXPENSE MODAL ============

  const expenseModal = (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-slate-900">
            {editingExpense ? '✏️ Chiqimni tahrirlash' : "➕ Yangi chiqim qo'shish"}
          </h2>
          <button
            type="button"
            onClick={resetExpenseForm}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4">
          <div>
            <Label htmlFor="exp-title">Chiqim nomi *</Label>
            <Input
              id="exp-title"
              value={expenseForm.title}
              onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
              placeholder="Masalan: Elektr energiyasi to'lovi"
              className="mt-1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="exp-category">Kategoriya</Label>
              <Select
                value={expenseForm.category}
                onValueChange={(val) => setExpenseForm({ ...expenseForm, category: val })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="exp-amount">Summa (so'm) *</Label>
              <Input
                id="exp-amount"
                type="number"
                min="0"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                placeholder="0"
                className="mt-1"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="exp-date">Sana</Label>
            <Input
              id="exp-date"
              type="date"
              value={expenseForm.date}
              onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="exp-desc">Izoh</Label>
            <textarea
              id="exp-desc"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              placeholder="Qo'shimcha ma'lumot..."
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e1b4b] resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={resetExpenseForm}
              className="flex-1"
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#1e1b4b] hover:bg-[#312e81] text-white"
            >
              {editingExpense ? 'Yangilash' : "Qo'shish"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  // ============ LOADING ============

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#1e1b4b] mx-auto mb-4" />
          <div className="text-xl font-semibold text-slate-700">Yuklanmoqda...</div>
        </div>
      </div>
    );
  }

  // ============ RENDER ============

  return (
    <div className="space-y-8 pb-8">
      {/* Modal */}
      {showExpenseModal && expenseModal}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1e1b4b] to-[#312e81] rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-3">
          Hisobotlar va Analitika
        </h1>
        <p className="text-lg text-slate-200">
          Kunlik, oylik, yillik ko'rsatkichlar va chiqimlarni boshqaring
        </p>
      </div>

      {/* Filter & Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-5 h-5 text-slate-600" />
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">📅 Kunlik ko'rinish</SelectItem>
                <SelectItem value="monthly">📆 Oylik ko'rinish</SelectItem>
                <SelectItem value="yearly">📊 Yillik ko'rinish</SelectItem>
                <SelectItem value="expenses">💸 Chiqimlar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => {
                resetExpenseForm();
                setShowExpenseModal(true);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Chiqim qo'shish
            </Button>

            <Button
              onClick={() => {
                setViewMode('expenses');
                setShowExpenseList(!showExpenseList);
              }}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              {showExpenseList ? (
                <EyeOff className="w-4 h-4 mr-2" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Chiqimlarni ko'rish
            </Button>

            <Button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="w-4 h-4 mr-2" />
              Chop etish
            </Button>

            <Button
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>
      </div>

      {/* ============ CHIQIMLAR VIEW ============ */}
      {viewMode === 'expenses' && (
        <div className="space-y-6">
          {/* Date & Category Filter */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">🔍 Filter</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Boshlanish sanasi</Label>
                <Input
                  type="date"
                  value={expenseDateFrom}
                  onChange={(e) => setExpenseDateFrom(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Tugash sanasi</Label>
                <Input
                  type="date"
                  value={expenseDateTo}
                  onChange={(e) => setExpenseDateTo(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Kategoriya</Label>
                <Select
                  value={expenseFilterCategory}
                  onValueChange={setExpenseFilterCategory}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barchasi</SelectItem>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {expenseSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Jami daromad"
                value={formatCurrency(expenseSummary.total_income)}
                icon={ArrowUpCircle}
                color="bg-gradient-to-br from-emerald-500 to-emerald-600"
                subtitle="Barcha bronlardan"
              />
              <MetricCard
                title="Jami chiqim"
                value={formatCurrency(expenseSummary.total_expenses)}
                icon={ArrowDownCircle}
                color="bg-gradient-to-br from-red-500 to-red-600"
                subtitle={`${expenseSummary.expense_count} ta chiqim`}
              />
              <MetricCard
                title="Sof foyda"
                value={formatCurrency(expenseSummary.net_profit)}
                icon={Wallet}
                color={
                  expenseSummary.net_profit >= 0
                    ? 'bg-gradient-to-br from-[#d4af37] to-amber-600'
                    : 'bg-gradient-to-br from-red-600 to-red-700'
                }
                subtitle={expenseSummary.net_profit >= 0 ? 'Foydada ✅' : 'Zararda ❌'}
              />
              <MetricCard
                title="Chiqimlar soni"
                value={expenseSummary.expense_count}
                icon={Calendar}
                color="bg-gradient-to-br from-[#1e1b4b] to-[#312e81]"
                subtitle={`${expenseDateFrom} — ${expenseDateTo}`}
              />
            </div>
          )}

          {/* Pie Chart - Kategoriya bo'yicha */}
          {expenseSummary &&
            expenseSummary.expenses_by_category &&
            Object.keys(expenseSummary.expenses_by_category).length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    📊 Kategoriya bo'yicha chiqimlar
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(
                            expenseSummary.expenses_by_category
                          ).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {Object.entries(
                            expenseSummary.expenses_by_category
                          ).map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Kategoriya jadval */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    📋 Kategoriya tafsiloti
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(expenseSummary.expenses_by_category)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, amount], idx) => {
                        const catInfo = EXPENSE_CATEGORIES.find(
                          (c) => c.value === cat
                        );
                        const percentage =
                          expenseSummary.total_expenses > 0
                            ? ((amount / expenseSummary.total_expenses) * 100).toFixed(1)
                            : 0;
                        return (
                          <div
                            key={cat}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{
                                  backgroundColor:
                                    catInfo?.color ||
                                    PIE_COLORS[idx % PIE_COLORS.length],
                                }}
                              />
                              <span className="font-medium text-slate-700">
                                {catInfo?.label || cat}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-slate-900">
                                {formatCurrency(amount)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {percentage}%
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

          {/* Expenses Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b bg-slate-50">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  💸 Chiqimlar ro'yxati ({expenses.length})
                </h3>
                <Button
                  onClick={() => {
                    resetExpenseForm();
                    setShowExpenseModal(true);
                  }}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Yangi
                </Button>
              </div>
            </div>

            {expenses.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Wallet className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium">Chiqimlar topilmadi</p>
                <p className="text-sm mt-1">
                  Yangi chiqim qo'shish uchun tugmani bosing
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#1e1b4b] text-white">
                      <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Nomi</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Kategoriya</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Summa</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Sana</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Izoh</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense, index) => {
                      const catInfo = EXPENSE_CATEGORIES.find(
                        (c) => c.value === expense.category
                      );
                      return (
                        <tr
                          key={expense.id}
                          className="border-b hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {expense.title}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                              style={{
                                backgroundColor: catInfo?.color || '#6b7280',
                              }}
                            >
                              {catInfo?.label || expense.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-red-600">
                            -{formatCurrency(expense.amount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {expense.date}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500 max-w-[200px] truncate">
                            {expense.description || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditExpense(expense)}
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                                title="Tahrirlash"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition"
                                title="O'chirish"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={3} className="px-4 py-3 text-slate-900">
                        JAMI:
                      </td>
                      <td className="px-4 py-3 text-red-600">
                        -{formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ KUNLIK VIEW ============ */}
      {viewMode === 'daily' && dailyReport && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-slate-900">Kunlik hisobot</h2>
            <div className="w-56">
              <Label className="text-sm mb-2 block font-semibold">
                Sanani tanlang
              </Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Bugungi mehmonlar"
              value={dailyReport.guests_today}
              icon={Users}
              color="bg-gradient-to-br from-[#1e1b4b] to-[#312e81]"
            />
            <MetricCard
              title="Check-inlar"
              value={dailyReport.check_ins}
              icon={Calendar}
              color="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <MetricCard
              title="Check-outlar"
              value={dailyReport.check_outs}
              icon={Calendar}
              color="bg-gradient-to-br from-amber-500 to-amber-600"
            />
            <MetricCard
              title="Jami tushum"
              value={formatCurrency(dailyReport.total_revenue)}
              icon={DollarSign}
              color="bg-gradient-to-br from-[#d4af37] to-amber-600"
            />
          </div>
        </div>
      )}

      {/* ============ OYLIK VIEW ============ */}
      {viewMode === 'monthly' && monthlyReport && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-slate-900">Oylik hisobot</h2>
            <div className="w-56">
              <Label className="text-sm mb-2 block font-semibold">
                Oyni tanlang
              </Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Jami mehmonlar"
              value={monthlyReport.total_guests}
              icon={Users}
              color="bg-gradient-to-br from-[#1e1b4b] to-[#312e81]"
            />
            <MetricCard
              title="Band kunlar"
              value={monthlyReport.total_occupied_days}
              icon={Calendar}
              color="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <MetricCard
              title="Jami daromad"
              value={formatCurrency(monthlyReport.total_income)}
              icon={DollarSign}
              color="bg-gradient-to-br from-[#d4af37] to-amber-600"
            />
            <MetricCard
              title="Eng ko'p ishlatilgan"
              value={monthlyReport.most_used_room_type}
              icon={TrendingUp}
              color="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
          </div>
        </div>
      )}

      {/* ============ YILLIK VIEW ============ */}
      {viewMode === 'yearly' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-slate-900">Yillik hisobot</h2>
            <div className="w-56">
              <Label className="text-sm mb-2 block font-semibold">
                Yilni tanlang
              </Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(val) => setSelectedYear(parseInt(val))}
              >
                <SelectTrigger className="border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025, 2026].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              title="Yillik jami tushum"
              value={formatCurrency(
                expenseChartData.reduce((s, i) => s + (i.income || 0), 0)
              )}
              icon={ArrowUpCircle}
              color="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <MetricCard
              title="Yillik jami chiqim"
              value={formatCurrency(
                expenseChartData.reduce((s, i) => s + (i.expenses || 0), 0)
              )}
              icon={ArrowDownCircle}
              color="bg-gradient-to-br from-red-500 to-red-600"
            />
            <MetricCard
              title="Yillik sof foyda"
              value={formatCurrency(
                expenseChartData.reduce((s, i) => s + (i.profit || 0), 0)
              )}
              icon={Wallet}
              color={
                expenseChartData.reduce((s, i) => s + (i.profit || 0), 0) >= 0
                  ? 'bg-gradient-to-br from-[#d4af37] to-amber-600'
                  : 'bg-gradient-to-br from-red-600 to-red-700'
              }
            />
          </div>
        </div>
      )}

      {/* ============ CHARTS ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daromad vs Chiqim Bar Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-2xl transition-shadow">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1e1b4b] to-[#312e81] flex items-center justify-center mr-3">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Daromad vs Chiqim
              </h2>
              <p className="text-sm text-slate-500">{selectedYear}-yil</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseChartData.length > 0 ? expenseChartData : revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  style={{ fontSize: '11px' }}
                />
                <YAxis
                  stroke="#64748b"
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                  style={{ fontSize: '11px' }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(value),
                    name === 'income'
                      ? 'Daromad'
                      : name === 'expenses'
                      ? 'Chiqim'
                      : name === 'revenue'
                      ? 'Daromad'
                      : 'Foyda',
                  ]}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value === 'income'
                      ? 'Daromad'
                      : value === 'expenses'
                      ? 'Chiqim'
                      : value === 'revenue'
                      ? 'Daromad'
                      : 'Foyda'
                  }
                />
                {expenseChartData.length > 0 ? (
                  <>
                    <Bar
                      dataKey="income"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="expenses"
                      fill="#ef4444"
                      radius={[6, 6, 0, 0]}
                    />
                  </>
                ) : (
                  <Bar
                    dataKey="revenue"
                    fill="#1e1b4b"
                    radius={[12, 12, 0, 0]}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Foyda Line Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-2xl transition-shadow">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#d4af37] to-amber-600 flex items-center justify-center mr-3">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Foyda tendensiyasi
              </h2>
              <p className="text-sm text-slate-500">{selectedYear}-yil</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={expenseChartData.length > 0 ? expenseChartData : revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  style={{ fontSize: '11px' }}
                />
                <YAxis
                  stroke="#64748b"
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                  style={{ fontSize: '11px' }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(value),
                    name === 'profit'
                      ? 'Foyda'
                      : name === 'income'
                      ? 'Daromad'
                      : name === 'revenue'
                      ? 'Daromad'
                      : 'Chiqim',
                  ]}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value === 'profit'
                      ? 'Foyda'
                      : value === 'income'
                      ? 'Daromad'
                      : value === 'revenue'
                      ? 'Daromad'
                      : 'Chiqim'
                  }
                />
                {expenseChartData.length > 0 ? (
                  <>
                    <Line
                      type="monotone"
                      dataKey="income"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ fill: '#ef4444', r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#d4af37"
                      strokeWidth={3}
                      dot={{ fill: '#d4af37', r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  </>
                ) : (
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#d4af37"
                    strokeWidth={3}
                    dot={{ fill: '#d4af37', r: 6 }}
                    activeDot={{ r: 8 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
