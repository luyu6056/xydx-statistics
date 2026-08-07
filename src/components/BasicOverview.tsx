import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchBasicStats, fetchMeta, type BasicStatsItem, type BasicStatsSummary, type MetaData } from '../lib/api';
import { cn } from '../lib/utils';
import Datepicker from "react-tailwindcss-datepicker";
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

export function BasicOverview() {
  const [stats, setStats] = useState<BasicStatsItem[]>([]);
  const [summary, setSummary] = useState<BasicStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 6),
    endDate: new Date()
  });
  
  // Filters setup
  const [meta, setMeta] = useState<MetaData>({ channels: [], servers: [] });
  const [selectedChannels, setSelectedChannels] = useState<string[]>(() => {
    const params = new URLSearchParams(window.location.search);
    const group = params.get('group');
    return group && group !== '全部' ? [group] : [];
  });
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const handleRefresh = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener('app-refresh', handleRefresh);
    return () => window.removeEventListener('app-refresh', handleRefresh);
  }, []);

  useEffect(() => {
    fetchMeta().then(setMeta);
  }, []);

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
    loadData();
  }, [refreshTrigger, dateRange, selectedChannels, selectedServers]);

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
      const data = await fetchBasicStats({
        startDate: formatRangeDate(dateRange.startDate),
        endDate: formatRangeDate(dateRange.endDate),
        channels: selectedChannels
      });

      if (data) {
        // Sort by date descending
        setStats(data.stats.sort((a, b) => {
          const da = dayjs(a.date).valueOf();
          const db = dayjs(b.date).valueOf();
          return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
        }));
        setSummary(data.summary);
      } else {
        setStats([]);
        setSummary(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format money (assuming input is in cents/fen)
  const formatMoney = (amount: number, currency: 'CNY' | 'USD' = 'CNY') => {
    const val = amount / 100;
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Header / Filter */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col gap-4 overflow-visible">
        <div className="flex flex-wrap gap-4 items-center justify-between">
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
                inputId="basic-overview-datepicker-input"
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
                className="text-sm border-neutral-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 h-9 min-w-[100px] bg-white shadow-sm border text-neutral-700"
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
              onClick={loadData}
              className="bg-neutral-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 transition-all hover:translate-y-[-1px] shadow-sm flex items-center gap-2"
            >
              <Search size={14} />
              搜索
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          {/* Top Row: Key Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-neutral-100 bg-neutral-50/50">
            <div className="p-6 flex flex-col items-center justify-center text-center">
              <span className="text-neutral-500 text-sm font-medium mb-2">总收入</span>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-indigo-600">
                  ￥{formatMoney(summary.total_pay_amount_cny)}
                </span>
                <span className="text-xs text-neutral-400 mt-1 font-mono">
                  ${formatMoney(summary.total_pay_amount_usd, 'USD')}
                </span>
              </div>
            </div>
            <div className="p-6 flex flex-col items-center justify-center text-center">
              <span className="text-neutral-500 text-sm font-medium mb-2">总设备</span>
              <span className="text-2xl font-bold text-neutral-900">{summary.total_devices.toLocaleString()}</span>
            </div>
            <div className="p-6 flex flex-col items-center justify-center text-center">
              <span className="text-neutral-500 text-sm font-medium mb-2">总账号</span>
              <span className="text-2xl font-bold text-neutral-900">{summary.total_accounts.toLocaleString()}</span>
            </div>
          </div>

          {/* Detailed Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-100 border-t border-neutral-100">
            {/* New Users Stats */}
            <div className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                新增玩家数据
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">新增玩家总数</div>
                  <div className="text-lg font-medium text-neutral-900">{summary.new_player_total.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">新增付费数</div>
                  <div className="text-lg font-medium text-neutral-900">{summary.new_pay_users.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">新增付费率</div>
                  <div className="text-lg font-medium text-neutral-900">{summary.new_pay_rate.toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">新增ARPU</div>
                  <div className="text-lg font-medium text-neutral-900">{(summary.new_arpu / 100).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">新增ARPPU</div>
                  <div className="text-lg font-medium text-neutral-900">{(summary.new_arppu / 100).toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Active Users Stats */}
            <div className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                活跃玩家数据
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">活跃玩家总数</div>
                  <div className="text-lg font-medium text-neutral-900">{summary.active_player_total.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">活跃付费数</div>
                  <div className="text-lg font-medium text-neutral-900">{summary.active_pay_users.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">活跃付费率</div>
                  <div className="text-lg font-medium text-neutral-900">{summary.active_pay_rate.toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">活跃ARPU</div>
                  <div className="text-lg font-medium text-neutral-900">{(summary.active_arpu / 100).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">活跃ARPPU</div>
                  <div className="text-lg font-medium text-neutral-900">{(summary.active_arppu / 100).toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-neutral-50 text-neutral-900 font-semibold border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3">日期</th>
                <th className="px-4 py-3">新增设备</th>
                <th className="px-4 py-3">新增账号</th>
                <th className="px-4 py-3">活跃账号</th>
                <th className="px-4 py-3">老用户付费人数</th>
                <th className="px-4 py-3">付费人数</th>
                <th className="px-4 py-3">账号付费率</th>
                <th className="px-4 py-3">新增付费率</th>
                <th className="px-4 py-3">活跃付费率</th>
                <th className="px-4 py-3">付费总额(cny)</th>
                <th className="px-4 py-3">付费总额(usd)</th>
                <th className="px-4 py-3">新增设备APU</th>
                <th className="px-4 py-3">新增账号APU</th>
                <th className="px-4 py-3">付费APU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-neutral-500">加载中...</td>
                </tr>
              ) : stats.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-neutral-500">暂无数据</td>
                </tr>
              ) : stats.map((row) => (
                <tr key={row.date} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-neutral-900">{row.date}</td>
                  <td className="px-4 py-3">{row.new_devices.toLocaleString()}</td>
                  <td className="px-4 py-3">{row.new_accounts.toLocaleString()}</td>
                  <td className="px-4 py-3">{row.active_accounts.toLocaleString()}</td>
                  <td className="px-4 py-3">{row.old_pay_users.toLocaleString()}</td>
                  <td className="px-4 py-3">{row.total_pay_users.toLocaleString()}</td>
                  <td className="px-4 py-3">{row.pay_rate.toFixed(1)}%</td>
                  <td className="px-4 py-3">{row.new_pay_rate.toFixed(1)}%</td>
                  <td className="px-4 py-3">{row.active_pay_rate.toFixed(1)}%</td>
                  <td className="px-4 py-3">{formatMoney(row.pay_amount_cny)}</td>
                  <td className="px-4 py-3">${formatMoney(row.pay_amount_usd, 'USD')}</td>
                  <td className="px-4 py-3">{(row.new_device_arpu / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">{(row.new_account_arpu / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">{(row.pay_arpu / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Mock */}
        <div className="p-4 border-t border-neutral-200 flex gap-2">
          <button className="p-1 border border-neutral-300 rounded hover:bg-neutral-50 text-neutral-600 disabled:opacity-50">
            <ChevronLeft size={16} />
          </button>
          <button className="p-1 border border-neutral-300 rounded hover:bg-neutral-50 text-neutral-600">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
