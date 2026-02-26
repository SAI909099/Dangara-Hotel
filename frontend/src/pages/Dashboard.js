import React, { useState, useEffect } from 'react';
import { DoorOpen, Users, Calendar, TrendingUp, BarChart3, LineChart as LineChartIcon, DollarSign, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie, Legend } from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const EXPENSE_CATEGORY_COLORS = ['#e11d48', '#4f46e5', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#64748b', '#14b8a6'];
const EXPENSE_CATEGORY_LABELS = {
  Maosh: 'Maosh (Oylik)',
  Kommunal: 'Kommunal xizmatlar',
  'Oziq-ovqat': 'Oziq-ovqat',
  Boshqa: 'Boshqa',
  Tamirlash: "Ta'mirlash",
  "Ta'mirlash": "Ta'mirlash",
  Transport: 'Transport',
  Inventar: 'Inventar/Jihozlar',
  Reklama: 'Reklama',
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [monthlyFinanceData, setMonthlyFinanceData] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [financialStats, setFinancialStats] = useState({
    dailyIncome: 0,
    monthlyIncome: 0,
    yearlyIncome: 0,
    monthlyExpenses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentMonth = now.toISOString().slice(0, 7);
      const monthStart = `${currentMonth}-01`;

      const [statsRes, revenueRes, dailyRes, monthlyRes, expenseSummaryRes, expenseChartRes] = await Promise.all([
        fetch(`${API_URL}/dashboard/stats`, { headers }),
        fetch(`${API_URL}/reports/revenue?year=${now.getFullYear()}`, { headers }),
        fetch(`${API_URL}/reports/daily?date=${today}`, { headers }),
        fetch(`${API_URL}/reports/monthly?month=${currentMonth}`, { headers }),
        fetch(`${API_URL}/expenses/summary/stats?date_from=${monthStart}&date_to=${today}`, { headers }),
        fetch(`${API_URL}/expenses/monthly/chart?year=${now.getFullYear()}`, { headers })
      ]);

      const statsData = statsRes.ok ? await statsRes.json() : null;
      const revenueDataResult = revenueRes.ok ? await revenueRes.json() : [];
      const dailyReport = dailyRes.ok ? await dailyRes.json() : null;
      const monthlyReport = monthlyRes.ok ? await monthlyRes.json() : null;
      const expenseSummaryResult = expenseSummaryRes.ok ? await expenseSummaryRes.json() : null;
      const expenseChartData = expenseChartRes.ok ? await expenseChartRes.json() : [];

      if (statsData) {
        setStats(statsData);
      }
      setRevenueData(Array.isArray(revenueDataResult) ? revenueDataResult : []);
      setMonthlyFinanceData(Array.isArray(expenseChartData) ? expenseChartData : []);
      setExpenseSummary(expenseSummaryResult);

      const yearlySource = Array.isArray(expenseChartData) && expenseChartData.length > 0
        ? expenseChartData
        : (Array.isArray(revenueDataResult) ? revenueDataResult : []);
      const yearlyIncome = yearlySource.reduce(
        (sum, item) => sum + (item?.income || item?.revenue || 0),
        0
      );

      setFinancialStats({
        dailyIncome: dailyReport?.total_revenue ?? statsData?.today_income ?? 0,
        monthlyIncome: monthlyReport?.total_income ?? 0,
        yearlyIncome,
        monthlyExpenses: expenseSummaryResult?.total_expenses ?? 0,
      });
    } catch (error) {
      console.error('Dashboard ma\'lumotlarini yuklashda xatolik:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    return new Intl.NumberFormat('uz-UZ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(safeAmount).replace(/,/g, ' ') + ' so\'m';
  };

  const MetricCard = ({ title, value, icon: Icon, color, testId, gradient }) => (
    <div
      data-testid={testId}
      className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 hover:scale-105 hover:border-slate-300 group"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">{title}</h3>
        <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <p className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
        {value}
      </p>
    </div>
  );

  const formatCompactMillions = (value) => `${(value / 1000000).toFixed(1)}M`;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-2xl border border-slate-200 animate-fadeIn">
          <p className="font-semibold text-slate-900 mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((item, idx) => (
              <div key={`${item.dataKey}-${idx}`} className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color || '#1e1b4b' }} />
                  <span className="text-slate-700">{item.name || item.dataKey}</span>
                </div>
                <span className="font-semibold text-slate-900">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const categoryDetails = Object.entries(expenseSummary?.expenses_by_category || {})
    .map(([key, value], index) => ({
      key,
      label: EXPENSE_CATEGORY_LABELS[key] || key,
      value: Number(value) || 0,
      color: EXPENSE_CATEGORY_COLORS[index % EXPENSE_CATEGORY_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  const totalCategoryExpenses = categoryDetails.reduce((sum, item) => sum + item.value, 0);
  const expenseCategoryPieData = categoryDetails
    .filter((item) => item.value > 0)
    .map((item) => ({ ...item }));

  const chartsData = monthlyFinanceData.length > 0
    ? monthlyFinanceData
    : (revenueData || []).map((item) => ({
        month: item.month,
        income: item.revenue || 0,
        expenses: 0,
        profit: item.revenue || 0,
      }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#1e1b4b] mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-slate-700">Yuklanmoqda...</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl font-semibold text-slate-600">Ma'lumotlarni yuklashda xatolik yuz berdi</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1e1b4b] to-[#312e81] rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-5xl font-bold mb-3">Boshqaruv paneli</h1>
        <p className="text-lg text-slate-200">Dangara Hotel boshqaruv tizimiga xush kelibsiz</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          testId="total-rooms-card"
          title="Jami xonalar"
          value={stats.total_rooms}
          icon={DoorOpen}
          gradient="bg-gradient-to-br from-[#1e1b4b] to-[#312e81]"
        />
        <MetricCard
          testId="available-rooms-card"
          title="Bo'sh xonalar"
          value={stats.available_rooms}
          icon={DoorOpen}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
        />
        <MetricCard
          testId="occupied-rooms-card"
          title="Band xonalar"
          value={stats.occupied_rooms}
          icon={Users}
          gradient="bg-gradient-to-br from-amber-500 to-amber-600"
        />
        <MetricCard
          testId="upcoming-reservations-card"
          title="Kutilayotgan bronlar"
          value={stats.upcoming_reservations}
          icon={Calendar}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
        />
      </div>

      {/* Financial Summary */}
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Moliyaviy ko'rsatkichlar</h2>
            <p className="text-sm text-slate-500">Hisobotlar sahifasidagi tushum/chiqim ma'lumotlari asosida</p>
          </div>
          <div className="text-xs text-slate-500">
            {new Date().toLocaleDateString('uz-UZ')}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Kunlik tushum"
            value={formatCurrency(financialStats.dailyIncome)}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          />
          <MetricCard
            title="Oylik tushum"
            value={formatCurrency(financialStats.monthlyIncome)}
            icon={DollarSign}
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          />
          <MetricCard
            title="Yillik tushum"
            value={formatCurrency(financialStats.yearlyIncome)}
            icon={BarChart3}
            gradient="bg-gradient-to-br from-[#1e1b4b] to-[#312e81]"
          />
          <MetricCard
            title="Oylik chiqim"
            value={formatCurrency(financialStats.monthlyExpenses)}
            icon={Wallet}
            gradient="bg-gradient-to-br from-rose-500 to-red-700"
          />
        </div>
      </div>

      {/* Charts Side by Side */}
      {chartsData && chartsData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1e1b4b] to-[#312e81] flex items-center justify-center mr-3 shadow-md group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Oylik tushum va chiqim</h2>
                <p className="text-sm text-slate-500">{new Date().getFullYear()}</p>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartsData}
                  onMouseMove={(state) => {
                    if (state.isTooltipActive) {
                      setHoveredBar(state.activeTooltipIndex);
                    } else {
                      setHoveredBar(null);
                    }
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    stroke="#64748b"
                    style={{ fontSize: '12px', fontWeight: '500' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tickFormatter={formatCompactMillions}
                    style={{ fontSize: '12px', fontWeight: '500' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar
                    dataKey="income"
                    name="Tushum"
                    radius={[12, 12, 0, 0]}
                    animationDuration={1000}
                    animationBegin={0}
                  >
                    {chartsData.map((entry, index) => (
                      <Cell
                        key={`income-cell-${index}`}
                        fill={hoveredBar === index ? '#d4af37' : '#1e1b4b'}
                        style={{
                          filter: hoveredBar === index ? 'drop-shadow(0 4px 8px rgba(212, 175, 55, 0.4))' : 'none',
                          transition: 'all 0.3s ease'
                        }}
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="expenses"
                    name="Chiqim"
                    radius={[12, 12, 0, 0]}
                    fill="#ef4444"
                    animationDuration={1000}
                    animationBegin={150}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Line Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#d4af37] to-amber-600 flex items-center justify-center mr-3 shadow-md group-hover:scale-110 transition-transform">
                <LineChartIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Tushum / foyda tendensiyasi</h2>
                <p className="text-sm text-slate-500">{new Date().getFullYear()}</p>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    stroke="#64748b"
                    style={{ fontSize: '12px', fontWeight: '500' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tickFormatter={formatCompactMillions}
                    style={{ fontSize: '12px', fontWeight: '500' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Tushum"
                    stroke="#d4af37"
                    strokeWidth={4}
                    dot={{
                      fill: '#d4af37',
                      r: 6,
                      strokeWidth: 3,
                      stroke: '#fff'
                    }}
                    activeDot={{
                      r: 10,
                      fill: '#d4af37',
                      stroke: '#fff',
                      strokeWidth: 3,
                      style: {
                        filter: 'drop-shadow(0 4px 8px rgba(212, 175, 55, 0.6))'
                      }
                    }}
                    animationDuration={1500}
                    animationBegin={0}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Foyda"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{
                      fill: '#10b981',
                      r: 4,
                      strokeWidth: 2,
                      stroke: '#fff'
                    }}
                    activeDot={{
                      r: 8,
                      fill: '#10b981',
                      stroke: '#fff',
                      strokeWidth: 2
                    }}
                    animationDuration={1500}
                    animationBegin={200}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Expense Category Breakdown */}
      {expenseCategoryPieData.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-2xl transition-all duration-300">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">📊 Kategoriya bo'yicha chiqimlar</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategoryPieData}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="48%"
                    outerRadius={110}
                    labelLine
                    label={({ label, percent }) => `${label} ${Math.round((percent || 0) * 100)}%`}
                  >
                    {expenseCategoryPieData.map((entry, index) => (
                      <Cell key={`pie-${entry.key}-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-2xl transition-all duration-300">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">📋 Kategoriya tafsiloti</h2>
            <div className="space-y-3">
              {categoryDetails.map((item) => {
                const percent = totalCategoryExpenses > 0 ? (item.value / totalCategoryExpenses) * 100 : 0;
                return (
                  <div
                    key={item.key}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <div className="font-semibold text-slate-800 truncate">{item.label}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{formatCurrency(item.value)}</div>
                      <div className="text-xs text-slate-500">{percent.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add custom animation styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
