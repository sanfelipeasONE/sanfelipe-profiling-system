import { useEffect, useState } from 'react';
import api from '../api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { UsersRound, Building2, UserRound, ShieldAlert, Loader2 } from 'lucide-react';

export default function DashboardStats({ userRole }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = userRole?.toLowerCase() === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white/70 backdrop-blur-sm border border-stone-200 rounded-3xl p-8 text-center shadow-sm">
        <ShieldAlert size={48} className="text-red-600 mb-4" />
        <h2 className="text-xl font-bold text-stone-900">Access Restricted</h2>
        <p className="text-stone-500 mt-2 max-w-xs mx-auto text-sm leading-relaxed">
          Global statistics are restricted to Administrators.
        </p>
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-stone-400">
        <Loader2 className="w-10 h-10 animate-spin text-red-700 mb-4" />
        <p className="tracking-wide">Syncing cloud data...</p>
      </div>
    );

  const barangayData = Object.entries(stats?.population_by_barangay || {}).map(
    ([name, value]) => ({ name, value })
  );

  const genderData = [
    { name: 'Male', value: stats?.total_male || 0 },
    { name: 'Female', value: stats?.total_female || 0 },
  ];

  const GENDER_COLORS = ['#7f1d1d', '#ef4444'];

  // ✅ Dynamic Label Renderer
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    index,
  }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    const color = GENDER_COLORS[index];
    const isDark = color === "#7f1d1d";
    const textColor = isDark ? "#ffffff" : "#000000";

    return (
      <text
        x={x}
        y={y}
        fill={textColor}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="space-y-8 pb-10">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight">
          Overview
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          Municipality-wide demographic summary.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Residents" value={stats?.total_residents} icon={<UsersRound size={20} />} />
        <StatCard title="Total Households" value={stats?.total_households} icon={<Building2 size={20} />} />
        <StatCard title="Male" value={stats?.total_male} icon={<UserRound size={20} />} />
        <StatCard title="Female" value={stats?.total_female} icon={<UserRound size={20} />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Barangay Chart */}
        <div className="relative bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all duration-300">
          <h3 className="text-base font-semibold text-stone-800 mb-6">
            Population by Barangay
          </h3>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barangayData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  stroke="#d6d3d1"
                />
                <YAxis tick={{ fontSize: 11, fill: '#78716c' }} stroke="#d6d3d1" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1c1917',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                  cursor={{ fill: '#fef2f2' }}
                />
                <Bar
                  dataKey="value"
                  fill="#991b1b"
                  radius={[12, 12, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gender Chart */}
        <div className="relative bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all duration-300">
          <h3 className="text-base font-semibold text-stone-800 mb-6">
            Gender Split
          </h3>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  innerRadius="65%"
                  outerRadius="85%"
                  paddingAngle={5}
                  dataKey="value"
                  strokeWidth={0}
                  labelLine={false}
                  label={renderCustomizedLabel}
                >
                  {genderData.map((_, i) => (
                    <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                  ))}
                </Pie>

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1c1917',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '13px'
                  }}
                  itemStyle={{
                    color: '#ffffff',
                    fontWeight: 600
                  }}
                  labelStyle={{
                    color: '#ffffff',
                    fontWeight: 700
                  }}
                />

                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }}
                  formatter={(value) => (
                    <span className="text-stone-900 font-semibold">
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="group bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center gap-5">
      
      <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 text-red-700 rounded-2xl shadow-sm group-hover:scale-105 transition-transform duration-300">
        {icon}
      </div>

      <div>
        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">
          {title}
        </p>
        <p className="text-3xl font-bold text-stone-900 tracking-tight">
          {(value || 0).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
