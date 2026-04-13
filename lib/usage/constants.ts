// Matches app/api/usage/cleanup/route.ts and supabase/database.sql:270
// Clients ping every 45 s; 4 missed pings = 180 s is a safe stale threshold
export const USAGE_SESSION_TTL_SECONDS = 3 * 60 // 180 s
export const PING_INTERVAL_MS = 45_000
