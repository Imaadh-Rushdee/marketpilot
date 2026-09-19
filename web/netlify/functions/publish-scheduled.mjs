const publishScheduled=async () => {
  const base=(process.env.URL||process.env.NEXT_PUBLIC_APP_URL||"").replace(/\/$/,"");
  const secret=process.env.CRON_SECRET||"";
  if(!base||!secret)return new Response("Scheduler environment is incomplete.",{status:503});
  const response=await fetch(`${base}/.netlify/functions/publish-posts-background`,{method:"POST",headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(20000)});
  if(!response.ok)console.error("Scheduled publishing could not start",{status:response.status});
  return new Response(null,{status:response.ok?204:response.status});
};
export default publishScheduled;
