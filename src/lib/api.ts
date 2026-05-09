import { format, parse, isValid } from 'date-fns';

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

export async function fetchMeta(): Promise<MetaData> {
  try {
    const channelsList = await get_channel_list();
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

export async function fetchStats(params: {
  startDate?: string;
  endDate?: string;
  channels?: string[];
  servers?: string[];
}): Promise<StatsResponse> {
  try {
    const query = new URLSearchParams();
    if (params.startDate) query.append('begin_date', params.startDate);
    if (params.endDate) query.append('end_date', params.endDate);
    if (params.channels && params.channels.length > 0 && params.channels[0] !== '全部') {
      query.append('group', params.channels[0]);
    }
    
    const response = await fetch(`${API_BASE_URL}statistics/total_stats?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const json: ExternalStatsResponse = await response.json();
    
    if (json.code !== 1 || !json.data) {
      console.error('Invalid API response format', json);
      return { stats: [] };
    }

    const { daily_active_users, daily_new_users, daily_revenue, new_users, total_revenue, avg_dau } = json.data;
    
    // Map to store aggregated data by date
    const statsMap = new Map<string, DailyStats>();

    // Helper to get or create a stats object for a date
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

    // Process DAU
    if (Array.isArray(daily_active_users)) {
      daily_active_users.forEach(item => {
        if (item.date) {
          const stats = getStats(item.date);
          stats.dau += item.total || 0;
        }
      });
    }

    // Process New Users
    if (Array.isArray(daily_new_users)) {
      daily_new_users.forEach(item => {
        if (item.date) {
          const stats = getStats(item.date);
          stats.new_users += item.total || 0;
        }
      });
    }

    // Process Revenue
    if (Array.isArray(daily_revenue)) {
      daily_revenue.forEach(item => {
        if (item.date) {
          const stats = getStats(item.date);
          stats.revenue += (item.total || 0) / 100;
        }
      });
    }

    // Convert map to array and sort by date
    let results = Array.from(statsMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Client-side filtering
    if (params.startDate) {
      results = results.filter(s => s.date >= params.startDate!);
    }
    if (params.endDate) {
      results = results.filter(s => s.date <= params.endDate!);
    }

    return {
      stats: results,
      summary: {
        new_users: new_users || 0,
        total_revenue: total_revenue || 0,
        avg_dau: avg_dau || 0
      }
    };
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

export async function fetchBasicStats(params: {
  startDate: string;
  endDate: string;
}): Promise<{ stats: BasicStatsItem[]; summary: BasicStatsSummary } | null> {
  try {
    const query = new URLSearchParams({
      begin_date: params.startDate,
      end_date: params.endDate,
    });
    
    const response = await fetch(`${API_BASE_URL}statistics/basic_stats?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const json: BasicStatsApiResponse = await response.json();
    if (json.code !== 1 || !json.data) {
      console.error('Invalid API response format', json);
      return null;
    }

    return json.data;
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
}

interface ChannelListApiResponse {
  code: number;
  data: ChannelItem[];
}

export async function get_channel_list(): Promise<ChannelItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}admin/channel/list`);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const json: ChannelListApiResponse = await response.json();
    if (json.code !== 1 || !json.data) {
      console.error('Invalid API response format', json);
      return [];
    }

    return json.data;
  } catch (error) {
    console.error('Failed to fetch channel list:', error);
    return [];
  }
}

