import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { Search } from 'lucide-react';
import { fetchRetentionStats, fetchMeta, RETENTION_DAYS, type RetentionStatsItem, type MetaData } from '../lib/api';
import Datepicker from "react-tailwindcss-datepicker";
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

export function Retention() {
  const [stats, setStats] = useState<RetentionStatsItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Default date range: last 15 days up to today
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 14),
    endDate: new Date()
  });

  // Filters
  const [meta, setMeta] = useState<MetaData>({ channels: [], servers: [] });
  const [selectedChannel, setSelectedChannel] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const group = params.get('group');
    return group && group !== '全部' ? group : '全部';
  });
  const [selectedServer, setSelectedServer] = useState<string>('全部');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const handleRefresh = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener('app-refresh', handleRefresh);
    return () => window.removeEventListener('app-refresh', handleRefresh);
  }, []);

  useEffect(() => {
    fetchMeta().then(data => {
      const serversList = data.servers.includes('全部') ? data.servers : ['全部', ...data.servers];
      setMeta({ ...data, servers: serversList });
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedChannel && selectedChannel !== '全部') {
      params.set('group', selectedChannel);
    } else {
      params.delete('group');
    }
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [selectedChannel]);

  useEffect(() => {
    loadData();
  }, [refreshTrigger, dateRange, selectedChannel, selectedServer]);

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

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchRetentionStats({
        startDate: formatRangeDate(dateRange.startDate),
        endDate: formatRangeDate(dateRange.endDate),
        channels: selectedChannel !== '全部' ? [selectedChannel] : undefined,
        servers: selectedServer !== '全部' ? [selectedServer] : undefined
      });

      setStats(data);
    } catch (error) {
      console.error('Failed to load retention data:', error);
      setStats([]);
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (val: number) => {
    if (!val || val <= 0) return '0%';
    const p = val > 1 ? val : val * 100;
    const formatted = p.toFixed(2).replace(/\.?0+$/, '');
    return formatted === '0' ? '0%' : `${formatted}%`;
  };

  return (
    <div className="p-6 space-y-4 max-w-[100vw] overflow-hidden">
      {/* Top Tab Bar */}
      <div className="bg-white border-b border-neutral-200 px-4 py-2.5 flex items-center shadow-xs">
        <span className="text-xs font-semibold text-neutral-800 bg-neutral-100 px-3 py-1.5 rounded-md">
          留存
        </span>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* Time Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-600">时间：</span>
              <div className="w-64 relative">
                <Datepicker 
                  inputId="retention-datepicker-input"
                  value={dateRange as any} 
                  onChange={(newValue: any) => setDateRange(newValue)}
                  showShortcuts={true}
                  useRange={true}
                  asSingle={false}
                  separator="-"
                  displayFormat="YYYY-MM-DD"
                  i18n="zh"
                  primaryColor="indigo"
                  popoverDirection="down"
                  readOnly={true}
                  containerClassName="relative w-full z-[100]"
                  toggleClassName="absolute right-0 top-0 h-full px-3 text-neutral-400 focus:outline-none"
                  inputClassName="w-full px-3 py-1 text-xs bg-white border border-neutral-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none text-neutral-800 shadow-xs cursor-pointer"
                />
              </div>
            </div>

            {/* Server Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-600">服务器：</span>
              <select
                className="text-xs border border-neutral-200 rounded-md focus:ring-1 focus:ring-indigo-500 h-8 px-3 bg-white text-neutral-700 shadow-xs min-w-[120px]"
                value={selectedServer}
                onChange={e => setSelectedServer(e.target.value)}
              >
                {meta.servers.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Channel Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-600">渠道：</span>
              <select
                className="text-xs border border-neutral-200 rounded-md focus:ring-1 focus:ring-indigo-500 h-8 px-3 bg-white text-neutral-700 shadow-xs min-w-[120px]"
                value={selectedChannel}
                onChange={e => setSelectedChannel(e.target.value)}
              >
                {meta.channels.map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Button */}
          <button 
            onClick={loadData}
            className="bg-[#2B364A] text-white px-5 py-1.5 rounded-md text-xs font-medium hover:bg-[#1f2837] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Search size={13} />
            搜索
          </button>
        </div>
      </div>

      {/* Retention Table Card */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-800 font-semibold uppercase">
                <th className="px-4 py-2.5 whitespace-nowrap min-w-[70px]">服务器</th>
                <th className="px-4 py-2.5 whitespace-nowrap min-w-[80px]">渠道</th>
                <th className="px-4 py-2.5 whitespace-nowrap min-w-[95px]">日期</th>
                <th className="px-4 py-2.5 whitespace-nowrap min-w-[80px]">新账号</th>
                {RETENTION_DAYS.map(day => (
                  <th key={day} className="px-3 py-2.5 whitespace-nowrap text-center min-w-[60px]">
                    {day}留
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-800">
              {loading ? (
                <tr>
                  <td colSpan={4 + RETENTION_DAYS.length} className="px-6 py-12 text-center text-neutral-400">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      加载留存数据中...
                    </div>
                  </td>
                </tr>
              ) : stats.length === 0 ? (
                <tr>
                  <td colSpan={4 + RETENTION_DAYS.length} className="px-6 py-12 text-center text-neutral-400">
                    暂无留存数据
                  </td>
                </tr>
              ) : (
                stats.map(row => (
                  <tr key={row.date} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-600">{row.server}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-600">{row.channel}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-medium text-neutral-900">{row.date}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-medium text-neutral-800">{row.new_accounts.toLocaleString()}</td>
                    {RETENTION_DAYS.map(day => {
                      const val = row.retentions[day] || 0;
                      const formatted = formatPercent(val);
                      const isZero = formatted === '0%';
                      return (
                        <td 
                          key={day} 
                          className={`px-3 py-2.5 whitespace-nowrap text-center ${isZero ? 'text-neutral-400' : 'text-neutral-900 font-normal'}`}
                        >
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
