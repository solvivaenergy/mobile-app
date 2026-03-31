import { supabase } from "./supabase";

const GMT8_OFFSET_MINUTES = 8 * 60;
const MINUTE_MS = 60 * 1000;

type FiveMinuteRow = {
  timestamp: string;
  battery_level?: number | string | null;
  battery_status?: string | null;
  production_kwh?: number | string | null;
  consumption_kwh?: number | string | null;
  production_kw?: number | string | null;
  consumption_kw?: number | string | null;
  grid_import_kwh?: number | string | null;
  grid_export_kwh?: number | string | null;
  daily_earning?: number | string | null;
  lifetime_earning?: number | string | null;
  lifetime_savings_php?: number | string | null;
  lifetime_earning_php?: number | string | null;
  lifetime_earnings_php?: number | string | null;
  alltime_production_kwh?: number | string | null;
  [key: string]: unknown;
};

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
  lifetime_savings_php?: number;
  month_production_kwh: number;
  today_hourly?: {
    hour: number;
    production_kwh: number;
    consumption_kwh: number;
  }[];
  today_readings?: {
    timestamp: string;
    production_kw: number;
    consumption_kw: number;
    battery_level: number | null;
  }[];
};

const normalizeDateInput = (value: string | Date): Date =>
  value instanceof Date ? value : new Date(value);

// Replace the old getGmt8Parts logic with this:
const getGmt8Parts = (value: string | Date) => {
  const date = normalizeDateInput(value);
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hour: date.getHours(), // Reads local system hour
  };
};

// Replace the old getStartOfGmt8Day logic with this:
const getStartOfGmt8Day = (value: string | Date): Date => {
  const date = normalizeDateInput(value);
  // Sets time to 00:00:00 local time
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
const round = (value: number, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const toNumber = (...values: unknown[]): number => {
  for (const value of values) {
    if (value == null) continue;
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
};

const sumBy = (rows: FiveMinuteRow[], getter: (row: FiveMinuteRow) => number) =>
  rows.reduce((sum, row) => sum + getter(row), 0);

export const fetchLiveData = async (): Promise<LiveData | null> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.log("fetchLiveData: no active user");
      return null;
    }

    const todayStart = getStartOfGmt8Day(new Date()).toISOString();
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [todayResult, latestResult, monthResult, lifetimeResult] =
      await Promise.all([
        supabase
          .from("energy_readings_five_minutes")
          .select("*")
          .eq("user_id", user.id)
          .gte("timestamp", todayStart)
          .order("timestamp", { ascending: true }),
        supabase
          .from("energy_readings_five_minutes")
          .select("*")
          .eq("user_id", user.id)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("energy_readings_five_minutes")
          .select("production_kwh")
          .eq("user_id", user.id)
          .gte("timestamp", monthStart.toISOString()),
        supabase
          .from("energy_readings_five_minutes")
          .select("lifetime_earning")
          .eq("user_id", user.id)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (todayResult.error) {
      console.log("fetchLiveData today error:", todayResult.error.message);
      return null;
    }

    if (latestResult.error) {
      console.log("fetchLiveData latest error:", latestResult.error.message);
      return null;
    }

    if (monthResult.error) {
      console.log("fetchLiveData month error:", monthResult.error.message);
      return null;
    }

    if (lifetimeResult.error) {
      console.log("fetchLiveData lifetime error:", lifetimeResult.error.message);
      return null;
    }

    const todayRows = (todayResult.data ?? []) as FiveMinuteRow[];
    const latestRow = (latestResult.data ?? null) as FiveMinuteRow | null;
    const monthRows = (monthResult.data ?? []) as FiveMinuteRow[];
    const lifetimeRow = (lifetimeResult.data ?? null) as FiveMinuteRow | null;

    const todayProduction = sumBy(todayRows, (row) =>
      toNumber(row.production_kwh, row.production_kw),
    );
    const todayConsumption = sumBy(todayRows, (row) =>
      toNumber(row.consumption_kwh, row.consumption_kw),
    );
    const todayGridImport = sumBy(todayRows, (row) => toNumber(row.grid_import_kwh));
    const todayGridExport = sumBy(todayRows, (row) => toNumber(row.grid_export_kwh));
    const monthProduction = sumBy(monthRows, (row) => toNumber(row.production_kwh));

    const allTimeProduction =
      toNumber(
        latestRow?.alltime_production_kwh,
        latestRow?.production_total_kwh,
        latestRow?.lifetime_production_kwh,
      );

    const lifetimeSavings = toNumber(
      lifetimeRow?.lifetime_earning,
      latestRow?.lifetime_earning,
      latestRow?.lifetime_savings_php,
      latestRow?.lifetime_earning_php,
      latestRow?.lifetime_earnings_php,
    );

    const todayHourlyMap = new Map<
      number,
      { production_kwh: number; consumption_kwh: number }
    >();

    todayRows.forEach((row) => {
      const hour = getGmt8Parts(row.timestamp).hour;
      const current = todayHourlyMap.get(hour) ?? {
        production_kwh: 0,
        consumption_kwh: 0,
      };
      current.production_kwh += toNumber(row.production_kwh, row.production_kw);
      current.consumption_kwh += toNumber(row.consumption_kwh, row.consumption_kw);
      todayHourlyMap.set(hour, current);
    });

    const todayHourly = Array.from(todayHourlyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, values]) => ({
        hour,
        production_kwh: round(values.production_kwh, 3),
        consumption_kwh: round(values.consumption_kwh, 3),
      }));

    const todayReadings = todayRows.map((row) => ({
      timestamp: row.timestamp,
      production_kw: round(toNumber(row.production_kw, row.production_kwh), 3),
      consumption_kw: round(toNumber(row.consumption_kw, row.consumption_kwh), 3),
      battery_level:
        row.battery_level == null ? null : toNumber(row.battery_level),
    }));

    return {
      current_power_w: round(
        toNumber(latestRow?.production_kw, latestRow?.production_kwh) * 1000,
        0,
      ),
      today_production_kwh: round(todayProduction, 3),
      today_consumption_kwh: round(todayConsumption, 3),
      today_grid_import_kwh: round(todayGridImport, 3),
      today_grid_export_kwh: round(todayGridExport, 3),
      battery_level:
        latestRow?.battery_level == null
          ? null
          : toNumber(latestRow.battery_level),
      battery_status:
        typeof latestRow?.battery_status === "string"
          ? latestRow.battery_status
          : null,
      capacity_kwp: 0,
      station_name: "Solar System",
      alltime_production_kwh: round(allTimeProduction, 3),
      lifetime_savings_php:
        lifetimeSavings > 0 ? round(lifetimeSavings, 2) : undefined,
      month_production_kwh: round(monthProduction, 3),
      today_hourly: todayHourly,
      today_readings: todayReadings,
    };
  } catch (error) {
    console.log("fetchLiveData error:", error);
    return null;
  }
};
