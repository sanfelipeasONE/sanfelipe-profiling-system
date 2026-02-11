import { useEffect, useState } from 'react';
import api from '../api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { UsersRound, Building2, UserRound, ShieldAlert } from 'lucide-react';

export default function DashboardStats({ userRole }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Logic Guard: Only admins can fetch dashboard data
    if (userRole !== 'admin') {
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
  }, [userRole]);

  // 2. Access Control: If the user is NOT an admin, show Access Denied
  if (userRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white border border-stone-100 rounded-2xl p-10 text-center animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-2xl font-bold text-stone-900">Access Restricted</h2>
        <p className="text-stone-500 mt-2 max-w-sm">
          Your account does not have permission to view the global dashboard statistics. Please use the Resident Database to manage your assigned records.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-20 text-center">
        <div className="w-10 h-10 border-4 border-red-100 border-t-red-700 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-stone-500 font-medium">Loading analytics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-10 text-center bg-red-50 rounded-xl border border-red-100">
        <p className="text-red-700 font-bold">Unable to load dashboard data.</p>
        <p className="text-red-600 text-sm mt-1">Please check your cloud database connection.</p>
      </div>
    );
  }

  // Data Formatting for Recharts
  const barangayData = Object.entries(stats.population_by_barangay || {})
    .map(([key, value]) => ({ name: key, value }))
    .sort((a, b) => b.value - a.value);

  const sectorData = Object.entries(stats.population_by_sector || {})
    .map(([key, value]) => ({ name: key, value }))
    .sort((a, b) => b.value - a.value);

  const genderData = [
    { name: 'Male', value: stats.total_male || 0 },
    { name: 'Female', value: stats.total_female || 0 }
  ];

  const GENDER_COLORS = ['#7f1d1d', '#ef4444'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Overview</h1>
        <p className="text-stone-500 mt-1">Global demographic statistics for the Municipality of San Felipe.</p>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Residents"
          value={stats.total_residents}
          icon={<UsersRound size={20} className="text-red-700" />}
        />
        <StatCard
          title="Total Households"
          value={stats.total_households}
          icon={<Building2 size={20} className="text-red-700" />}
        />
        <StatCard
          title="Male Population"
          value={stats.total_male}
          icon={<UserRound size={20} className="text-red-700" />}
        />
        <StatCard
          title="Female Population"
          value={stats.total_female}
          icon={<UserRound size={20} className="text-red-700" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* POPULATION BY BARANGAY */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-stone-800 mb-6">Population by Barangay</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barangayData} margin={{ bottom: 40 }}>
                <CartesianGrid stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#991b1b" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GENDER DISTRIBUTION */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-stone-800 mb-6">Gender Distribution</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={GENDER_COLORS[index % GENDER_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* VULNERABLE SECTORS */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-stone-800 mb-6">Vulnerable Sectors Overview</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={sectorData}
              margin={{ left: 40, right: 40 }}
            >
              <CartesianGrid stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                width={150}
                tick={{ fill: '#4b5563', fontSize: 12 }}
              />
              <Tooltip cursor={{fill: 'transparent'}} />
              <Bar dataKey="value" fill="#7f1d1d" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 flex items-center justify-center bg-red-50 rounded-xl text-red-700">
          {icon}
        </div>
        <div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{title}</p>
          <p className="text-2xl font-black text-stone-900">
            {(value || 0).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}