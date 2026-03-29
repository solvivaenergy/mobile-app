import { supabase } from './supabase';

// The FastAPI monitoring service URL (Render deployment)
const API_BASE_URL = 'https://api.solvivaenergy.com';

export type LiveData = {
  current_power_w: number;
  today_production_kwh: number;
  today_consumption_kwh: number;
  today_grid_import_kwh: number;
  today_grid_export_kwh: number;
  battery_level: number | null;
  battery_status: string | null;
  capacity_kwp: number;
  station_name: string;
  alltime_production_kwh: number;
  month_production_kwh: number;
  today_hourly?: { hour: number; production_kwh: number; consumption_kwh: number }[];
  today_readings?: { timestamp: string; production_kw: number; consumption_kw: number; battery_level: number | null }[];
};

/**
 * Fetch real-time data from the FastAPI monitoring service.
 *
 * This hits Solis Cloud on-demand for current power, today's running totals,
 * and live battery state. Historical data (week/month charts) stays in Supabase.
 */
export const fetchLiveData = async (): Promise<LiveData | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.log('fetchLiveData: no active session');
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_BASE_URL}/app/live`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log('fetchLiveData error:', response.status, await response.text());
      return null;
    }

    return await response.json();
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.log('fetchLiveData: timed out after 10s');
    } else {
      console.log('fetchLiveData network error:', error);
    }
    return null;
  }
};
