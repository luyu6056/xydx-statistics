import React, { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchBasicStats, type BasicStatsItem, type BasicStatsSummary } from '../lib/api';

export function BasicOverview() {
  const [stats, setStats] = useState<BasicStatsItem[]>([]);
  const [summary, setSummary] = useState<BasicStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchBasicStats({
        startDate: dateRange.start,
        endDate: dateRange.end
      });

      if (data) {
        // Sort by date descending
        setStats(data.stats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
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
      <div className="bg-white p-4 rounded-lg shadow-sm border border-neutral-200">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-neutral-700">时间:</span>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="border border-neutral-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="text-neutral-400">-</span>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="border border-neutral-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button 
            onClick={loadData}
            className="bg-neutral-800 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-neutral-700 transition-colors flex items-center gap-2"
          >
            <Search size={14} />
            搜索
          </button>
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
