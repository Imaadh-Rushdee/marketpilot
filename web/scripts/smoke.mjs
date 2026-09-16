import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://localhost:3001';
const authHeaders = process.env.TEST_COOKIE ? {Cookie: process.env.TEST_COOKIE} : {};
if (!process.env.TEST_COOKIE) throw new Error('Set TEST_COOKIE to a signed-in test session. Anonymous generation is now blocked. Use npm run test:auth for self-contained mocked checks.');
const profile = { name: 'Coastal Bakery', description: 'Fresh bread baked daily.', services: 'Bread and cakes', audience: 'Local families', market: 'Colombo', tone: 'Friendly', contact: 'https://example.com' };
const campaign = { product: 'Sourdough bread', goal: 'Drive sales', audience: 'Local families', offer: 'Visit our bakery', platforms: ['Instagram'], duration: 7, tone: 'Friendly', instructions: '' };
async function post(body) { const r = await fetch(`${base}/api/generate`, { method: 'POST', headers: {...authHeaders,'Content-Type':'application/json'}, body: JSON.stringify(body) }); return [r.status, await r.json()]; }
assert.equal((await fetch(base,{headers:authHeaders})).status, 200);
for (const duration of [1,3,5,7,10,14]) {
  const [status, data] = await post({ profile, campaign: {...campaign,duration}, startDate:'2026-12-29' });
  assert.equal(status,200); assert.equal(data.demoMode,true,'Run against a server with MARKETPILOT_DEMO_MODE=true');
  assert.equal(data.contents.length,duration);
  for (const [i,c] of data.contents.entries()) { assert.equal(c.platform,'Instagram'); assert.equal(c.day,i+1); const date=new Date('2026-12-29T12:00:00Z');date.setUTCDate(date.getUTCDate()+i);assert.equal(c.date,date.toISOString().slice(0,10));assert.ok(c.body.includes('Coastal Bakery'));assert.ok(!c.body.includes('admin work')); }
}
for (const postsPerDay of [2,5]) {
  const duration=3;
  const [status,data]=await post({profile,campaign:{...campaign,duration,postsPerDay},startDate:'2026-12-29'});
  assert.equal(status,200);assert.equal(data.contents.length,duration*postsPerDay);
  for(const [i,c] of data.contents.entries()){assert.equal(c.day,Math.floor(i/postsPerDay)+1);assert.equal(c.slot,i%postsPerDay+1);const date=new Date('2026-12-29T12:00:00Z');date.setUTCDate(date.getUTCDate()+Math.floor(i/postsPerDay));assert.equal(c.date,date.toISOString().slice(0,10));}
}
const [,original] = await post({profile,campaign,startDate:'2026-12-29'});
const [,revised] = await post({profile,campaign:{...campaign,duration:1,instructions:'Regenerate a single Instagram post'},startDate:'2026-12-29'});
assert.notEqual(original.contents[0].body,revised.contents[0].body);
for (const patch of [{platforms:[]},{platforms:['YouTube']},{platforms:['Instagram','Instagram']},{duration:15},{duration:1.5},{postsPerDay:0},{postsPerDay:6},{postsPerDay:1.5},{product:' '},{duration:'7'}]) assert.equal((await post({profile,campaign:{...campaign,...patch}}))[0],400);
assert.equal((await post(null))[0],400);
assert.equal((await post({profile,campaign,startDate:'2026-02-30'}))[0],400);
assert.equal((await fetch(`${base}/api/generate`,{method:'POST',headers:authHeaders,body:'{'})).status,400);
assert.equal((await post({profile,campaign:{...campaign,instructions:'x'.repeat(110000)}}))[0],413);
console.log('HTTP smoke checks passed: page, 1-5 posts per day, dates, platform, regeneration, validation and request limits.');
