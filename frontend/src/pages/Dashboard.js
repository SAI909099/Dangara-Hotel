import React, { useState, useEffect } from 'react';
import { DoorOpen, Users, Calendar, TrendingUp, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [statsRes, revenueRes] = await Promise.all([
        fetch(`${API_URL}/dashboard/stats`, { headers }),
        fetch(`${API_URL}/reports/revenue`, { headers })
      ]);

      if (statsRes.ok && revenueRes.ok) {
        const statsData = await statsRes.json();
        const revenueDataResult = await revenueRes.json();
        
        setStats(statsData);
        setRevenueData(revenueDataResult);
      }
      setLoading(false);
    } catch (error) {
      console.error('Dashboard ma\'lumotlarini yuklashda xatolik:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('uz-UZ', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount).replace(/,/g, ' ') + ' so\'m';
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-2xl border border-slate-200 animate-fadeIn">
          <p className="font-semibold text-slate-900 mb-2">{label}</p>
          <p className="text-lg font-bold text-[#1e1b4b]">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

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

      {/* Today's Income */}
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border-2 border-amber-200 p-8 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37] to-amber-600 flex items-center justify-center mr-4 shadow-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900">Bugungi tushum</h2>
        </div>
        <p className="text-5xl font-extrabold bg-gradient-to-r from-[#d4af37] to-amber-600 bg-clip-text text-transparent">
          {formatCurrency(stats.today_income)}
        </p>
      </div>

      {/* Charts Side by Side */}
      {revenueData && revenueData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1e1b4b] to-[#312e81] flex items-center justify-center mr-3 shadow-md group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Oylik tushum</h2>
                <p className="text-sm text-slate-500">{new Date().getFullYear()}</p>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={revenueData}
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
                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                    style={{ fontSize: '12px', fontWeight: '500' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="revenue" 
                    radius={[12, 12, 0, 0]}
                    animationDuration={1000}
                    animationBegin={0}
                  >
                    {revenueData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`}
                        fill={hoveredBar === index ? '#d4af37' : '#1e1b4b'}
                        style={{
                          filter: hoveredBar === index ? 'drop-shadow(0 4px 8px rgba(212, 175, 55, 0.4))' : 'none',
                          transition: 'all 0.3s ease'
                        }}
                      />
                    ))}
                  </Bar>
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
                <h2 className="text-2xl font-bold text-slate-900">Tushum tendensiyasi</h2>
                <p className="text-sm text-slate-500">{new Date().getFullYear()}</p>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#64748b"
                    style={{ fontSize: '12px', fontWeight: '500' }}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                    style={{ fontSize: '12px', fontWeight: '500' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
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
                </LineChart>
              </ResponsiveContainer>
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