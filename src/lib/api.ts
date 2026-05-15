import { format, parse, isValid } from 'date-fns';
import dayjs from 'dayjs';

export interface DailyStats {
  date: string;
  dau: number;
  new_users: number;
  revenue: number;
  retention_1d: number;
  retention_7d: number;
}

export interface MetaData {
  channels: string[];
  servers: string[];
}

// Define the response shape from the external API
interface ExternalStatsResponse {
  code: number;
  data: {
    add_time: string;
    avg_dau: number;
    daily_active_users: Array<{ date: string | number; total: number }>;
    daily_new_users: Array<{ date: string | number; total: number }>;
    daily_revenue: Array<{ date: string | number; total: number }>;
    new_users: number;
    total_revenue: number;
  };
}

const API_BASE_URL = process.env.API_URI || 'https://statistics.xydx.net/';
const API_BASE_URL_OP = process.env.API_URI_OP || 'https://statistics-op.xydx.net/';

export type ApiEnvironment = 'standard' | 'operational';
let currentEnv: ApiEnvironment = (localStorage.getItem('api_env') as ApiEnvironment) || 'standard';

export function setApiEnv(env: ApiEnvironment) {
  currentEnv = env;
  localStorage.setItem('api_env', env);
  window.dispatchEvent(new CustomEvent('app-refresh'));
}

export function getApiEnv(): ApiEnvironment {
  return currentEnv;
}

function getBaseUrl() {
  return currentEnv === 'operational' ? API_BASE_URL_OP : API_BASE_URL;
}

// Global map to store source information for channel groups
let groupSourceMap = new Map<string, ApiEnvironment>();

export async function fetchMeta(): Promise<MetaData> {
  try {
    const channelsList = await get_channel_list();
    
    // Clear and rebuild the map
    groupSourceMap.clear();
    channelsList.forEach(c => {
      if (c.group && c.source) {
        groupSourceMap.set(c.group, c.source);
      }
    });

    // Extract unique groups and filter out empty ones
    const uniqueGroups = Array.from(new Set(
      channelsList
        .map(c => c.group)
        .filter(g => g && g.trim() !== '')
    )).sort();
    
    return { 
      channels: ['全部', ...uniqueGroups], 
      servers: [] 
    };
  } catch (error) {
    console.error('Failed to fetch metadata:', error);
    return { channels: ['全部'], servers: [] };
  }
}

export interface StatsResponse {
  stats: DailyStats[];
  summary?: {
    new_users: number;
    total_revenue: number;
    avg_dau: number;
  };
}

function getBaseUrlForParams(channels?: string[]) {
  if (channels && channels.length > 0 && channels[0] !== '全部') {
    const source = groupSourceMap.get(channels[0]);
    if (source === 'operational') return API_BASE_URL_OP;
    if (source === 'standard') return API_BASE_URL;
  }
  return getBaseUrl();
}

async function fetchSingleStats(baseUrl: string, query: URLSearchParams): Promise<StatsResponse> {
  const response = await fetch(`${baseUrl}statistics/total_stats?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }
  
  const json: ExternalStatsResponse = await response.json();
  
  if (json.code !== 1 || !json.data) {
    console.error('Invalid API response format', json);
    return { stats: [] };
  }

  const { daily_active_users, daily_new_users, daily_revenue, new_users, total_revenue, avg_dau } = json.data;
  const statsMap = new Map<string, DailyStats>();

  const getStats = (rawDate: string | number) => {
    const dateStr = String(rawDate).trim();
    let formattedDate = dateStr;
    if (!dateStr.includes('-') && dateStr.length === 8) {
      formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    
    if (!statsMap.has(formattedDate)) {
      statsMap.set(formattedDate, {
        date: formattedDate,
        dau: 0,
        new_users: 0,
        revenue: 0,
        retention_1d: 0,
        retention_7d: 0,
      });
    }
    return statsMap.get(formattedDate)!;
  };

  if (Array.isArray(daily_active_users)) {
    daily_active_users.forEach(item => {
      if (item.date) {
        const stats = getStats(item.date);
        stats.dau += item.total || 0;
      }
    });
  }

  if (Array.isArray(daily_new_users)) {
    daily_new_users.forEach(item => {
      if (item.date) {
        const stats = getStats(item.date);
        stats.new_users += item.total || 0;
      }
    });
  }

  if (Array.isArray(daily_revenue)) {
    daily_revenue.forEach(item => {
      if (item.date) {
        const stats = getStats(item.date);
        stats.revenue += (item.total || 0) / 100;
      }
    });
  }

  const results = Array.from(statsMap.values());
  
  return {
    stats: results,
    summary: {
      new_users: results.reduce((acc, s) => acc + s.new_users, 0),
      total_revenue: results.reduce((acc, s) => acc + s.revenue, 0) * 100, // back to cents
      avg_dau: results.length > 0 ? Math.round(results.reduce((acc, s) => acc + s.dau, 0) / results.length) : 0
    }
  };
}

export async function fetchStats(params: {
  startDate?: string;
  endDate?: string;
  channels?: string[];
  servers?: string[];
}): Promise<StatsResponse> {
  try {
    const isAll = !params.channels || params.channels.length === 0 || params.channels[0] === '全部';
    const query = new URLSearchParams();
    if (params.startDate) query.append('begin_date', params.startDate);
    if (params.endDate) query.append('end_date', params.endDate);
    if (!isAll && params.channels) {
      query.append('group', params.channels[0]);
    }
    
    let stats1: StatsResponse;
    let stats2: StatsResponse | null = null;

    if (isAll) {
      [stats1, stats2] = await Promise.all([
        fetchSingleStats(API_BASE_URL, query),
        fetchSingleStats(API_BASE_URL_OP, query)
      ]);
    } else {
      const baseUrl = getBaseUrlForParams(params.channels);
      stats1 = await fetchSingleStats(baseUrl, query);
    }
    
    // Merge results if we have two responses
    const mergedMap = new Map<string, DailyStats>();
    const processStats = (s: DailyStats[]) => {
      s.forEach(item => {
        const existing = mergedMap.get(item.date);
        if (existing) {
          existing.dau += item.dau;
          existing.new_users += item.new_users;
          existing.revenue += item.revenue;
          // Retention is tricky to merge without original counts, simple average for now
          existing.retention_1d = (existing.retention_1d + item.retention_1d) / 2;
          existing.retention_7d = (existing.retention_7d + item.retention_7d) / 2;
        } else {
          mergedMap.set(item.date, { ...item });
        }
      });
    };

    processStats(stats1.stats);
    if (stats2) processStats(stats2.stats);

    let results = Array.from(mergedMap.values()).sort((a, b) => {
      const da = dayjs(a.date).valueOf();
      const db = dayjs(b.date).valueOf();
      return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
    });

    // Client-side filtering
    if (params.startDate) results = results.filter(s => s.date >= params.startDate!);
    if (params.endDate) results = results.filter(s => s.date <= params.endDate!);

    const summary = {
      new_users: results.reduce((acc, s) => acc + s.new_users, 0),
      total_revenue: results.reduce((acc, s) => acc + s.revenue, 0) * 100, // as cents for the dashboard's /100
      avg_dau: results.length > 0 ? Math.round(results.reduce((acc, s) => acc + s.dau, 0) / results.length) : 0
    };

    return { stats: results, summary };
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return { stats: [] };
  }
}

export interface BasicStatsItem {
  date: string;
  new_devices: number;
  new_accounts: number;
  active_accounts: number;
  old_pay_users: number;
  total_pay_users: number;
  pay_rate: number;
  new_pay_rate: number;
  active_pay_rate: number;
  pay_amount_cny: number;
  pay_amount_usd: number;
  new_device_arpu: number;
  new_account_arpu: number;
  pay_arpu: number;
}

export interface BasicStatsSummary {
  total_pay_amount_cny: number;
  total_pay_amount_usd: number;
  total_devices: number;
  total_accounts: number;
  new_player_total: number;
  new_pay_users: number;
  new_pay_rate: number;
  new_arpu: number;
  new_arppu: number;
  active_player_total: number;
  active_pay_users: number;
  active_pay_rate: number;
  active_arpu: number;
  active_arppu: number;
}

interface BasicStatsApiResponse {
  code: number;
  data: {
    stats: BasicStatsItem[];
    summary: BasicStatsSummary;
  };
}

async function fetchSingleBasicStats(baseUrl: string, query: URLSearchParams): Promise<{ stats: BasicStatsItem[]; summary: BasicStatsSummary } | null> {
  const response = await fetch(`${baseUrl}statistics/basic_stats?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const json: BasicStatsApiResponse = await response.json();
  if (json.code !== 1 || !json.data) {
    console.error('Invalid API response format', json);
    return null;
  }

  const stats = json.data.stats;
  const summary = json.data.summary;
  
  // Recalculate summary totals from stats for consistency with display
  if (Array.isArray(stats) && stats.length > 0) {
    summary.total_pay_amount_cny = stats.reduce((acc, s) => acc + s.pay_amount_cny, 0);
    summary.total_pay_amount_usd = stats.reduce((acc, s) => acc + s.pay_amount_usd, 0);
    summary.new_player_total = stats.reduce((acc, s) => acc + s.new_accounts, 0);
    summary.new_pay_users = stats.reduce((acc, s) => acc + (s.total_pay_users - s.old_pay_users), 0);
    summary.active_player_total = Math.max(...stats.map(s => s.active_accounts), summary.active_player_total);
  }

  return json.data;
}

export async function fetchBasicStats(params: {
  startDate: string;
  endDate: string;
  channels?: string[];
}): Promise<{ stats: BasicStatsItem[]; summary: BasicStatsSummary } | null> {
  try {
    const isAll = !params.channels || params.channels.length === 0 || params.channels[0] === '全部';
    const query = new URLSearchParams({
      begin_date: params.startDate,
      end_date: params.endDate,
    });
    
    let res1: { stats: BasicStatsItem[]; summary: BasicStatsSummary } | null;
    let res2: { stats: BasicStatsItem[]; summary: BasicStatsSummary } | null = null;

    if (isAll) {
      const baseUrl1 = API_BASE_URL;
      const baseUrl2 = API_BASE_URL_OP;
      [res1, res2] = await Promise.all([
        fetchSingleBasicStats(baseUrl1, query),
        fetchSingleBasicStats(baseUrl2, query)
      ]);
    } else {
      const baseUrl = getBaseUrlForParams(params.channels);
      res1 = await fetchSingleBasicStats(baseUrl, query);
    }

    if (!res1 && !res2) return null;
    if (!res2) return res1;
    if (!res1) return res2;

    // Merge logic
    const mergedStatsMap = new Map<string, BasicStatsItem>();
    const mergeStats = (items: BasicStatsItem[]) => {
      items.forEach(item => {
        const existing = mergedStatsMap.get(item.date);
        if (existing) {
          existing.new_devices += item.new_devices;
          existing.new_accounts += item.new_accounts;
          existing.active_accounts += item.active_accounts;
          existing.old_pay_users += item.old_pay_users;
          existing.total_pay_users += item.total_pay_users;
          existing.pay_amount_cny += item.pay_amount_cny;
          existing.pay_amount_usd += item.pay_amount_usd;
          // Rates and ARPUs are weighted, but simple average for now given the lack of raw counts
          existing.pay_rate = (existing.pay_rate + item.pay_rate) / 2;
          existing.new_pay_rate = (existing.new_pay_rate + item.new_pay_rate) / 2;
          existing.active_pay_rate = (existing.active_pay_rate + item.active_pay_rate) / 2;
          existing.new_device_arpu = (existing.new_device_arpu + item.new_device_arpu) / 2;
          existing.new_account_arpu = (existing.new_account_arpu + item.new_account_arpu) / 2;
          existing.pay_arpu = (existing.pay_arpu + item.pay_arpu) / 2;
        } else {
          mergedStatsMap.set(item.date, { ...item });
        }
      });
    };

    mergeStats(res1.stats);
    mergeStats(res2.stats);

    const finalStats = Array.from(mergedStatsMap.values()).sort((a, b) => dayjs(b.date).diff(dayjs(a.date)));

    const mergedSummary: BasicStatsSummary = {
      total_pay_amount_cny: finalStats.reduce((acc, s) => acc + s.pay_amount_cny, 0),
      total_pay_amount_usd: finalStats.reduce((acc, s) => acc + s.pay_amount_usd, 0),
      total_devices: finalStats.reduce((acc, s) => acc + s.new_devices, 0), // approximating from new
      total_accounts: finalStats.reduce((acc, s) => acc + s.new_accounts, 0),
      new_player_total: finalStats.reduce((acc, s) => acc + s.new_accounts, 0),
      new_pay_users: finalStats.reduce((acc, s) => acc + (s.total_pay_users - s.old_pay_users), 0),
      new_pay_rate: finalStats.length > 0 ? (finalStats.reduce((acc, s) => acc + s.new_pay_rate, 0) / finalStats.length) : 0,
      new_arpu: finalStats.length > 0 ? (finalStats.reduce((acc, s) => acc + s.new_account_arpu, 0) / finalStats.length) : 0,
      new_arppu: finalStats.length > 0 ? (finalStats.reduce((acc, s) => acc + (s.pay_amount_cny / Math.max(1, s.total_pay_users - s.old_pay_users)), 0) / finalStats.length) : 0,
      active_player_total: finalStats.length > 0 ? Math.max(...finalStats.map(s => s.active_accounts)) : 0,
      active_pay_users: finalStats.length > 0 ? Math.max(...finalStats.map(s => s.total_pay_users)) : 0,
      active_pay_rate: finalStats.length > 0 ? (finalStats.reduce((acc, s) => acc + s.active_pay_rate, 0) / finalStats.length) : 0,
      active_arpu: finalStats.length > 0 ? (finalStats.reduce((acc, s) => acc + s.account_arpu, 0) / finalStats.length) : 0,
      active_arppu: finalStats.length > 0 ? (finalStats.reduce((acc, s) => acc + s.pay_arpu, 0) / finalStats.length) : 0,
    };

    return {
      stats: finalStats,
      summary: mergedSummary
    };
  } catch (error) {
    console.error('Failed to fetch basic stats:', error);
    return null;
  }
}

export interface ChannelItem {
  channel_id: string;
  game_id: string;
  group: string;
  id: number;
  name: string;
  source?: ApiEnvironment;
}

interface ChannelListApiResponse {
  code: number;
  data: ChannelItem[];
}

export async function get_channel_list(): Promise<ChannelItem[]> {
  try {
    const fetchFrom = async (baseUrl: string, env: ApiEnvironment): Promise<ChannelItem[]> => {
      try {
        const response = await fetch(`${baseUrl}admin/channel/list`);
        if (!response.ok) return [];
        const json: ChannelListApiResponse = await response.json();
        if (json.code === 1 && Array.isArray(json.data)) {
          return json.data.map(item => ({ ...item, source: env }));
        }
        return [];
      } catch (e) {
        console.error(`Error fetching from ${env}:`, e);
        return [];
      }
    };

    const [list1, list2] = await Promise.all([
      fetchFrom(API_BASE_URL, 'standard'),
      fetchFrom(API_BASE_URL_OP, 'operational')
    ]);

    // Merge and deduplicate by id + source to avoid collisions
    const combined = [...list1, ...list2];
    const uniqueMap = new Map<string, ChannelItem>();
    combined.forEach(item => {
      const key = `${item.id}-${item.source}`;
      uniqueMap.set(key, item);
    });

    return Array.from(uniqueMap.values());
  } catch (error) {
    console.error('Failed to fetch merged channel list:', error);
    return [];
  }
}

