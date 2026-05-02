import { createClient } from '@supabase/supabase-js'
import { cookieStorage } from './cookieStorage'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage:            cookieStorage,
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
      // Bypass Web Locks API — avoids AbortError lock contention caused by async
      // cookie storage holding the lock longer than synchronous localStorage would
      lock: async (_name, _acquireTimeout, fn) => fn(),
    },
  }
)
