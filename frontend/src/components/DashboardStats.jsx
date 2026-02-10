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
import { UsersRound, Building2, UserRound } from 'lucide-react';

export default function DashboardStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  if (loading)
    return <div className="p-10 text-center text-gray-500">Loading data...</div>;

  if (!stats)
    return <div className="p-10 text-center text-red-700">Unable to load dashboard data.</div>;

  const barangayData = Object.entries(stats.population_by_barangay || {})
    .map(([key, value]) => ({ name: key, value }))
    .sort((a, b) => b.value - a.value);

  const sectorData = Object.entries(stats.population_by_sector || {})
    .map(([key, value]) => ({ name: key, value }))
    .sort((a, b) => b.value - a.value);

  const genderData = [
    { name: 'Male', value: stats.total_male },
    { name: 'Female', value: stats.total_female }
  ];

  const GENDER_COLORS = ['#7f1d1d', '#b91c1c'];

  return (
    <div className="space-y-6">

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* POPULATION BY BARANGAY */}
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">
          Population by Barangay
        </h3>

        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barangayData}
              margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
            >
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={60}
                tick={{ fill: '#374151', fontSize: 12 }}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#374151', fontSize: 12 }}
              />

              <Tooltip />

              <Bar
                dataKey="value"
                fill="#991b1b"
                barSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GENDER DISTRIBUTION */}
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">
          Gender Distribution
        </h3>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={genderData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
              >
                {genderData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={GENDER_COLORS[index % GENDER_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* VULNERABLE SECTORS */}
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">
          Vulnerable Sectors Overview
        </h3>

        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={sectorData}
              margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
            >
              <CartesianGrid stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                width={150}
                tick={{ fill: '#374151', fontSize: 12 }}
              />
              <Tooltip />
              <Bar
                dataKey="value"
                fill="#7f1d1d"
                barSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white border border-gray-200 p-5 flex items-center gap-4">
      <div className="w-10 h-10 flex items-center justify-center bg-red-50">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-xl font-semibold text-gray-800">
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}