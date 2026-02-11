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
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white border border-stone-100 rounded-2xl p-6 text-center animate-in fade-in">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-stone-900">Access Restricted</h2>
        <p className="text-stone-500 mt-2 max-w-xs mx-auto text-sm">
          Global statistics are restricted to Administrators.
        </p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-stone-400">
      <Loader2 className="w-10 h-10 animate-spin text-red-700 mb-4" />
      <p>Syncing cloud data...</p>
    </div>
  );

  const barangayData = Object.entries(stats?.population_by_barangay || {}).map(([name, value]) => ({ name, value }));
  const genderData = [{ name: 'Male', value: stats?.total_male || 0 }, { name: 'Female', value: stats?.total_female || 0 }];
  const sectorData = Object.entries(stats?.population_by_sector || {}).map(([name, value]) => ({ name, value }));
  const GENDER_COLORS = ['#7f1d1d', '#ef4444'];

  return (
    <div className="space-y-6 pb-10">
      <div className="px-1">
        <h1 className="text-2xl md:text-3xl font-bold text-stone-900">Overview</h1>
        <p className="text-stone-500 text-sm">Municipality-wide demographic summary.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Residents" value={stats?.total_residents} icon={<UsersRound size={20} />} />
        <StatCard title="Total Households" value={stats?.total_households} icon={<Building2 size={20} />} />
        <StatCard title="Male" value={stats?.total_male} icon={<UserRound size={20} />} />
        <StatCard title="Female" value={stats?.total_female} icon={<UserRound size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-stone-200 shadow-sm">
          <h3 className="text-base font-bold text-stone-800 mb-6">Population by Barangay</h3>
          <div className="h-64 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barangayData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{fontSize: 10}} />
                <Tooltip />
                <Bar dataKey="value" fill="#991b1b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-stone-200 shadow-sm">
          <h3 className="text-base font-bold text-stone-800 mb-6">Gender Split</h3>
          <div className="h-64 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={genderData} innerRadius="60%" outerRadius="80%" paddingAngle={5} dataKey="value">
                  {genderData.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
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
    <div className="bg-white p-5 rounded-2xl border border-stone-200 flex items-center gap-4">
      <div className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-700 rounded-xl">{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{title}</p>
        <p className="text-xl font-bold text-stone-900">{(value || 0).toLocaleString()}</p>
      </div>
    </div>
  );
}