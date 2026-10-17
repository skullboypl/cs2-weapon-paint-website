import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
const event=()=>({version:1,kind:'round.completed',event_id:crypto.randomUUID(),round_id:crypto.randomUUID(),ended_at:Math.floor(Date.now()/1000),duration:60,winner:2,reason:9,warmup:false,has_bots:false,players:[0,1,2,3].map(i=>({steamid:`7656119800000020${i}`,team:i<2?2:3,active_seconds:20,finished:true})),deaths:[]});
function signed(body, stamp=String(Math.floor(Date.now()/1000))) {
 const key=fs.readFileSync('test-results/ingest-key.txt','utf8');
 return {'content-type':'application/json','x-cloudhub-server':'test','x-cloudhub-timestamp':stamp,'x-cloudhub-signature':crypto.createHmac('sha256',key).update(`v1\ntest\n${stamp}\n${crypto.createHash('sha256').update(body).digest('hex')}`).digest('hex')};
}
test('HMAC ingestion: replay, changed body, round conflict and validation',async({request})=>{
 const e=event(),body=JSON.stringify(e),headers=signed(body);
 const first=await request.post('/api/ingest.php',{data:body,headers});expect(first.status()).toBe(200);expect((await first.json()).status).toBe('applied');
 expect((await (await request.post('/api/ingest.php',{data:body,headers})).json()).status).toBe('duplicate');
 expect((await request.post('/api/ingest.php',{data:body+' ',headers})).status()).toBe(401);
 e.event_id=crypto.randomUUID();let next=JSON.stringify(e);expect((await request.post('/api/ingest.php',{data:next,headers:signed(next)})).status()).toBe(409);
 e.round_id=crypto.randomUUID();e.warmup=true;next=JSON.stringify(e);expect((await request.post('/api/ingest.php',{data:next,headers:signed(next)})).status()).toBe(422);
 expect((await request.post('/api/ingest.php',{data:body,headers:signed(body,String(Math.floor(Date.now()/1000)-301))})).status()).toBe(401);
});
test('Steam owner session cannot authorize ingestion; method and size enforced',async({request})=>{
 const user=JSON.parse(fs.readFileSync('test-results/sessions.json'))[0];
 expect((await request.post('/api/ingest.php',{data:JSON.stringify(event()),headers:{'content-type':'application/json',cookie:`wp_session=${user.id}`}})).status()).toBe(401);
 expect((await request.get('/api/ingest.php')).status()).toBe(405);
 expect((await request.post('/api/ingest.php',{data:'x'.repeat(65537),headers:{'content-type':'application/json'}})).status()).toBe(413);
});
