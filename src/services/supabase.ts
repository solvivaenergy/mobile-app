import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://kzsocvzhbgtfyksrjmvk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6c29jdnpoYmd0Znlrc3JqbXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDU1NDUsImV4cCI6MjA4NzgyMTU0NX0.xljKtxMq3lDpbXol8hYVPmK9NrAGaDSx1MZlJXAUydE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
