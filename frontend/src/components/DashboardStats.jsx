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
// Modern Icons
import { UsersRound, Building2, UserRound, ArrowUpRight } from 'lucide-react';

export default function DashboardStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-10 text-center text-stone-500">Loading Dashboard...</div>;
  if (!stats) return <div className="p-10 text-center text-red-500">Failed to load data.</div>;

  // --- DATA PREP ---
  const barangayData = Object.entries(stats.population_by_barangay || {}).map(([key, value]) => ({
    name: key,
    value: value
  })).sort((a, b) => b.value - a.value);

  const sectorData = Object.entries(stats.population_by_sector || {}).map(([key, value]) => ({
    name: key,
    value: value
  })).sort((a, b) => b.value - a.value);

  const genderData = [
    { name: 'Male', value: stats.total_male },
    { name: 'Female', value: stats.total_female },
  ];

  const GENDER_COLORS = ['#3b82f6', '#ec4899']; // Blue & Pink

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* 1. STATS CARDS (Modern Icons) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Residents" 
          value={stats.total_residents} 
          icon={<UsersRound size={26} className="text-blue-600" />} 
          bg="bg-blue-50" 
        />
        <StatCard 
          title="Total Households" 
          value={stats.total_households} 
          icon={<Building2 size={26} className="text-emerald-600" />} 
          bg="bg-emerald-50" 
        />
        <StatCard 
          title="Male Population" 
          value={stats.total_male} 
          icon={<UserRound size={26} className="text-indigo-600" />} 
          bg="bg-indigo-50" 
        />
        <StatCard 
          title="Female Population" 
          value={stats.total_female} 
          icon={<UserRound size={26} className="text-pink-600" />} 
          bg="bg-pink-50" 
        />
      </div>

      {/* 2. POPULATION CHART (Horizontal Bars) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-stone-800">Population by Barangay</h3>
            <span className="bg-rose-50 text-rose-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              Top Locations
            </span>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                layout="vertical" 
                data={barangayData} 
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f3f4f6" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={100}
                  tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 600 }} 
                />
                <Tooltip 
                  cursor={{ fill: '#fff1f2' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#e11d48" // Rose Red
                  radius={[0, 4, 4, 0]} 
                  barSize={18}
                  label={{ position: 'right', fill: '#be123c', fontSize: 11, fontWeight: 'bold' }} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. GENDER PIE CHART */}
        <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-stone-800 mb-2">Genders</h3>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
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
           {/* Custom Stats below pie */}
           <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-3 bg-blue-50 rounded-xl text-center">
                <p className="text-[10px] font-bold text-blue-400 uppercase">Male</p>
                <p className="text-xl font-bold text-blue-600">{stats.total_male}</p>
              </div>
              <div className="p-3 bg-pink-50 rounded-xl text-center">
                <p className="text-[10px] font-bold text-pink-400 uppercase">Female</p>
                <p className="text-xl font-bold text-pink-600">{stats.total_female}</p>
              </div>
          </div>
        </div>
      </div>

      {/* 4. SECTORS (Horizontal Bars - Fixed!) */}
      <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
        <h3 className="text-lg font-bold text-stone-800 mb-6">Vulnerable Sectors Overview</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              layout="vertical" 
              data={sectorData} 
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f3f4f6" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={140} // Wider space for sector names
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 500 }}
              />
              <Tooltip 
                cursor={{ fill: '#f0f9ff' }} // Light Blue Hover
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar 
                dataKey="value" 
                fill="#0ea5e9" // Sky Blue
                radius={[0, 4, 4, 0]} 
                barSize={18}
                label={{ position: 'right', fill: '#0369a1', fontSize: 11, fontWeight: 'bold' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

// Sub-component for Top Cards
function StatCard({ title, value, icon, bg }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow cursor-default group">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${bg} group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-stone-500">{title}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-stone-800 tracking-tight">{value.toLocaleString()}</p>
          {value > 0 && <ArrowUpRight size={14} className="text-green-500" />}
        </div>
      </div>
    </div>
  );
}