import { redirect } from "next/navigation";
import { serverSupabase } from "../lib/supabase/server";
import SetupNotice from "../auth/setup-notice";
import Workspace from "../workspace";

export const dynamic = "force-dynamic";
export default async function AppPage(){const supabase=await serverSupabase();if(!supabase)return <SetupNotice/>;const {data}=await supabase.auth.getUser();if(!data.user)redirect("/login");return <Workspace key={data.user.id} userId={data.user.id} email={data.user.email || "Signed-in account"}/>;}
