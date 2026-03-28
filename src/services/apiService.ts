import { supabase } from './supabase';

// The FastAPI monitoring service URL (Render deployment)
// Matches the service name in render.yaml: solviva-api
const API_BASE_URL = 'https://solviva-api.onrender.com';

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

    const response = await fetch(`${API_BASE_URL}/app/live`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log('fetchLiveData error:', response.status, await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.log('fetchLiveData network error:', error);
    return null;
  }
};
