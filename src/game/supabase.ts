import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const isMultiplayerConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// The placeholder keeps offline single-player working. The multiplayer UI is hidden
// unless both values are configured, so it is never used in normal operation.
export const supabase = createClient(
  supabaseUrl || 'https://multiplayer-not-configured.invalid',
  supabaseAnonKey || 'not-configured',
  {
  realtime: {
    params: {
      eventsPerSecond: 40,
    },
  },
  }
);
