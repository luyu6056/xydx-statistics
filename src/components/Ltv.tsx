import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchLtvStats, fetchMeta, LTV_DAYS, type LtvStatsItem, type MetaData } from '../lib/api';
import Datepicker from "react-tailwindcss-datepicker";
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

export function Ltv() {
  const [stats, setStats] = useState<LtvStatsItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Date range
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 9),
    endDate: new Date()
  });

  // Filters
  const [meta, setMeta] = useState<MetaData>({ channels: ['全部'], channelGroups: ['全部'], servers: ['全部'] });
  const [selectedServer, setSelectedServer] = useState<string>('全部');
  const [selectedChannel, setSelectedChannel] = useState<string>('全部');
  const [selectedChannelGroup, setSelectedChannelGroup] = useState<string>('全部');
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const handleRefresh = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener('app-refresh', handleRefresh);
    return () => window.removeEventListener('app-refresh', handleRefresh);
  }, []);

  useEffect(() => {
    fetchMeta().then(data => {
      const serversList = data.servers.includes('全部') ? data.servers : ['全部', ...data.servers];
      const channelsList = data.channels.includes('全部') ? data.channels : ['全部', ...data.channels];
      const groupsList = data.channelGroups.includes('全部') ? data.channelGroups : ['全部', ...data.channelGroups];
      setMeta({ channels: channelsList, channelGroups: groupsList, servers: serversList });
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [refreshTrigger, dateRange, selectedServer, selectedChannel, selectedChannelGroup]);

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
      const data = await fetchLtvStats({
        startDate: formatRangeDate(dateRange.startDate),
        endDate: formatRangeDate(dateRange.endDate),
        channels: selectedChannel !== '全部' ? [selectedChannel] : undefined,
        servers: selectedServer !== '全部' ? [selectedServer] : undefined,
        channelGroups: selectedChannelGroup !== '全部' ? [selectedChannelGroup] : undefined
      });

      setStats(data);
      setPage(1);
    } catch (error) {
      console.error('Failed to load LTV data:', error);
      setStats([]);
    } finally {
      setLoading(false);
    }
  };

  const maxPage = Math.max(1, Math.ceil(stats.length / pageSize));
  const paginatedStats = stats.slice((page - 1) * pageSize, page * pageSize);

  const formatLtvValue = (val: number) => {
    if (!val || val === 0) return '0';
    return val.toFixed(2);
  };

  return (
    <div className="p-6 space-y-4 max-w-[100vw] overflow-hidden">
      {/* Top Header Card */}
      <div className="bg-white border-b border-neutral-200 px-4 py-2.5 flex items-center shadow-xs">
        <span className="text-xs font-semibold text-neutral-800 bg-neutral-100 px-3 py-1.5 rounded-md">
          LTV查询
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
                  inputId="ltv-datepicker-input"
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
                className="text-xs border border-neutral-200 rounded-md focus:ring-1 focus:ring-indigo-500 h-8 px-3 bg-white text-neutral-700 shadow-xs min-w-[110px]"
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
                className="text-xs border border-neutral-200 rounded-md focus:ring-1 focus:ring-indigo-500 h-8 px-3 bg-white text-neutral-700 shadow-xs min-w-[110px]"
                value={selectedChannel}
                onChange={e => setSelectedChannel(e.target.value)}
              >
                {meta.channels.map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>

            {/* Channel Group Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-600">渠道组：</span>
              <select
                className="text-xs border border-neutral-200 rounded-md focus:ring-1 focus:ring-indigo-500 h-8 px-3 bg-white text-neutral-700 shadow-xs min-w-[110px]"
                value={selectedChannelGroup}
                onChange={e => setSelectedChannelGroup(e.target.value)}
              >
                {meta.channelGroups.map(cg => (
                  <option key={cg} value={cg}>{cg}</option>
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

      {/* LTV Table Container */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden space-y-3 pb-3">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-800 font-semibold uppercase">
                <th className="px-3 py-2.5 whitespace-nowrap min-w-[90px]">开服日期</th>
                <th className="px-3 py-2.5 whitespace-nowrap min-w-[70px]">新增设备</th>
                <th className="px-3 py-2.5 whitespace-nowrap min-w-[70px]">新增账号</th>
                <th className="px-3 py-2.5 whitespace-nowrap min-w-[90px]">新增付费总额</th>
                {LTV_DAYS.map(day => (
                  <th key={day} className="px-2 py-2.5 whitespace-nowrap text-center min-w-[45px]">
                    {day}日
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-800">
              {loading ? (
                <tr>
                  <td colSpan={4 + LTV_DAYS.length} className="px-6 py-12 text-center text-neutral-400">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      加载LTV数据中...
                    </div>
                  </td>
                </tr>
              ) : paginatedStats.length === 0 ? (
                <tr>
                  <td colSpan={4 + LTV_DAYS.length} className="px-6 py-12 text-center text-neutral-400">
                    暂无LTV数据
                  </td>
                </tr>
              ) : (
                paginatedStats.map(row => (
                  <tr key={row.date} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium text-neutral-900">{row.date}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-neutral-700">{row.new_devices.toLocaleString()}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-neutral-700">{row.new_accounts.toLocaleString()}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-neutral-800 font-medium">{row.new_pay_total.toFixed(2)}</td>
                    {LTV_DAYS.map(day => {
                      const val = row.ltv[day] || 0;
                      const formatted = formatLtvValue(val);
                      const isZero = formatted === '0';
                      return (
                        <td 
                          key={day} 
                          className={`px-2 py-2.5 whitespace-nowrap text-center ${isZero ? 'text-neutral-400' : 'text-neutral-900'}`}
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

        {/* Bottom Pagination Controls (left aligned as per screenshot) */}
        {!loading && stats.length > 0 && (
          <div className="px-4 pt-1 pb-1 flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-2.5 py-1 border border-neutral-200 rounded text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer min-w-[32px]"
            >
              ←
            </button>
            <button
              disabled={page >= maxPage}
              onClick={() => setPage(p => Math.min(maxPage, p + 1))}
              className="px-2.5 py-1 border border-neutral-200 rounded text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer min-w-[32px]"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
