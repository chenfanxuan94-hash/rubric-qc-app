// lib/supabase.js
// Server-side Supabase client. Uses the service-role key so inserts work even
// with Row Level Security enabled. NEVER import this into client-side code.

import { createClient } from "@supabase/supabase-js";

let _client = null;

export function getSupabaseAdmin() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}
