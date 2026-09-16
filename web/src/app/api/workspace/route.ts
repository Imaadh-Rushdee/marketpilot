import { NextResponse } from "next/server";
import { authorize } from "../../lib/supabase/authorize";
import { defaultProfile } from "../../lib/storage";
import { validCampaigns, validProfile } from "../../lib/validation";
import { userPlan } from "../../lib/subscription";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  const { data, error } = await auth.supabase.from("user_workspaces").select("profile,campaigns,revision").eq("user_id", auth.user.id).maybeSingle();
  if (error) {
    console.warn("Workspace read failed", { code: error.code });
    return NextResponse.json({ error: "Unable to load your cloud workspace. Check the Supabase connection and run the database migration." }, { status: 503, headers });
  }
  const onboarding = auth.user.user_metadata?.business_profile;
  if (!data) return NextResponse.json({ profile: validProfile(onboarding) ? onboarding : defaultProfile, campaigns: [], revision: 0 }, { headers });
  if (!validProfile(data.profile) || !validCampaigns(data.campaigns)) return NextResponse.json({ error: "Your saved workspace could not be read. Contact support before replacing it." }, { status: 500, headers });
  return NextResponse.json({ ...data, campaigns: data.campaigns.map(c => ({ ...c, contents: c.contents.map(x => ({ ...x, platforms: [...c.input.platforms] })) })) }, { headers });
}

export async function PUT(request: Request) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 10000000) return NextResponse.json({ error: "Workspace exceeds the 10 MB limit. Export a backup and remove old campaigns." }, { status: 413, headers });
    body = JSON.parse(raw);
  } catch { return NextResponse.json({ error: "Send a valid workspace." }, { status: 400, headers }); }
  if (!body || !validProfile(body.profile) || !validCampaigns(body.campaigns) || !Number.isInteger(body.revision) || body.revision < 0) {
    return NextResponse.json({ error: "Workspace data is invalid." }, { status: 400, headers });
  }
  try{const plan=await userPlan(auth.supabase,auth.user.id);if(body.campaigns.length>plan.campaigns)return NextResponse.json({error:`Your ${plan.name} plan supports up to ${plan.campaigns} saved campaigns. Remove an older campaign or upgrade.`},{status:403,headers});}catch{return NextResponse.json({error:"Run the subscriptions migration before saving your workspace."},{status:503,headers});}
  const { data, error } = await auth.supabase.rpc("save_marketpilot_workspace", {
    p_profile: body.profile, p_campaigns: body.campaigns, p_expected_revision: body.revision,
  });
  if (error) {
    console.warn("Workspace write failed", { code: error.code });
    return NextResponse.json({ error: "Cloud save failed. Your changes are still on screen. Export a backup and retry. Ensure the database migration has been applied." }, { status: 503, headers });
  }
  if (!data?.length) return NextResponse.json({ error: "This workspace changed in another tab or device. Export your changes, then reload the cloud version." }, { status: 409, headers });
  return NextResponse.json({ revision: data[0].new_revision }, { headers });
}
