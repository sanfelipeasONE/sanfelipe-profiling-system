import { useState, useEffect } from 'react';
import api from '../../api/api';
import { Users, Loader2, BarChart3 } from 'lucide-react';
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
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="animate-spin text-red-600 mb-4" size={32} />
        <p className="text-sm text-slate-500 font-medium uppercase tracking-widest">Compiling Senior Data...</p>
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
    <div className="max-w-5xl mx-auto animate-in fade-in duration-300 py-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-7">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Office for Senior Citizens Affairs
          </span>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">OSCA Overview</h1>
          <p className="text-sm text-slate-500">Registered senior citizen demographics by barangay</p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 self-start">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Live data
        </span>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        {/* Total */}
        <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center mb-1">
            <Users size={16} className="text-red-600" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total registered</span>
          <span className="text-3xl font-semibold text-slate-800 leading-none">{grandTotal.toLocaleString()}</span>
          <span className="text-xs text-slate-400">Senior citizens</span>
        </div>

        {/* Male */}
        <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e5fa5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Male</span>
          <span className="text-3xl font-semibold text-blue-700 leading-none">{totalMale.toLocaleString()}</span>
          <span className="text-xs text-slate-400">
            {grandTotal ? Math.round((totalMale / grandTotal) * 100) : 0}% of total
          </span>
        </div>

        {/* Female */}
        <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center mb-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#993556" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Female</span>
          <span className="text-3xl font-semibold text-pink-700 leading-none">{totalFemale.toLocaleString()}</span>
          <span className="text-xs text-slate-400">
            {grandTotal ? Math.round((totalFemale / grandTotal) * 100) : 0}% of total
          </span>
        </div>

        {/* Barangays */}
        <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center mb-1">
            <BarChart3 size={16} className="text-green-700" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Barangays</span>
          <span className="text-3xl font-semibold text-green-700 leading-none">{barangayList.length}</span>
          <span className="text-xs text-slate-400">Coverage areas</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">Population by barangay &amp; sex</span>
          <span className="text-xs text-slate-400">{barangayList.length} barangays</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                <th className="py-3 px-5 text-left">Barangay</th>
                <th className="py-3 px-5 text-right text-blue-600">Male</th>
                <th className="py-3 px-5 text-right text-pink-600">Female</th>
                <th className="py-3 px-5 text-right">Subtotal</th>
                <th className="py-3 px-5 text-left min-w-[120px]">Distribution</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {barangayList.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400 font-medium">
                    No barangay data available.
                  </td>
                </tr>
              ) : (
                barangayList.map(([barangayName, data]) => {
                  const mPct = data.Total ? Math.round((data.Male / data.Total) * 100) : 0;
                  return (
                    <tr key={barangayName} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-5 font-medium text-slate-700">{barangayName}</td>
                      <td className="py-3 px-5 text-right font-medium text-blue-600 tabular-nums">{data.Male}</td>
                      <td className="py-3 px-5 text-right font-medium text-pink-600 tabular-nums">{data.Female}</td>
                      <td className="py-3 px-5 text-right font-semibold text-slate-800 tabular-nums">{data.Total}</td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-1 rounded-full bg-blue-400"
                              style={{ width: `${mPct}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 min-w-[32px] text-right">{mPct}%m</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {barangayList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 text-sm font-semibold">
                  <td className="py-3 px-5 text-xs uppercase tracking-widest text-slate-400">Grand total</td>
                  <td className="py-3 px-5 text-right text-blue-700 tabular-nums">{totalMale.toLocaleString()}</td>
                  <td className="py-3 px-5 text-right text-pink-700 tabular-nums">{totalFemale.toLocaleString()}</td>
                  <td className="py-3 px-5 text-right text-slate-800 text-base tabular-nums">{grandTotal.toLocaleString()}</td>
                  <td className="py-3 px-5" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}