import { useState, useEffect } from 'react';
import api from '../../api/api';
import { Users, Loader2, BarChart3, MapPin, ArrowUpRight, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OscaDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/osca/stats');
        setStats(response.data);
      } catch (err) {
        toast.error("Failed to load OSCA statistics");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-16 w-16 animate-ping rounded-full bg-red-100 opacity-75"></div>
          <Loader2 className="animate-spin text-red-600 relative" size={40} />
        </div>
        <p className="mt-6 text-sm text-slate-400 font-medium uppercase tracking-[0.2em]">Synchronizing Records</p>
      </div>
    );
  }

  const barangayList = stats?.barangay_data
    ? Object.entries(stats.barangay_data).sort(([a], [b]) => a.localeCompare(b))
    : [];

  const totalMale = barangayList.reduce((sum, [, data]) => sum + data.Male, 0);
  const totalFemale = barangayList.reduce((sum, [, data]) => sum + data.Female, 0);
  const grandTotal = barangayList.reduce((sum, [, data]) => sum + data.Total, 0);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">OSCA Dashboard</h1>
          <p className="text-slate-500 mt-1">Senior citizen demographics overview</p>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <MetricCard 
          title="Total Registered" 
          value={grandTotal} 
          subValue="Senior Citizens" 
          icon={<Users className="text-indigo-600" size={20} />}
          color="indigo"
        />
        <MetricCard 
          title="Male Seniors" 
          value={totalMale} 
          subValue={`${Math.round((totalMale/grandTotal)*100)}% Male`} 
          icon={<TrendingUp className="text-blue-600" size={20} />}
          color="blue"
        />
        <MetricCard 
          title="Female Seniors" 
          value={totalFemale} 
          subValue={`${Math.round((totalFemale/grandTotal)*100)}% Female`} 
          icon={<TrendingUp className="text-rose-600" size={20} />}
          color="rose"
        />
        <MetricCard 
          title="Barangays" 
          value={barangayList.length} 
          icon={<MapPin className="text-amber-600" size={20} />}
          color="amber"
        />
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800 text-lg">Sector Breakdown</h3>
          <BarChart3 size={18} className="text-slate-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-white">
                <th className="py-4 px-6">Barangay Name</th>
                <th className="py-4 px-6 text-right">Male</th>
                <th className="py-4 px-6 text-right">Female</th>
                <th className="py-4 px-6 text-right">Total</th>
                <th className="py-4 px-6 min-w-[200px]">Gender Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {barangayList.map(([name, data]) => {
                const mPct = data.Total ? (data.Male / data.Total) * 100 : 0;
                return (
                  <tr key={name} className="group hover:bg-slate-50/80 transition-all">
                    <td className="py-4 px-6 font-semibold text-slate-700">{name}</td>
                    <td className="py-4 px-6 text-right tabular-nums text-blue-600/80 font-medium">{data.Male.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right tabular-nums text-rose-600/80 font-medium">{data.Female.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right tabular-nums font-bold text-slate-900">{data.Total.toLocaleString()}</td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                          <span>{Math.round(mPct)}% M</span>
                          <span>{100 - Math.round(mPct)}% F</span>
                        </div>
                        <div className="flex h-2 w-full rounded-full bg-slate-100 overflow-hidden shadow-inner">
                          <div style={{ width: `${mPct}%` }} className="bg-blue-500 transition-all duration-1000" />
                          <div style={{ width: `${100 - mPct}%` }} className="bg-rose-500 transition-all duration-1000" />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sub-component for the stats cards to keep code clean
function MetricCard({ title, value, subValue, icon, color }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    blue: "bg-blue-50 text-blue-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600"
  };

  return (
    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02] cursor-default group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          {icon}
        </div>
        <ArrowUpRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h4 className="text-3xl font-bold text-slate-900 tabular-nums">{value.toLocaleString()}</h4>
        <p className="text-xs text-slate-500 mt-1 font-medium">{subValue}</p>
      </div>
    </div>
  );
}