import { redirect } from "next/navigation";
import { serverSupabase } from "../../lib/supabase/server";
import PasswordForm from "./password-form";

export const dynamic = "force-dynamic";
export default async function UpdatePasswordPage() {
  const supabase = await serverSupabase();
  if (!supabase) redirect("/login");
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return <PasswordForm />;
}
