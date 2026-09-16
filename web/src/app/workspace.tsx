"use client";

import { cloneElement, isValidElement, useEffect, useId, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Logo from "./assets/logo.png";
import { CalendarDays, Check, ChevronRight, Clipboard, FileText, Home, Loader2, Megaphone, Pencil, Plus, RefreshCw, Settings, Sparkles, Trash2, UserRound, Link2 } from "lucide-react";
import GraphicsStudio, { BrandAssets } from "./graphics-studio";
import SocialConnections from "./social-connections";
import ThemeToggle from "./theme-toggle";
import { PLATFORMS, destinations, Campaign, CampaignInput, ContentItem, ContentStatus, Platform, Strategy } from "./types/marketpilot";
import { validCampaigns, validContent, validProfile, validStrategy } from "./lib/validation";
import { loadCampaigns, loadProfile } from "./lib/storage";
import { useWorkspace } from "./lib/use-workspace";
import { browserSupabase } from "./lib/supabase/client";

type View = "dashboard" | "create" | "studio" | "calendar" | "profile" | "graphics" | "connections";

const emptyInput: CampaignInput = {
  product: "",
  goal: "Build awareness",
  audience: "",
  offer: "",
  platforms: ["Facebook", "Instagram", "TikTok"],
  duration: 7,
  postsPerDay: 2,
  tone: "",
  instructions: "",
};



function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function platformClass(platform: Platform) {
  return platform.toLowerCase();
}

export default function Workspace({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>("dashboard");
  const { profile, setProfile, campaigns, setCampaigns, ready, loadError, saveError, saveState, pending, flush } = useWorkspace(userId);
  const [input, setInput] = useState<CampaignInput>(emptyInput);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [selectedContentId, setSelectedContentId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [planInfo,setPlanInfo]=useState<{name:string;postsPerWeek:number}|null>(null);

  useEffect(() => {
    const { data } = browserSupabase().auth.onAuthStateChange((_event, session) => {
      if (!session || session.user.id !== userId) { router.replace("/login"); router.refresh(); }
    });
    return () => data.subscription.unsubscribe();
  }, [userId, router]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has("social_connected") || query.has("social_error")) queueMicrotask(() => setView("connections"));
  }, []);
  useEffect(()=>{const controller=new AbortController();fetch("/api/subscription",{headers:{"x-marketpilot-user":userId},signal:controller.signal}).then(r=>r.ok?r.json():null).then(d=>{if(d?.plan)setPlanInfo(d.plan)}).catch(()=>{});return()=>controller.abort();},[userId]);

  async function signOut() {
    if (!(await flush())) { setMessage("Your changes have not synced. Export a backup and resolve the save error before signing out."); return; }
    const { error } = await browserSupabase().auth.signOut();
    if (error) setMessage(error.message);
    else { router.replace("/login"); router.refresh(); }
  }

  const activeCampaign = campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0];
  const activeContent = activeCampaign?.contents.find((c) => c.id === selectedContentId) || activeCampaign?.contents[0];
  const allContent = useMemo(() => campaigns.flatMap((c) => c.contents.map((x) => ({ ...x, campaign: c.input.product }))), [campaigns]);
  const approved = allContent.filter((c) => c.status === "Approved").length;
  const posted = allContent.filter((c) => c.status === "Posted").length;

  async function generateCampaign() {
    if (!input.product.trim()) {
      setMessage("Add the product or service you want to promote first.");
      return;
    }
    if (!input.platforms.length) { setMessage("Select at least one platform."); return; }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-marketpilot-user": userId },
        body: JSON.stringify({ profile, campaign: input, startDate: localDate() }),
        signal: AbortSignal.timeout(65000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed");
      if (!validStrategy(data.strategy) || !Array.isArray(data.contents) || data.contents.length !== input.duration * (input.postsPerDay ?? 1) || !data.contents.every(validContent)) throw new Error("Generation returned invalid content. Please try again.");
      const campaignId = uid();
      const campaign: Campaign = {
        id: campaignId,
        createdAt: new Date().toISOString(),
        input: { ...input },
        strategy: data.strategy as Strategy,
        contents: (data.contents || []).map((item: Omit<ContentItem, "id" | "campaignId" | "status">) => ({
          ...item,
          id: uid(),
          campaignId,
          status: "Draft" as ContentStatus,
        })),
      };
      setCampaigns((current) => [campaign, ...current]);
      setSelectedCampaignId(campaign.id);
      setSelectedContentId(campaign.contents[0]?.id || "");
      setView("studio");
      setMessage(data.demoMode ? "Demo campaign created. Review the copy before publishing." : "Campaign generated successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function updateContent(contentId: string, patch: Partial<ContentItem>) {
    setCampaigns((current) => current.map((campaign) => ({
      ...campaign,
      contents: campaign.contents.map((content) => content.id === contentId ? { ...content, ...patch, status: patch.status || "Draft" } : content),
    })));
  }

  function deleteContent(contentId: string) {
    if (!confirm("Delete this content item?")) return;
    setCampaigns((current) => current.map((campaign) => ({ ...campaign, contents: campaign.contents.filter((x) => x.id !== contentId) })));
    setSelectedContentId("");
  }

  function deleteCampaign(id: string) {
    if (!confirm("Delete this campaign and all of its content?")) return;
    setCampaigns((current) => current.filter((c) => c.id !== id));
    if (selectedCampaignId === id) setSelectedCampaignId("");
  }

  async function regenerateContent(content: ContentItem) {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-marketpilot-user": userId },
        body: JSON.stringify({ profile, startDate: content.date, campaign: { ...activeCampaign?.input, platforms: destinations(content), duration: 1, postsPerDay: 1, instructions: `Regenerate a shared ${destinations(content).join(", ")} ${content.type} for day ${content.day}. Make it meaningfully different from this old version: ${content.body}` } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regeneration failed");
      const replacement = data.contents?.[0];
      if (!validContent(replacement)) throw new Error("No valid replacement was returned.");
      updateContent(content.id, { ...replacement, day: content.day, date: content.date, platform: content.platform, platforms: destinations(content), type: content.type, status: "Draft" });
      setMessage("Content regenerated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Regeneration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveBusinessProfile() {
    if (await flush()) setMessage("Business profile saved to your cloud workspace.");
    else setMessage("Cloud save failed. Your changes are still on screen; export a backup and retry.");
  }

  function importLegacyWorkspace() {
    if (!confirm("Import the previous browser workspace into your signed-in account? This replaces the current profile and campaigns.")) return;
    setProfile(loadProfile()); setCampaigns(loadCampaigns()); setSelectedCampaignId(""); setSelectedContentId("");
    setMessage("Browser workspace imported. Waiting for cloud save.");
  }

  function exportBackup() {
    download("marketpilot-backup.json", JSON.stringify({ version: 1, profile, campaigns }, null, 2), "application/json");
    setMessage("Workspace backup exported.");
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10000000) throw new Error("Backup must be smaller than 10 MB.");
      const data = JSON.parse(await file.text());
      if (data.version !== 1 || !validProfile(data.profile) || !validCampaigns(data.campaigns)) throw new Error("This is not a valid MarketPilot backup.");
      if (!confirm("Replace this workspace with the imported backup?")) return;
      setProfile(data.profile); setCampaigns(data.campaigns);
      setSelectedCampaignId(data.campaigns[0]?.id || ""); setSelectedContentId("");
      setMessage("Backup restored. Waiting for cloud save.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); }
  }
  const nav = [
    ["dashboard", "Dashboard", Home],
    ["create", "Create campaign", Sparkles],
    ["studio", "Content studio", FileText],
    ["calendar", "Calendar", CalendarDays],
    ["profile", "Business profile", Settings],
    ["graphics", "Graphics studio", Sparkles],
    ["connections", "Social accounts", Link2],
  ] as const;

  if (!ready) return <main className="auth-shell"><section className="card auth-card"><h1>{loadError ? "Unable to open workspace" : "Loading your workspace..."}</h1><p className="muted" role="status">{loadError || "Connecting to your private cloud workspace."}</p>{loadError && <><button className="primary" onClick={() => window.location.reload()}>Retry connection</button><button className="text-btn" onClick={() => { void browserSupabase().auth.signOut().then(() => { router.replace("/login"); router.refresh(); }); }}>Sign out</button></>}</section></main>;

  return (
    <main className="app-shell" aria-busy={!ready || loading}>
      <aside className="sidebar">
        <div className="brand"><Image src={Logo} alt="MarketPilot" priority /></div>
        <nav aria-label="Main navigation">
          {nav.map(([id, label, Icon]) => (
            <button key={id} className={view === id ? "nav-btn active" : "nav-btn"} title={label} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}>
              <Icon size={18} /> <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar"><UserRound size={18} /></div>
          <div><strong>{profile.name || "MarketPilot"}</strong><small title={email}>{email}</small></div>
        </div>
        {planInfo&&<a className="plan-badge" href="/pricing"><strong>{planInfo.name}</strong><span>View plan</span></a>}
        <ThemeToggle/><button className="nav-btn" title="Sign out" onClick={signOut}><UserRound size={18}/><span>Sign out</span></button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">MARKETING COMMAND CENTER</p><h1>{titleFor(view)}</h1></div>
          <button className="primary compact" onClick={() => setView("create")}><Plus size={17} /> New campaign</button>
        </header>

        {(pending || saveState === "saving" || saveState === "error" || saveState === "conflict") && <div className="sync-bar" role="status"><span>{saveState === "error" || saveState === "conflict" ? "Changes not saved" : "Saving..."}</span>{(saveState === "error" || saveState === "conflict") && <><button className="text-btn" onClick={exportBackup}>Export</button>{saveState === "error" ? <button className="text-btn" onClick={() => { void flush(); }}>Retry</button> : <button className="text-btn" onClick={() => window.location.reload()}>Reload</button>}</>}</div>}
        {saveError && <div className="notice" role="alert">{saveError}</div>}
        {message && <div className="notice" role="status">{message}<button aria-label="Dismiss message" onClick={() => setMessage("")}>×</button></div>}

        {view === "dashboard" && (
          <div className="page-grid">
            <section className="hero-panel card">
              <div>
                <span className="pill">MarketPilot V2</span>
                <h2>Turn one offer into a week of marketing.</h2>
                <p>Create practical campaigns for Facebook, Instagram and TikTok without spending your day writing captions.</p>
              </div>
              <button className="primary" onClick={() => setView("create")}>Create campaign <ChevronRight size={18}/></button>
            </section>

            <section className="stats-grid">
              <Stat label="Campaigns" value={campaigns.length} helper="Saved in your account" />
              <Stat label="Content pieces" value={allContent.length} helper="Across all campaigns" />
              <Stat label="Approved" value={approved} helper="Ready to publish" />
              <Stat label="Posted" value={posted} helper="Marked complete" />
            </section>

            <section className="card section-card">
              <div className="section-head"><div><p className="eyebrow">RECENT</p><h3>Campaigns</h3></div><button className="text-btn" onClick={() => setView("create")}>Create new</button></div>
              {campaigns.length === 0 ? <Empty text="No campaigns yet. Create your first 7-day campaign." /> : (
                <div className="campaign-list">{campaigns.map((campaign) => (
                  <div className="campaign-row" key={campaign.id}>
                    <div className="campaign-icon"><Megaphone size={18}/></div>
                    <div className="grow"><strong>{campaign.input.product}</strong><small>{campaign.input.goal} · {campaign.contents.length} pieces</small></div>
                    <div className="platform-stack">{campaign.input.platforms.map((p) => <span key={p} className={`platform-dot ${platformClass(p)}`} title={p}>{p[0]}</span>)}</div>
                    <button className="icon-btn" aria-label="Open campaign" onClick={() => {setSelectedCampaignId(campaign.id); setView("studio")}}><ChevronRight size={18}/></button>
                    <button className="icon-btn danger" aria-label="Delete campaign" onClick={() => deleteCampaign(campaign.id)}><Trash2 size={16}/></button>
                  </div>
                ))}</div>
              )}
            </section>
          </div>
        )}

        {view === "create" && (
          <section className="create-layout">
            <div className="card form-card">
              <div className="section-head"><div><p className="eyebrow">NEW CAMPAIGN</p><h2>Tell MarketPilot what you&apos;re selling.</h2></div></div>
              <Field label="Product or service"><input value={input.product} onChange={(e) => setInput({...input, product:e.target.value})} placeholder="e.g. Gym management system" /></Field>
              <div className="two-col">
                <Field label="Goal"><select value={input.goal} onChange={(e) => setInput({...input, goal:e.target.value})}><option>Get demo bookings</option><option>Generate leads</option><option>Build awareness</option><option>Drive sales</option><option>Promote an offer</option></select></Field>
                <Field label="Campaign length"><select value={input.duration} onChange={(e) => setInput({...input, duration:Number(e.target.value)})}><option value={3}>3 days</option><option value={5}>5 days</option><option value={7}>7 days</option><option value={10}>10 days</option><option value={14}>14 days</option></select></Field>
              </div>
              <Field label="Posts per day"><select value={input.postsPerDay ?? 1} onChange={(e) => setInput({...input, postsPerDay:Number(e.target.value)})}><option value={1}>1 post per day</option><option value={2}>2 posts per day</option><option value={3}>3 posts per day</option><option value={4}>4 posts per day</option><option value={5}>5 posts per day</option></select></Field>
              <Field label="Target audience"><input placeholder={profile.audience || "Who should this campaign reach?"} value={input.audience} onChange={(e) => setInput({...input, audience:e.target.value})} /></Field>
              <Field label="Offer / CTA"><input value={input.offer} onChange={(e) => setInput({...input, offer:e.target.value})} /></Field>
              <fieldset className="field platform-field"><legend>Post destinations</legend><div className="chips">{PLATFORMS.map((p) => <button type="button" key={p} aria-pressed={input.platforms.includes(p)} className={input.platforms.includes(p)?"chip selected":"chip"} onClick={() => setInput({...input, platforms: input.platforms.includes(p)?input.platforms.filter(x=>x!==p):[...input.platforms,p]})}>{p}</button>)}</div></fieldset>
              <Field label="Tone"><input placeholder={profile.tone || "Use the business profile tone"} value={input.tone} onChange={(e) => setInput({...input, tone:e.target.value})} /></Field>
              <Field label="Extra instructions"><textarea value={input.instructions} onChange={(e) => setInput({...input, instructions:e.target.value})} placeholder="Anything the AI should know..." /></Field>
              <button className="primary wide" onClick={generateCampaign} disabled={loading || !ready}>{loading?<><Loader2 className="spin" size={18}/>Building campaign...</>:<><Sparkles size={18}/>Generate campaign</>}</button>
            </div>

            <aside className="card preview-card">
              <p className="eyebrow">CAMPAIGN BRIEF</p>
              <h3>{input.product || "Your product"}</h3>
              <PreviewLine label="Goal" value={input.goal}/><PreviewLine label="Audience" value={input.audience}/><PreviewLine label="Offer" value={input.offer}/><PreviewLine label="Length" value={`${input.duration} days`}/><PreviewLine label="Frequency" value={`${input.postsPerDay ?? 1} posts per day · ${input.duration * (input.postsPerDay ?? 1)} total`}/>
              <div className="mini-divider" />
              <p className="muted">Every post is shared across all selected destinations. MarketPilot gives each one its own hook, caption, CTA and hashtags.</p>
            </aside>
          </section>
        )}

        {view === "studio" && (
          campaigns.length === 0 ? <EmptyAction text="Create a campaign first to open the Content Studio." action={() => setView("create")}/> : (
            <section className="studio-layout">
              <aside className="card content-list">
                <select aria-label="Campaign" className="campaign-select" value={activeCampaign?.id} onChange={(e) => {setSelectedCampaignId(e.target.value); setSelectedContentId("")}}>{campaigns.map(c => <option key={c.id} value={c.id}>{c.input.product}</option>)}</select>
                <div className="strategy-mini"><span>Strategy</span><strong>{activeCampaign?.strategy.angle}</strong><small>{activeCampaign?.strategy.coreMessage}</small></div>
                <div className="content-scroll">{activeCampaign?.contents.map((content) => <button key={content.id} className={activeContent?.id===content.id?"content-item active":"content-item"} onClick={()=>setSelectedContentId(content.id)}><span className={`platform-bar ${platformClass(content.platform)}`}></span><div><strong>Day {content.day} · Post {content.slot ?? 1} · {destinations(content).join(" / ")}</strong><small>{content.hook}</small></div><span className={`status ${content.status.toLowerCase()}`}>{content.status}</span></button>)}</div>
              </aside>
              {!activeContent && <div className="card empty big"><h3>This campaign has no content left.</h3><button className="primary" onClick={() => { setInput(activeCampaign.input); setView("create"); }}>Create another campaign</button></div>}
              {activeContent && <ContentEditor content={activeContent} userId={userId} updateContent={updateContent} regenerateContent={regenerateContent} deleteContent={deleteContent} notify={setMessage} onGraphics={()=>setView("graphics")} loading={loading}/>} 
            </section>
          )
        )}

        {view === "calendar" && (
          allContent.length === 0 ? <EmptyAction text="Your calendar will appear after you generate a campaign." action={() => setView("create")}/> : <CalendarView contents={allContent} onOpen={(item) => {setSelectedCampaignId(item.campaignId); setSelectedContentId(item.id); setView("studio")}} />
        )}

        {view === "connections" && <SocialConnections userId={userId}/>}

        {view === "graphics" && <GraphicsStudio profile={profile} userId={userId} seed={activeContent ? `${activeContent.hook}. ${activeContent.body}` : ""} onUse={activeContent?(path)=>{updateContent(activeContent.id,{graphicPath:path});setMessage("Graphic attached to the selected post. Review and approve it in Content Studio.");setView("studio");}:undefined}/> }

        {view === "profile" && (
          <section className="card form-card profile-card">
            <div className="section-head"><div><p className="eyebrow">BUSINESS PROFILE</p><h2>Teach MarketPilot about your business.</h2></div></div>
            <div className="two-col"><Field label="Business name"><input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></Field><Field label="Market / location"><input value={profile.market} onChange={e=>setProfile({...profile,market:e.target.value})}/></Field></div>
            <Field label="What does the business do?"><textarea value={profile.description} onChange={e=>setProfile({...profile,description:e.target.value})}/></Field>
            <Field label="Business type"><input value={profile.businessType || ""} onChange={e=>setProfile({...profile,businessType:e.target.value})} placeholder="e.g. School, bakery, software company"/></Field>
            <Field label="Expected outcome from MarketPilot"><textarea value={profile.expectedOutcome || ""} onChange={e=>setProfile({...profile,expectedOutcome:e.target.value})}/></Field>
            <Field label="Business keywords"><input value={profile.keywords || ""} onChange={e=>setProfile({...profile,keywords:e.target.value})}/></Field>
            <Field label="Brand color"><input type="color" value={profile.brandColor || "#5299f5"} onChange={e=>setProfile({...profile,brandColor:e.target.value})}/></Field>
            <BrandAssets profile={profile} setProfile={setProfile} userId={userId}/>
            <Field label="Products / services"><input value={profile.services} onChange={e=>setProfile({...profile,services:e.target.value})}/></Field>
            <Field label="Target customers"><input value={profile.audience} onChange={e=>setProfile({...profile,audience:e.target.value})}/></Field>
            <Field label="Brand tone"><input value={profile.tone} onChange={e=>setProfile({...profile,tone:e.target.value})}/></Field>
            <Field label="Website / contact link"><input value={profile.contact} onChange={e=>setProfile({...profile,contact:e.target.value})} placeholder="https://... or WhatsApp link"/></Field>
            <div className="two-col"><Field label="Phone number"><input type="tel" value={profile.phone || ""} onChange={e=>setProfile({...profile,phone:e.target.value})}/></Field><Field label="WhatsApp number"><input type="tel" value={profile.whatsapp || ""} onChange={e=>setProfile({...profile,whatsapp:e.target.value})}/></Field></div>
            <div className="two-col"><Field label="Business email"><input type="email" value={profile.email || ""} onChange={e=>setProfile({...profile,email:e.target.value})}/></Field><Field label="Address"><input value={profile.address || ""} onChange={e=>setProfile({...profile,address:e.target.value})}/></Field></div>
            <Field label="Social media names"><input value={profile.socialHandles || ""} onChange={e=>setProfile({...profile,socialHandles:e.target.value})} placeholder="@business on Instagram, Facebook, TikTok..."/></Field>
            <div className="section-head"><h3>Other business details</h3><button className="chip" type="button" onClick={()=>setProfile({...profile,contactDetails:[...(profile.contactDetails || []),{label:"",value:""}]})}><Plus size={15}/>Add detail</button></div>
            {(profile.contactDetails || []).map((detail,index)=><div className="custom-detail" key={index}><input aria-label={`Detail ${index+1} name`} placeholder="Label" value={detail.label} onChange={e=>setProfile({...profile,contactDetails:(profile.contactDetails || []).map((x,i)=>i===index?{...x,label:e.target.value}:x)})}/><input aria-label={`Detail ${index+1} value`} placeholder="Value" value={detail.value} onChange={e=>setProfile({...profile,contactDetails:(profile.contactDetails || []).map((x,i)=>i===index?{...x,value:e.target.value}:x)})}/><button className="icon-btn danger" type="button" title="Remove detail" onClick={()=>setProfile({...profile,contactDetails:(profile.contactDetails || []).filter((_,i)=>i!==index)})}><Trash2 size={16}/></button></div>)}
            <button className="primary" onClick={saveBusinessProfile}><Check size={17}/> Save profile</button>
            <div className="mini-divider"/><h3>Workspace backup</h3><p className="muted">Your profile and campaigns sync to your account. Export a backup to keep an additional copy.</p>
            <div className="chips"><button className="chip" onClick={exportBackup}>Export backup</button><button className="chip" onClick={importLegacyWorkspace}>Import previous browser data</button><label className="chip">Restore backup<input type="file" accept="application/json,.json" onChange={e => { void importBackup(e.target.files?.[0]); e.target.value = ""; }}/></label></div>
          </section>
        )}
      </section>
    </main>
  );
}

function titleFor(view: View) { return ({dashboard:"Dashboard",create:"Create campaign",studio:"Content studio",calendar:"Content calendar",profile:"Business profile",graphics:"Graphics studio",connections:"Social accounts"} as Record<View,string>)[view]; }
function Stat({label,value,helper}:{label:string;value:number;helper:string}) { return <div className="card stat"><small>{label}</small><strong>{value}</strong><span>{helper}</span></div>; }
function Field({label,children}:{label:string;children:React.ReactNode}) {
  const id = useId();
  const fieldId = isValidElement<{id?:string}>(children) ? children.props.id || id : id;
  return <div className="field"><label htmlFor={fieldId}>{label}</label>{isValidElement<{id?:string}>(children) ? cloneElement(children,{id:fieldId}) : children}</div>;
}
function PreviewLine({label,value}:{label:string;value:string}) { return <div className="preview-line"><span>{label}</span><strong>{value || "—"}</strong></div>; }
function Empty({text}:{text:string}) { return <div className="empty"><Sparkles size={22}/><p>{text}</p></div>; }
function EmptyAction({text,action}:{text:string;action:()=>void}) { return <div className="card empty big"><Sparkles size={30}/><h3>{text}</h3><button className="primary" onClick={action}>Create campaign</button></div>; }

function ContentEditor({content,userId,updateContent,regenerateContent,deleteContent,notify,onGraphics,loading}:{content:ContentItem;userId:string;updateContent:(id:string,p:Partial<ContentItem>)=>void;regenerateContent:(c:ContentItem)=>void;deleteContent:(id:string)=>void;notify:(message:string)=>void;onGraphics:()=>void;loading:boolean}) {
  const [publishing,setPublishing]=useState(false);
  async function publish(){if(!confirm(`Publish this post to ${destinations(content).join(", ")}?`))return;setPublishing(true);try{const response=await fetch("/api/social/publish",{method:"POST",headers:{"Content-Type":"application/json","x-marketpilot-user":userId},body:JSON.stringify({content}),signal:AbortSignal.timeout(65000)});const data=await response.json();if(!response.ok)throw new Error(data.error||"Publishing failed.");updateContent(content.id,{status:"Posted"});notify(`Published to ${data.results.map((x:{platform:string})=>x.platform).join(" and ")}.`);}catch(error){notify(error instanceof Error?error.message:"Publishing failed.");}finally{setPublishing(false);}}
  return <section className="card editor">
    <div className="editor-head"><div><div className="chips">{destinations(content).map(p=><span key={p} className={`platform-badge ${platformClass(p)}`}>{p}</span>)}</div><h2>Day {content.day} · {content.type}</h2><small>{content.date}</small></div><div className="editor-actions"><button className="icon-btn" title="Copy" onClick={async()=>{try { await navigator.clipboard.writeText(contentText(content)); notify("Content copied."); } catch { notify("Clipboard is unavailable. Use Download to save the copy."); }}}><Clipboard size={17}/></button><button className="icon-btn" title="Download content" onClick={()=>download(`post-${content.day}.txt`,contentText(content),"text/plain")}><FileText size={17}/></button><button className="icon-btn" title="Regenerate" onClick={()=>regenerateContent(content)} disabled={loading}>{loading?<Loader2 className="spin" size={17}/>:<RefreshCw size={17}/>}</button><button className="icon-btn danger" title="Delete" onClick={()=>deleteContent(content.id)}><Trash2 size={17}/></button></div></div>
    {content.graphicPath&&<div className="post-creative"><Image src={`/api/media?path=${encodeURIComponent(content.graphicPath)}`} alt={`Creative for ${content.hook}`} width={1080} height={1080} unoptimized/><div className="chips"><a className="chip" href={`/api/media?path=${encodeURIComponent(content.graphicPath)}&download=1`}>Download attached graphic</a><button className="text-btn" onClick={()=>updateContent(content.id,{graphicPath:undefined})}>Remove from post</button></div></div>}<button className="chip" onClick={onGraphics}><Sparkles size={16}/>{content.graphicPath?"Change post graphic":"Create graphic for this post"}</button>
    <Field label="Hook"><input value={content.hook} onChange={e=>updateContent(content.id,{hook:e.target.value})}/></Field>
    <Field label="Post copy"><textarea className="big-textarea" value={content.body} onChange={e=>updateContent(content.id,{body:e.target.value})}/></Field>
    <Field label="CTA"><input value={content.cta} onChange={e=>updateContent(content.id,{cta:e.target.value})}/></Field>
    <Field label="Hashtags"><input value={content.hashtags.join(" ")} onChange={e=>updateContent(content.id,{hashtags:e.target.value.split(/\s+/).filter(Boolean)})}/></Field>
    <div className="two-col"><Field label="Publish date"><input type="date" value={content.date} onChange={e=>{if(e.target.value) updateContent(content.id,{date:e.target.value});}}/></Field><Field label="Publish time"><input type="time" value={content.publishTime||["09:00","12:00","15:00","18:00","21:00"][(content.slot||1)-1]} onChange={e=>{if(e.target.value) updateContent(content.id,{publishTime:e.target.value});}}/></Field></div><div className="approval-actions"><span className={`status ${content.status.toLowerCase()}`}>{content.status}</span><button className="primary" disabled={content.status !== "Draft"} onClick={()=>updateContent(content.id,{status:"Approved"})}><Check size={17}/>Approve post</button>{content.status === "Approved" && <button className="primary" disabled={publishing} onClick={()=>void publish()}>{publishing?<Loader2 className="spin" size={17}/>:<Megaphone size={17}/>} {publishing?"Publishing...":"Publish now"}</button>}{content.status !== "Draft" && <button className="text-btn" onClick={()=>updateContent(content.id,{status:"Draft"})}>Return to draft</button>}</div>
    <div className="editor-save"><span><Pencil size={15}/> Changes sync automatically</span></div>
  </section>;
}

function CalendarView({contents,onOpen}:{contents:(ContentItem&{campaign:string})[];onOpen:(c:ContentItem)=>void}) {
  const sorted=[...contents].sort((a,b)=>a.date.localeCompare(b.date));
  const groups=sorted.reduce<Record<string,typeof sorted>>((acc,item)=>{(acc[item.date] ||= []).push(item);return acc;},{});
  return <section className="calendar-grid">{Object.entries(groups).map(([date,items])=><div className="card calendar-day" key={date}><div className="calendar-date"><strong>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined,{weekday:"short"})}</strong><span>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</span></div><div className="calendar-items">{items.map(item=><button key={item.id} onClick={()=>onOpen(item)} className="calendar-item"><span className={`platform-bar ${platformClass(item.platform)}`}></span><div><small>{destinations(item).join(" / ")} · {item.type}</small><strong>{item.hook}</strong><span>{item.campaign}</span></div></button>)}</div></div>)}</section>;
}

function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function contentText(c: ContentItem) { return `${c.hook}\n\n${c.body}\n\n${c.cta}\n${c.hashtags.join(" ")}`; }
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
