export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) return null;
  try { if (!/^https?:$/.test(new URL(url).protocol)) return null; } catch { return null; }
  // A service-role / secret key must never be bundled into the browser.
  if (key.startsWith("sb_secret_")) return null;
  if (key.startsWith("eyJ")) {
    try { if (JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role !== "anon") return null; } catch { return null; }
  }
  return { url, key };
}
