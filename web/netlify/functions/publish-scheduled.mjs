const publishScheduled=async () => {
  const base=(process.env.NEXT_PUBLIC_APP_URL||process.env.URL||"").replace(/\/$/,"");
  const secret=process.env.CRON_SECRET||"";
  if(!base||!secret)return new Response("Scheduler environment is incomplete.",{status:503});
  const response=await fetch(`${base}/api/social/scheduled`,{method:"POST",headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(55000)});
  return new Response(await response.text(),{status:response.status,headers:{"content-type":"application/json"}});
};
export default publishScheduled;
