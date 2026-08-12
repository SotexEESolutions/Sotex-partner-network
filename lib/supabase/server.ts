import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not configured.");
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => { try { items.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* Server Component; proxy refreshes session. */ } },
    },
  });
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server-only Supabase credentials are not configured.");
  return createServerClient(url, key, { cookies: { getAll: () => [], setAll: () => undefined }, auth: { persistSession: false, autoRefreshToken: false } });
}
