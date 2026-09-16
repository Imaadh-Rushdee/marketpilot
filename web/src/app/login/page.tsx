import { redirect } from "next/navigation";
import { serverSupabase } from "../lib/supabase/server";
import SetupNotice from "../auth/setup-notice";
import AuthForm from "./auth-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await serverSupabase();
  if (!supabase) return <SetupNotice />;
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/app");
  const params = await searchParams;
  return <AuthForm initialMessage={params.error ? "This confirmation link is invalid or expired. Request a new link or sign in." : ""} />;
}
