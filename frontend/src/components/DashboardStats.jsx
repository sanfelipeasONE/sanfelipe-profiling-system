import { useEffect, useState } from 'react';
import api from '../api';
import { Users, Home, UserCheck, User, Activity, PieChart } from 'lucide-react';

export default function DashboardStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } catch (err) {
        console.error("Failed to load stats", err);
      }
    };
    fetchStats();
  }, []);

  if (!stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin"></div>
    </div>
  );

  const cards = [
    // Primary Brand Color
    { 
      label: 'Total Residents', 
      value: stats.total_residents, 
      icon: <Users size={24} />, 
      color: 'from-red-600 to-rose-600', 
      shadow: 'shadow-red-500/30' 
    },
    // Warm Complementary (Amber/Orange)
    { 
      label: 'Total Households', 
      value: stats.total_households, 
      icon: <Home size={24} />, 
      color: 'from-orange-500 to-amber-500', 
      shadow: 'shadow-orange-500/30' 
    },
    // Dark Neutral (Stone)
    { 
      label: 'Male Population', 
      value: stats.total_male, 
      icon: <User size={24} />, 
      color: 'from-stone-600 to-stone-700', 
      shadow: 'shadow-stone-500/30' 
    },
    // Soft Warmth (Rose/Pink)
    { 
      label: 'Female Population', 
      value: stats.total_female, 
      icon: <UserCheck size={24} />, 
      color: 'from-rose-400 to-pink-500', 
      shadow: 'shadow-rose-500/30' 
    },
  ];

  // Helper to calculate percentage for bars
  const getPercent = (val) => Math.min(100, Math.max(5, (val / stats.total_residents) * 100));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Dashboard Overview</h2>
        <p className="text-stone-500 text-sm mt-1">Real-time statistics and demographic insights.</p>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 hover:shadow-xl hover:shadow-stone-200/50 hover:-translate-y-1 transition-all duration-300 group">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color} text-white shadow-lg ${card.shadow} group-hover:scale-110 transition-transform duration-300 ring-1 ring-white/20`}>
                {card.icon}
              </div>
              <span className="text-xs font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded-full group-hover:bg-stone-200 transition-colors">
                +2.5%
              </span>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-stone-900 tracking-tight">{card.value.toLocaleString()}</h3>
              <p className="text-stone-500 text-sm font-medium mt-1">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* BREAKDOWNS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* BARANGAY VISUALIZATION */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 flex flex-col h-full hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="text-red-500" size={20} />
            <h3 className="font-bold text-stone-900 text-lg">Population by Barangay</h3>
          </div>
          
          <div className="space-y-5 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {Object.entries(stats.population_by_barangay)
              .sort(([,a], [,b]) => b - a) 
              .map(([name, count]) => (
              <div key={name} className="group">
                <div className="flex justify-between text-sm font-medium text-stone-600 mb-1.5">
                  <span className="group-hover:text-red-600 transition-colors">{name}</span>
                  <span className="text-stone-900 font-bold">{count}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-red-500 to-rose-500 h-2.5 rounded-full transition-all duration-1000 ease-out group-hover:from-red-600 group-hover:to-rose-600 relative overflow-hidden"
                    style={{ width: `${getPercent(count)}%` }}
                  >
                    {/* Shimmer effect on hover */}
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  </div>
                </div>
              </div>
            ))}
            {Object.keys(stats.population_by_barangay).length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-stone-400">
                  <p>No population data recorded yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* SECTOR PILLS */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 flex flex-col h-full hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="text-rose-500" size={20} />
            <h3 className="font-bold text-stone-900 text-lg">Vulnerable Sectors</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(stats.population_by_sector).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100 hover:bg-rose-50 hover:border-rose-200 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-stone-300 rounded-full group-hover:bg-rose-500 transition-colors"></div>
                  <span className="text-stone-700 font-semibold group-hover:text-rose-900">{name}</span>
                </div>
                <span className="bg-white text-stone-900 px-3 py-1 rounded-lg text-sm font-bold shadow-sm border border-stone-100 group-hover:border-rose-100">
                  {count}
                </span>
              </div>
            ))}
            {Object.keys(stats.population_by_sector).length === 0 && (
               <div className="flex flex-col items-center justify-center py-10 text-stone-400">
                 <p>No sector data recorded yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}