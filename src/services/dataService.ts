import { supabase } from './supabase';

const GMT8_TIME_ZONE = 'Asia/Manila';
const GMT8_OFFSET_MINUTES = 8 * 60;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeDateInput = (value: string | Date): Date =>
  value instanceof Date ? value : new Date(value);

const toUtcMs = (date: Date): number =>
  date.getTime() + date.getTimezoneOffset() * MINUTE_MS;

const toGmt8WallClock = (date: Date): Date =>
  new Date(toUtcMs(date) + GMT8_OFFSET_MINUTES * MINUTE_MS);

const getGmt8Parts = (value: string | Date) => {
  const wallClock = toGmt8WallClock(normalizeDateInput(value));
  return {
    year: wallClock.getUTCFullYear(),
    month: wallClock.getUTCMonth(),
    day: wallClock.getUTCDate(),
    weekday: wallClock.getUTCDay(),
    hour: wallClock.getUTCHours(),
    minute: wallClock.getUTCMinutes(),
  };
};

const getStartOfGmt8Day = (value: string | Date): Date => {
  const { year, month, day } = getGmt8Parts(value);
  return new Date(Date.UTC(year, month, day) - GMT8_OFFSET_MINUTES * MINUTE_MS);
};

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getGmt8WeekdayShort = (value: string | Date): string =>
  WEEKDAY_SHORT[getGmt8Parts(value).weekday] ?? 'Mon';

const WEEKDAY_INDEX_BY_SHORT: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

// ============================================================
// Helper: get current user ID
// ============================================================
export const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
};

// ============================================================
// User Profile
// ============================================================
export const fetchUserProfile = async () => {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (error) {
    console.log('fetchUserProfile error:', error.message);
    return null;
  }
  // Merge the auth email into the profile object
  return { ...data, email: authUser.email };
};

// ============================================================
// Solar Systems
// ============================================================
export const fetchSolarSystem = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('solar_systems')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error) {
    console.log('fetchSolarSystem error:', error.message);
    return null;
  }
  return data;
};

// ============================================================
// Energy Readings
// ============================================================
export const fetchTodayReadings = async (systemId?: string) => {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const todayStart = getStartOfGmt8Day(new Date());

  let query = supabase
    .from('energy_readings')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', todayStart.toISOString())
    .order('timestamp', { ascending: true });

  if (systemId) {
    query = query.eq('system_id', systemId);
  }

  const { data, error } = await query;
  if (error) {
    console.log('fetchTodayReadings error:', error.message);
    return [];
  }
  return data ?? [];
};

export const fetchWeeklyReadings = async (systemId?: string) => {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  // Current ISO week: Monday to Sunday
  const todayGmt8 = getGmt8Parts(new Date());
  // getUTCDay: 0=Sun,1=Mon..6=Sat → days since Monday: Sun=6,Mon=0,Tue=1..Sat=5
  const daysSinceMonday = todayGmt8.weekday === 0 ? 6 : todayGmt8.weekday - 1;
  const todayStart = getStartOfGmt8Day(new Date());
  const mondayStart = new Date(todayStart.getTime() - daysSinceMonday * DAY_MS);
  const sundayEnd = new Date(mondayStart.getTime() + 7 * DAY_MS);

  let query = supabase
    .from('energy_readings')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', mondayStart.toISOString())
    .lt('timestamp', sundayEnd.toISOString())
    .order('timestamp', { ascending: true });

  if (systemId) {
    query = query.eq('system_id', systemId);
  }

  const { data, error } = await query;
  if (error) {
    console.log('fetchWeeklyReadings error:', error.message);
    return [];
  }
  return data ?? [];
};

export const fetchAllTimeReadings = async (systemId?: string) => {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  let query = supabase
    .from('energy_readings')
    .select('production_kwh, consumption_kwh')
    .eq('user_id', userId);

  if (systemId) {
    query = query.eq('system_id', systemId);
  }

  const { data, error } = await query;
  if (error) {
    console.log('fetchAllTimeReadings error:', error.message);
    return [];
  }
  return data ?? [];
};

export const fetchMonthlyReadings = async (systemId?: string) => {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const todayStart = getStartOfGmt8Day(new Date());
  const monthAgo = new Date(todayStart.getTime() - 28 * DAY_MS);

  let query = supabase
    .from('energy_readings')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', monthAgo.toISOString())
    .lt('timestamp', todayStart.toISOString())
    .order('timestamp', { ascending: true });

  if (systemId) {
    query = query.eq('system_id', systemId);
  }

  const { data, error } = await query;
  if (error) {
    console.log('fetchMonthlyReadings error:', error.message);
    return [];
  }
  return data ?? [];
};

export const fetchLatestReading = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('energy_readings')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.log('fetchLatestReading error:', error.message);
    return null;
  }
  return data;
};

// ============================================================
// Support Tickets
// ============================================================
export type SupportContacts = {
  phone: string;
  email: string;
  helpdesk?: string;
  emergencyEngineer?: string;
  operatingHours?: string;
};

export const fetchSupportContacts = async (): Promise<SupportContacts | null> => {
  const { data, error } = await supabase
    .from('support_contacts')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !data) {
    if (error) {
      console.log('fetchSupportContacts error:', error.message);
    }
    return null;
  }

  return {
    phone: data.support_phone,
    email: data.support_email,
    helpdesk: data.helpdesk_url,
    emergencyEngineer: data.emergency_phone ?? data.support_phone,
    operatingHours: data.operating_hours,
  };
};

export const fetchSupportTickets = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('fetchSupportTickets error:', error.message);
    return [];
  }
  return data ?? [];
};

export const createSupportTicket = async (subject: string, description: string) => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: userId,
      subject,
      description,
      status: 'open',
      priority: 'medium',
    })
    .select()
    .single();

  if (error) {
    console.log('createSupportTicket error:', error.message);
    return null;
  }
  return data;
};

// ============================================================
// Referrals
// ============================================================
export const fetchReferrals = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('fetchReferrals error:', error.message);
    return [];
  }
  return data ?? [];
};

export const createReferral = async (refereeName: string, refereePhone: string, referralCode: string) => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('referrals')
    .insert({
      referrer_user_id: userId,
      referee_name: refereeName,
      referee_phone: refereePhone,
      referral_code: referralCode,
      status: 'pending',
      estimated_earnings: 10000,
    })
    .select()
    .single();

  if (error) {
    console.log('createReferral error:', error.message);
    return null;
  }
  return data;
};

// ============================================================
// Energy Tips
// ============================================================
export const fetchEnergyTips = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('energy_tips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('fetchEnergyTips error:', error.message);
    return [];
  }
  return data ?? [];
};

// ============================================================
// Billing Records
// ============================================================
export const fetchBillingRecords = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('billing_records')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: false });

  if (error) {
    console.log('fetchBillingRecords error:', error.message);
    return [];
  }
  return data ?? [];
};

export const fetchUpcomingPayment = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('billing_records')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq('payment_type', 'rto')
    .order('due_date', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    console.log('fetchUpcomingPayment error:', error.message);
    return null;
  }
  return data;
};

// ============================================================
// Helpers
// ============================================================
export const formatPeso = (amount: number): string => {
  return `₱${Math.abs(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (dateStr: string): string => {
  const { year, month, day } = getGmt8Parts(dateStr);
  const monthName = MONTH_SHORT[month] ?? String(month + 1);
  return `${monthName} ${day}, ${year}`;
};

export const formatTime = (dateStr: string): string => {
  const { hour, minute } = getGmt8Parts(dateStr);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  const minutePadded = String(minute).padStart(2, '0');
  return `${hour12}:${minutePadded} ${suffix}`;
};

export const getWeekdayIndexInGmt8 = (dateStr: string): number => {
  const weekday = getGmt8WeekdayShort(dateStr);
  return WEEKDAY_INDEX_BY_SHORT[weekday] ?? 0;
};

export const getDaysAgoInGmt8 = (dateStr: string): number => {
  const todayStart = getStartOfGmt8Day(new Date()).getTime();
  const dateStart = getStartOfGmt8Day(dateStr).getTime();
  return Math.floor((todayStart - dateStart) / DAY_MS);
};

export const isPastDateInGmt8 = (dateStr: string): boolean => {
  const todayStart = getStartOfGmt8Day(new Date()).getTime();
  const dateStart = getStartOfGmt8Day(dateStr).getTime();
  return dateStart < todayStart;
};
