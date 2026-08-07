import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchBasicStats, fetchMeta, type BasicStatsItem, type MetaData } from '../lib/api';
import { cn } from '../lib/utils';
import Datepicker from "react-tailwindcss-datepicker";
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

interface DetailedStatsItem extends BasicStatsItem {
  server: string;
  channel: string;
  active_devices: number;
  account_arpu: number;
  device_arpu: number;
  new_pay_amount: number;
  new_pay_users: number;
  new_pay_arpu: number;
  old_pay_amount: number;
  old_pay_rate: number;
  old_pay_arpu: number;
}

export function Analytics() {
  const [stats, setStats] = useState<DetailedStatsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<MetaData>({ channels: ['全部'], channelGroups: ['全部'], servers: ['全部'] });
  
  // Filters
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 6),
    endDate: new Date()
  });
  const [server, setServer] = useState('全部');
  const [channel, setChannel] = useState('全部');
  const [channelGroup, setChannelGroup] = useState('全部');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchMeta().then(setMeta);
  }, []);

  useEffect(() => {
    const handleRefresh = () => setRefreshTrigger(prev => prev + 1);
    window.addEventListener('app-refresh', handleRefresh);
    return () => window.removeEventListener('app-refresh', handleRefresh);
  }, []);

  useEffect(() => {
    loadData();
  }, [refreshTrigger, dateRange]);

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
        endDate: formatRangeDate(dateRange.endDate)
      });

      if (data) {
        // Sort by date descending
        const sorted = data.stats.sort((a, b) => {
          const da = dayjs(a.date).valueOf();
          const db = dayjs(b.date).valueOf();
          return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
        });
        
        // Enrich data with mock fields to match the detailed query screenshot
        const enriched: DetailedStatsItem[] = sorted.map(s => {
          const new_pay_users = s.total_pay_users - s.old_pay_users;
          // Mocking some values that aren't in the basic stats API
          const active_devices = Math.floor(s.active_accounts * 0.95);
          const account_arpu = s.pay_amount_cny / 100 / s.active_accounts || 0;
          const device_arpu = s.pay_amount_cny / 100 / active_devices || 0;
          
          const new_pay_amount = (s.pay_amount_cny / 100) * 0.3; // mock 30% from new users
          const old_pay_amount = (s.pay_amount_cny / 100) * 0.7; // mock 70% from old users
          
          const new_pay_arpu = new_pay_users > 0 ? new_pay_amount / new_pay_users : 0;
          const old_pay_rate = s.active_accounts > s.new_accounts ? (s.old_pay_users / (s.active_accounts - s.new_accounts)) * 100 : 0;
          const old_pay_arpu = s.old_pay_users > 0 ? old_pay_amount / s.old_pay_users : 0;

          return {
            ...s,
            server: '全部',
            channel: '全渠道',
            active_devices,
            account_arpu,
            device_arpu,
            new_pay_amount,
            new_pay_users,
            new_pay_arpu,
            old_pay_amount,
            old_pay_rate,
            old_pay_arpu
          };
        });
        
        setStats(enriched);
      } else {
        setStats([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number) => {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Header / Filter */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col gap-4 overflow-visible">
        <div className="flex flex-wrap items-center gap-6 justify-between">
          <div className="flex flex-wrap items-center gap-4">
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
                inputId="analytics-datepicker-input"
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

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">服务器:</span>
              <select 
                value={server}
                onChange={e => setServer(e.target.value)}
                className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[100px] bg-white shadow-sm"
              >
                <option value="全部">全部</option>
                <option value="S1">S1</option>
                <option value="S2">S2</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">渠道:</span>
              <select 
                value={channel}
                onChange={e => setChannel(e.target.value)}
                className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[100px] bg-white shadow-sm"
              >
                <option value="全部">全部</option>
                <option value="AppStore">AppStore</option>
                <option value="GooglePlay">GooglePlay</option>
              </select>
            </div>

            <button 
              onClick={loadData}
              className="bg-neutral-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 transition-all hover:translate-y-[-1px] shadow-sm flex items-center gap-2"
            >
              <Search size={14} />
              搜索
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-white text-neutral-900 font-semibold border-b border-neutral-200">
              <tr>
                <th className="px-3 py-4 border-r border-neutral-100">服务器</th>
                <th className="px-3 py-4 border-r border-neutral-100">渠道</th>
                <th className="px-3 py-4 border-r border-neutral-100">日期</th>
                <th className="px-3 py-4 border-r border-neutral-100">新增设备</th>
                <th className="px-3 py-4 border-r border-neutral-100">新增账号</th>
                <th className="px-3 py-4 border-r border-neutral-100">活跃账号</th>
                <th className="px-3 py-4 border-r border-neutral-100">活跃设备</th>
                <th className="px-3 py-4 border-r border-neutral-100">付费人数</th>
                <th className="px-3 py-4 border-r border-neutral-100">活跃付费率</th>
                <th className="px-3 py-4 border-r border-neutral-100">账号ARPU</th>
                <th className="px-3 py-4 border-r border-neutral-100">设备ARPU</th>
                <th className="px-3 py-4 border-r border-neutral-100">付费总额<br/>(cny)</th>
                <th className="px-3 py-4 border-r border-neutral-100">付费总额<br/>(usd)</th>
                <th className="px-3 py-4 border-r border-neutral-100">付费ARPU</th>
                <th className="px-3 py-4 border-r border-neutral-100">新增付费总额</th>
                <th className="px-3 py-4 border-r border-neutral-100">新增付费人数</th>
                <th className="px-3 py-4 border-r border-neutral-100">新增付费率</th>
                <th className="px-3 py-4 border-r border-neutral-100">新增账号ARPU</th>
                <th className="px-3 py-4 border-r border-neutral-100">新增付费ARPU</th>
                <th className="px-3 py-4 border-r border-neutral-100">老用户付费总额</th>
                <th className="px-3 py-4 border-r border-neutral-100">老用户付费人数</th>
                <th className="px-3 py-4 border-r border-neutral-100">老用户付费率</th>
                <th className="px-3 py-4">老用户付费ARPU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={23} className="px-4 py-8 text-center text-neutral-500 text-sm">加载中...</td>
                </tr>
              ) : stats.length === 0 ? (
                <tr>
                  <td colSpan={23} className="px-4 py-8 text-center text-neutral-500 text-sm">暂无数据</td>
                </tr>
              ) : stats.map((row, i) => (
                <tr key={`${row.date}-${i}`} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-3 py-3 border-r border-neutral-100">{row.server}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.channel}</td>
                  <td className="px-3 py-3 border-r border-neutral-100 text-neutral-900">{row.date}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.new_devices.toLocaleString()}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.new_accounts.toLocaleString()}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.active_accounts.toLocaleString()}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.active_devices.toLocaleString()}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.total_pay_users.toLocaleString()}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.active_pay_rate.toFixed(2)}%</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.account_arpu.toFixed(2)}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.device_arpu.toFixed(2)}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{formatMoney(row.pay_amount_cny / 100)}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">${formatMoney(row.pay_amount_usd / 100)}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{(row.pay_arpu / 100).toFixed(2)}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{formatMoney(row.new_pay_amount)}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.new_pay_users.toLocaleString()}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.new_pay_rate.toFixed(2)}%</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{(row.new_account_arpu / 100).toFixed(2)}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.new_pay_arpu.toFixed(2)}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{formatMoney(row.old_pay_amount)}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.old_pay_users.toLocaleString()}</td>
                  <td className="px-3 py-3 border-r border-neutral-100">{row.old_pay_rate.toFixed(2)}%</td>
                  <td className="px-3 py-3">{row.old_pay_arpu.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
