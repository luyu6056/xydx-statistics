import React, { useEffect, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, AreaChart, Area
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { fetchMeta, fetchStats, type DailyStats, type MetaData, type StatsResponse } from '../lib/api';
import { ArrowUpRight, ArrowDownRight, Users, DollarSign, Activity, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import Datepicker from "react-tailwindcss-datepicker";
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

const USD_CNY_RATE = 6.6;

export function Dashboard() {
  const [statsData, setStatsData] = useState<StatsResponse | null>(null);
  const [meta, setMeta] = useState<MetaData>({ channels: [], servers: [] });
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date()
  });
  const [selectedChannels, setSelectedChannels] = useState<string[]>(() => {
    const params = new URLSearchParams(window.location.search);
    const group = params.get('group');
    return group && group !== '全部' ? [group] : [];
  });
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedChannels.length > 0) {
      params.set('group', selectedChannels[0]);
    } else {
      params.delete('group');
    }
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [selectedChannels]);

  useEffect(() => {
    const handleRefresh = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener('app-refresh', handleRefresh);
    return () => window.removeEventListener('app-refresh', handleRefresh);
  }, []);

  useEffect(() => {
    fetchMeta().then(setMeta);
  }, []);

  const formatRangeDate = (date: any) => {
    if (!date) return '';
    try {
      if (date instanceof Date) return format(date, 'yyyy-MM-dd');
      if (typeof date === 'string') return date;
      return format(new Date(date), 'yyyy-MM-dd');
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchStats({
      startDate: formatRangeDate(dateRange.startDate),
      endDate: formatRangeDate(dateRange.endDate),
      channels: selectedChannels,
      servers: selectedServers
    }).then(data => {
      setStatsData(data);
      setLoading(false);
    });
  }, [dateRange, selectedChannels, selectedServers, refreshTrigger]);

  const stats = statsData?.stats || [];
  const summary = statsData?.summary;

  // Derived Stats & Trends
  const sortedStats = [...stats].sort((a, b) => {
    const da = dayjs(a.date).valueOf();
    const db = dayjs(b.date).valueOf();
    return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
  });
  
  // Use API summary if available, fallback to aggregated daily stats
  const totalRevenue = summary ? (summary.total_revenue / 100) : sortedStats.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalNewUsers = summary ? summary.new_users : sortedStats.reduce((acc, curr) => acc + curr.new_users, 0);
  const avgDAU = summary && summary.avg_dau > 0 ? summary.avg_dau : (sortedStats.length ? Math.round(sortedStats.reduce((acc, curr) => acc + curr.dau, 0) / sortedStats.length) : 0);

  // Calculate trends
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
  
  const chartData = sortedStats.map(s => {
    let dateFormatted = s.date;
    try {
      const d = dayjs(s.date);
      if (d.isValid()) {
        dateFormatted = d.format('MMM DD');
      }
    } catch (e) {
      console.error('Date formatting error:', e);
    }

    return {
      ...s,
      dateFormatted,
      retention_1d_pct: (s.retention_1d * 100).toFixed(1),
      retention_7d_pct: (s.retention_7d * 100).toFixed(1),
    };
  });

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

  // Change date range options
  const setRangeType = (type: 'yesterday' | '7days' | '30days') => {
    const end = new Date();
    let start = new Date();
    
    if (type === 'yesterday') {
      start = subDays(end, 1);
      setDateRange({ startDate: start, endDate: start });
    } else if (type === '7days') {
      start = subDays(end, 6);
      setDateRange({ startDate: start, endDate: end });
    } else if (type === '30days') {
      start = subDays(end, 29);
      setDateRange({ startDate: start, endDate: end });
    }
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
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col gap-4 overflow-visible">
        <div className="flex flex-wrap gap-6 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Quick Ranges */}
            <div className="flex bg-neutral-100 p-1 rounded-lg gap-1">
              <button 
                onClick={() => setRangeType('yesterday')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  dateRange.startDate && dateRange.endDate && 
                  formatRangeDate(dateRange.startDate) === formatRangeDate(dateRange.endDate) && 
                  formatRangeDate(dateRange.endDate) === format(subDays(new Date(), 1), 'yyyy-MM-dd')
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                昨日
              </button>
              <button 
                onClick={() => setRangeType('7days')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  dateRange.startDate && dateRange.endDate && 
                  formatRangeDate(dateRange.startDate) === format(subDays(new Date(), 6), 'yyyy-MM-dd') && 
                  formatRangeDate(dateRange.endDate) === format(new Date(), 'yyyy-MM-dd')
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                近7日
              </button>
              <button 
                onClick={() => setRangeType('30days')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  dateRange.startDate && dateRange.endDate && 
                  formatRangeDate(dateRange.startDate) === format(subDays(new Date(), 29), 'yyyy-MM-dd') && 
                  formatRangeDate(dateRange.endDate) === format(new Date(), 'yyyy-MM-dd')
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                近30日
              </button>
            </div>

            {/* Custom Range Display */}
            <div className="w-80 relative">
              <Datepicker 
                inputId="dashboard-datepicker-input"
                value={dateRange as any} 
                onChange={(newValue: any) => setDateRange(newValue)}
                showShortcuts={true}
                useRange={true}
                asSingle={false}
                separator="至"
                displayFormat="YYYY-MM-DD"
                i18n="zh"
                primaryColor="indigo"
                popoverDirection="down"
                readOnly={true}
                containerClassName="relative w-full z-[100]"
                toggleClassName="absolute right-0 top-0 h-full px-3 text-neutral-400 focus:outline-none"
                inputClassName="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-neutral-800 shadow-sm pr-10 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex gap-2 items-center">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">渠道：</span>
              <select
                className="text-sm border-neutral-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 h-9 min-w-[140px] bg-white text-neutral-700 shadow-sm border"
                value={selectedChannels.length === 0 ? '全部' : selectedChannels[0]}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '全部') {
                    setSelectedChannels([]);
                  } else {
                    setSelectedChannels([val]);
                  }
                }}
              >
                {meta.channels.map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 items-center">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">服务器：</span>
              <select 
                multiple
                className="text-sm border-neutral-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 h-9 min-w-[100px] bg-white shadow-sm border"
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

            <button 
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-all hover:translate-y-[-1px] shadow-sm active:translate-y-0"
            >
              <Download size={16} />
              导出数据
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="总收入" 
          value={`￥${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          subValue={`$${(totalRevenue / USD_CNY_RATE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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

      {/* Charts & Tables */}
      {sortedStats.length > 0 ? (
        <>
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
                    <th className="px-6 py-3">收入 (美元)</th>
                    <th className="px-6 py-3">次日留存</th>
                    <th className="px-6 py-3">7日留存</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {[...sortedStats].reverse().map((row) => (
                    <tr key={row.date} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-neutral-900">{row.date}</td>
                      <td className="px-6 py-3">{row.dau.toLocaleString()}</td>
                      <td className="px-6 py-3">{row.new_users.toLocaleString()}</td>
                      <td className="px-6 py-3 text-emerald-600 font-medium">￥{row.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 text-neutral-500 font-mono text-xs">${(row.revenue / USD_CNY_RATE).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3">{(row.retention_1d * 100).toFixed(1)}%</td>
                      <td className="px-6 py-3">{(row.retention_7d * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-dashed border-neutral-300 rounded-xl p-12 text-center">
          <p className="text-neutral-500">暂无每日趋势数据，仅显示总体汇总。</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, subValue, trend, trendUp, icon, bg }: any) {
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
      {subValue && <p className="text-sm text-neutral-500 mt-1">{subValue}</p>}
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
