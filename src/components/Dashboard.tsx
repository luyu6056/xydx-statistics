import React, { useEffect, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, AreaChart, Area
} from 'recharts';
import { format, subDays, parseISO, startOfDay, isSameDay } from 'date-fns';
import { fetchMeta, fetchStats, type DailyStats, type MetaData } from '../lib/api';
import { ArrowUpRight, ArrowDownRight, Users, DollarSign, Activity, Calendar, Download } from 'lucide-react';
import { cn } from '../lib/utils';

export function Dashboard() {
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [meta, setMeta] = useState<MetaData>({ channels: [], servers: [] });
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedServers, setSelectedServers] = useState<string[]>([]);

  useEffect(() => {
    fetchMeta().then(setMeta);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchStats({
      startDate: dateRange.start,
      endDate: dateRange.end,
      channels: selectedChannels,
      servers: selectedServers
    }).then(data => {
      setStats(data);
      setLoading(false);
    });
  }, [dateRange, selectedChannels, selectedServers]);

  // Derived Stats & Trends
  // Simple trend: compare last 7 days vs previous 7 days in the dataset
  const sortedStats = [...stats].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const totalRevenue = sortedStats.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalNewUsers = sortedStats.reduce((acc, curr) => acc + curr.new_users, 0);
  const avgDAU = sortedStats.length ? Math.round(sortedStats.reduce((acc, curr) => acc + curr.dau, 0) / sortedStats.length) : 0;

  // Calculate trends (mock logic for now: compare first half vs second half of selected range)
  const midPoint = Math.floor(sortedStats.length / 2);
  const firstHalf = sortedStats.slice(0, midPoint);
  const secondHalf = sortedStats.slice(midPoint);

  const getTrend = (key: keyof DailyStats) => {
    if (firstHalf.length === 0 || secondHalf.length === 0) return { value: 0, up: true };
    const firstSum = firstHalf.reduce((acc, curr) => acc + (curr[key] as number), 0);
    const secondSum = secondHalf.reduce((acc, curr) => acc + (curr[key] as number), 0);
    const diff = secondSum - firstSum;
    const pct = firstSum === 0 ? 0 : (diff / firstSum) * 100;
    return { value: Math.abs(pct).toFixed(1), up: pct >= 0 };
  };

  const revTrend = getTrend('revenue');
  const dauTrend = getTrend('dau');
  const newUsersTrend = getTrend('new_users');
  
  // Chart Data Formatting
  const chartData = sortedStats.map(s => ({
    ...s,
    dateFormatted: format(parseISO(s.date), 'MMM dd'),
    retention_1d_pct: (s.retention_1d * 100).toFixed(1),
    retention_7d_pct: (s.retention_7d * 100).toFixed(1),
  }));

  const exportCSV = () => {
    const headers = ['Date', 'DAU', 'New Users', 'Revenue', 'Ret 1d', 'Ret 7d'];
    const rows = sortedStats.map(s => [
      s.date, s.dau, s.new_users, s.revenue, s.retention_1d, s.retention_7d
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "game_stats.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 border-r border-neutral-200 pr-4">
            <Calendar size={16} className="text-neutral-500" />
            <input 
              type="date" 
              value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="text-sm border-none focus:ring-0 text-neutral-700 font-medium bg-transparent"
            />
            <span className="text-neutral-400">-</span>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="text-sm border-none focus:ring-0 text-neutral-700 font-medium bg-transparent"
            />
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">渠道：</span>
            <div className="flex gap-1">
              {meta.channels.map(ch => (
                <button
                  key={ch}
                  onClick={() => setSelectedChannels(prev => 
                    prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
                  )}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    selectedChannels.includes(ch)
                      ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                      : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
                  )}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-center">
             <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">服务器：</span>
             <select 
               multiple
               className="text-sm border-neutral-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500 h-8 min-w-[100px]"
               value={selectedServers}
               onChange={e => {
                 const options = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
                 setSelectedServers(options);
               }}
             >
               {meta.servers.map(s => (
                 <option key={s} value={s}>{s}</option>
               ))}
             </select>
          </div>
        </div>
        
        <button 
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          <Download size={16} />
          导出 CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="总收入" 
          value={`￥${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          trend={`${revTrend.up ? '+' : '-'}${revTrend.value}%`} 
          trendUp={revTrend.up}
          icon={<DollarSign size={20} className="text-emerald-600" />}
          bg="bg-emerald-50"
        />
        <StatCard 
          title="平均日活跃 (DAU)" 
          value={avgDAU.toLocaleString()} 
          trend={`${dauTrend.up ? '+' : '-'}${dauTrend.value}%`} 
          trendUp={dauTrend.up}
          icon={<Activity size={20} className="text-blue-600" />}
          bg="bg-blue-50"
        />
        <StatCard 
          title="新增用户总数" 
          value={totalNewUsers.toLocaleString()} 
          trend={`${newUsersTrend.up ? '+' : '-'}${newUsersTrend.value}%`} 
          trendUp={newUsersTrend.up}
          icon={<Users size={20} className="text-violet-600" />}
          bg="bg-violet-50"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="用户活跃趋势">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorDau" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
              <XAxis dataKey="dateFormatted" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="dau" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorDau)" name="活跃用户" />
              <Area type="monotone" dataKey="new_users" stroke="#10b981" strokeWidth={2} fill="none" name="新增用户" />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="收入趋势">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
              <XAxis dataKey="dateFormatted" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} />
              <Tooltip 
                cursor={{fill: '#f9fafb'}}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="收入 (￥)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6">
        <ChartCard title="留存率趋势">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
              <XAxis dataKey="dateFormatted" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} unit="%" />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, '']}
              />
              <Line type="monotone" dataKey="retention_1d" stroke="#f59e0b" strokeWidth={2} dot={false} name="次日留存" />
              <Line type="monotone" dataKey="retention_7d" stroke="#ec4899" strokeWidth={2} dot={false} name="7日留存" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="text-lg font-semibold text-neutral-800">详细数据</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 text-neutral-500 font-medium">
              <tr>
                <th className="px-6 py-3">日期</th>
                <th className="px-6 py-3">活跃用户</th>
                <th className="px-6 py-3">新增用户</th>
                <th className="px-6 py-3">收入</th>
                <th className="px-6 py-3">次日留存</th>
                <th className="px-6 py-3">7日留存</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sortedStats.map((row, i) => (
                <tr key={row.date} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-neutral-900">{row.date}</td>
                  <td className="px-6 py-3">{row.dau.toLocaleString()}</td>
                  <td className="px-6 py-3">{row.new_users.toLocaleString()}</td>
                  <td className="px-6 py-3 text-emerald-600 font-medium">￥{row.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-3">{(row.retention_1d * 100).toFixed(1)}%</td>
                  <td className="px-6 py-3">{(row.retention_7d * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, trendUp, icon, bg }: any) {
  return (
    <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-2 rounded-lg", bg)}>
          {icon}
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
          trendUp ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
        )}>
          {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend}
        </div>
      </div>
      <h3 className="text-neutral-500 text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
      <h3 className="text-lg font-semibold text-neutral-800 mb-6">{title}</h3>
      {children}
    </div>
  );
}
