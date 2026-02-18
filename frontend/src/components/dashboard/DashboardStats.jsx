import { useEffect, useState } from 'react';
import api from '../../api/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { UsersRound, Building2, UserRound, ShieldAlert, Loader2, Activity } from 'lucide-react';

// --- STYLE INJECTION FOR PUBLIC SANS (USWDS Standard) ---
const govFontStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600;700;800&display=swap');
  .font-gov { font-family: 'Public Sans', system-ui, -apple-system, sans-serif; }
`;

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
        setTimeout(() => {
            setLoading(false);
        }, 500);

      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setLoading(false);
      }
    };

    fetchStats();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="font-gov flex flex-col items-center justify-center min-h-[60vh] bg-stone-50 border border-stone-200 rounded-lg p-12 text-center">
        <style>{govFontStyles}</style>
        <div className="bg-red-50 p-4 rounded-full mb-6 border border-red-100">
          <ShieldAlert size={40} className="text-red-900" />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Access Restricted</h2>
        <p className="text-stone-600 mt-3 max-w-sm mx-auto text-base leading-relaxed">
          Global statistics are strictly limited to Administrator accounts.
        </p>
      </div>
    );
  }

  // --- LOADING STATE ---
  if (loading) {
    return (
        <>
            <style>{govFontStyles}</style>
            <BufferingLoader />
        </>
    );
  }

  // --- DATA PROCESSING ---
  const barangayData = Object.entries(stats?.population_by_barangay || {})
    .map(([name, value]) => ({ name, value }));

  const sectorData = Object.entries(stats?.population_by_sector || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const genderData = [
    { name: 'Male', value: stats?.total_male || 0 },
    { name: 'Female', value: stats?.total_female || 0 },
  ];

  const GENDER_COLORS = ['#57534e', '#7f1d1d']; 

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor="middle" 
        dominantBaseline="central" 
        className="text-xs font-bold font-gov"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="font-gov space-y-8 pb-12 animate-in fade-in duration-700 bg-stone-50/50 p-6 rounded-xl">
      <style>{govFontStyles}</style>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h6 className="text-xs font-bold text-red-900/80 uppercase tracking-widest mb-1">
            Municipality of San Felipe, Zambales
          </h6>
          <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">
            Demographic Overview
          </h1>
        </div>
      </div>

      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Residents" 
          value={stats?.total_residents} 
          icon={<UsersRound size={20} />} 
        />
        <StatCard 
          title="Total Households" 
          value={stats?.total_households} 
          icon={<Building2 size={20} />} 
        />
        <StatCard 
          title="Male Population" 
          value={stats?.total_male} 
          icon={<UserRound size={20} />} 
        />
        <StatCard 
          title="Female Population" 
          value={stats?.total_female} 
          icon={<UserRound size={20} />} 
        />
      </div>

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* BARANGAY CHART */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 border border-stone-200 shadow-sm">
          <div className="mb-6 border-b border-stone-100 pb-4">
            <h3 className="text-base font-bold text-stone-900 uppercase tracking-wide">Population by Location</h3>
            <p className="text-xs text-stone-500 mt-1">Recorded residents per Barangay unit</p>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barangayData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#78716c', fontSize: 11, fontFamily: 'Public Sans', fontWeight: 600 }}
                    dy={10}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#78716c', fontSize: 11, fontFamily: 'Public Sans' }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f5f5f4' }} />
                <Bar 
                    dataKey="value" 
                    fill="#7f1d1d" // Maroon
                    radius={[2, 2, 0, 0]} 
                    barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GENDER DONUT CHART */}
        <div className="lg:col-span-1 bg-white rounded-lg p-6 border border-stone-200 shadow-sm flex flex-col">
          <div className="mb-4 border-b border-stone-100 pb-4">
            <h3 className="text-base font-bold text-stone-900 uppercase tracking-wide">Gender Ratio</h3>
            <p className="text-xs text-stone-500 mt-1">Demographic distribution split</p>
          </div>
          
          <div className="flex-1 relative min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  labelLine={false}
                  label={renderCustomizedLabel}
                >
                  {genderData.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                    <span className="block text-2xl font-extrabold text-stone-900 tabular-nums tracking-tight">
                        {(stats?.total_residents || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                        Total
                    </span>
                </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-col gap-2 pt-4 border-t border-stone-100">
            {genderData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: GENDER_COLORS[index] }}
                  />
                  <span className="text-xs font-bold text-stone-600 uppercase tracking-wide">
                    {entry.name}
                  </span>
                </div>
                <div className="text-sm font-bold text-stone-900 tabular-nums">
                  {entry.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* SECTOR LIST CHART */}
      <div className="bg-white rounded-lg p-6 border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-6 border-b border-stone-100 pb-4">
            <div>
                <h3 className="text-base font-bold text-stone-900 uppercase tracking-wide">Sector Classification</h3>
                <p className="text-xs text-stone-500 mt-1">Census breakdown by occupation/sector</p>
            </div>
        </div>

        <div className="w-full overflow-hidden">
            <ResponsiveContainer width="100%" height={Math.max(400, sectorData.length * 50)}>
              <BarChart
                layout="vertical"
                data={sectorData}
                margin={{ top: 0, right: 30, left: 30, bottom: 0 }}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e7e5e4" />
                <XAxis type="number" hide />
                <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={180}
                    tick={{ fill: '#44403c', fontSize: 12, fontWeight: 600, fontFamily: 'Public Sans' }}
                    axisLine={false}
                    tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#fafaf9' }} />
                <Bar 
                    dataKey="value" 
                    fill="#7f1d1d" // Maroon
                    radius={[0, 4, 4, 0]} 
                    barSize={20}
                    background={{ fill: '#f5f5f4', radius: [0, 4, 4, 0] }}
                />
              </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

// --- SUBCOMPONENTS ---

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-sm hover:shadow-md hover:border-red-200 transition-all duration-200">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                {title}
            </p>
            <h4 className="text-2xl font-extrabold text-stone-900 tabular-nums tracking-tight">
                {(value || 0).toLocaleString()}
            </h4>
        </div>
        <div className="w-10 h-10 flex items-center justify-center bg-stone-50 text-red-900 rounded-md border border-stone-100">
             {icon}
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-stone-900 text-white p-3 rounded-md shadow-xl border border-stone-800 text-xs">
          <p className="font-bold text-stone-400 mb-1 uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold text-white tabular-nums">
            {payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
};

// --- LOADING COMPONENT ---
function BufferingLoader() {
    return (
        <div className="relative min-h-[80vh] w-full bg-stone-50 p-6 font-gov">
            {/* 1. Background Skeleton */}
            <div className="space-y-8 opacity-20 pointer-events-none select-none">
                <div className="flex justify-between items-end border-b border-stone-300 pb-4">
                   <div className="h-8 w-48 bg-stone-400 rounded-sm"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 bg-stone-300 rounded-md"></div>
                    ))}
                </div>
            </div>

            {/* 2. Loader Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <Loader2 size={32} className="text-red-900 animate-spin mb-4" />
                <p className="text-xs font-bold text-stone-600 uppercase tracking-widest">
                    Retrieving Data...
                </p>
            </div>
        </div>
    )
}