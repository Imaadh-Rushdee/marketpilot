import { NextResponse } from "next/server";
import { serverSupabase } from "../../lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await serverSupabase();
  if (!supabase) return NextResponse.redirect(new URL("/login", url));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") === "/auth/update-password" || type === "recovery" ? "/auth/update-password" : "/app";
  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, url));
    } else if (tokenHash && (type === "signup" || type === "email" || type === "recovery")) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL(next, url));
    }
  } catch { /* Redirect to a helpful sign-in error without leaking tokens. */ }
  return NextResponse.redirect(new URL("/login?error=confirmation", url));
}
