import { NextResponse } from "next/server";
import { serverSupabase } from "./server";

export async function authorize(request: Request) {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    // Cookie-authenticated mutations accept same-origin browser requests only.
    if (origin && origin !== new URL(request.url).origin) {
      return { response: NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 }) };
    }
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      return { response: NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 }) };
    }
  }
  const supabase = await serverSupabase();
  if (!supabase) return { response: NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 503 }) };
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { response: NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 }) };
    const expectedUser = request.headers.get("x-marketpilot-user");
    if (expectedUser && expectedUser !== data.user.id) return { response: NextResponse.json({ error: "The signed-in account changed. Reload before making further changes." }, { status: 401 }) };
    return { supabase, user: data.user };
  } catch {
    return { response: NextResponse.json({ error: "Authentication is temporarily unavailable. Please try again." }, { status: 503 }) };
  }
}
