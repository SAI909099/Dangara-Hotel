import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, TrendingUp, Users, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API = '';

const Reports = () => {
  const [dailyReport, setDailyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchReports();
  }, [selectedDate, selectedMonth]);

  const fetchReports = async () => {
    try {
      const [dailyRes, monthlyRes, revenueRes] = await Promise.all([
        api.get(`${API}/reports/daily?date=${selectedDate}`),
        api.get(`${API}/reports/monthly?month=${selectedMonth}`),
        api.get(`${API}/reports/revenue?year=2025`)
      ]);
      setDailyReport(dailyRes.data);
      setMonthlyReport(monthlyRes.data);
      setRevenueData(revenueRes.data);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('uz-UZ', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount).replace(/,/g, ' ') + ' UZS';
  };

  const MetricCard = ({ title, value, icon: Icon, color, testId }) => (
    <div data-testid={testId} className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-600">{title}</h3>
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );

  const COLORS = ['#1e1b4b', '#d4af37', '#10b981', '#3b82f6'];

  if (!dailyReport || !monthlyReport) {
    return <div className="flex items-center justify-center h-full">Yuklanmoqda...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Hisobotlar va analitika</h1>
        <p className="text-slate-600">Kunlik, oylik va yillik ko‘rsatkichlarni ko‘ring</p>
      </div>

      {/* Kunlik hisobot */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Kunlik hisobot</h2>
          <div className="w-48">
            <Label htmlFor="date-picker" className="text-sm mb-2 block">Sanani tanlang</Label>
            <Input
              id="date-picker"
              data-testid="daily-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            testId="daily-guests-card"
            title="Bugungi mehmonlar"
            value={dailyReport.guests_today}
            icon={Users}
            color="bg-[#1e1b4b]"
          />
          <MetricCard
            testId="daily-checkins-card"
            title="Check-inlar"
            value={dailyReport.check_ins}
            icon={Calendar}
            color="bg-emerald-500"
          />
          <MetricCard
            testId="daily-checkouts-card"
            title="Check-outlar"
            value={dailyReport.check_outs}
            icon={Calendar}
            color="bg-amber-500"
          />
          <MetricCard
            testId="daily-revenue-card"
            title="Jami tushum"
            value={formatCurrency(dailyReport.total_revenue)}
            icon={DollarSign}
            color="bg-[#d4af37]"
          />
        </div>
      </div>

      {/* Oylik hisobot */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Oylik hisobot</h2>
          <div className="w-48">
            <Label htmlFor="month-picker" className="text-sm mb-2 block">Oyni tanlang</Label>
            <Input
              id="month-picker"
              data-testid="monthly-month-picker"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            testId="monthly-guests-card"
            title="Jami mehmonlar"
            value={monthlyReport.total_guests}
            icon={Users}
            color="bg-[#1e1b4b]"
          />
          <MetricCard
            testId="monthly-days-card"
            title="Band kunlar"
            value={monthlyReport.total_occupied_days}
            icon={Calendar}
            color="bg-blue-500"
          />
          <MetricCard
            testId="monthly-income-card"
            title="Jami daromad"
            value={formatCurrency(monthlyReport.total_income)}
            icon={DollarSign}
            color="bg-[#d4af37]"
          />
          <MetricCard
            testId="monthly-roomtype-card"
            title="Eng ko‘p ishlatilgan xona turi"
            value={monthlyReport.most_used_room_type}
            icon={TrendingUp}
            color="bg-emerald-500"
          />
        </div>
      </div>

      {/* Yearly Revenue Chart */}
      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <h2 className="text-2xl font-semibold text-slate-900 mb-6">Yillik tushum (2025)</h2>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <Bar dataKey="revenue" fill="#1e1b4b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Reports;