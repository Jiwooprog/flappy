import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://eicuqmngzxouyopyyory.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_Dsx--81xRGOa5gmFiVPlLw_IZ0sJ8ur';

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 40,
    },
  },
});
