using CloudHub.Core;
using System.Net;
using System.Text.Json;
int checks=0;
void Check(bool condition,string name){if(!condition)throw new Exception(name);checks++;Console.WriteLine("PASS "+name);}
async Task Until(Func<bool> ready){var end=DateTime.UtcNow.AddSeconds(8);while(!ready() && DateTime.UtcNow<end)await Task.Delay(20);Check(ready(),"async operation completes");}
var roster=Enumerable.Range(0,4).Select(i=>new PlayerSnapshot($"7656119800000030{i}",i<2?2:3,true,0,0,0,0,0)).ToArray();
var tracker=new RoundTracker();
RoundEvent Round(){tracker.Start(0,roster,false);for(int t=1;t<=60;t++)tracker.Sample(t,roster.Select(p=>p with{X=t*10}).ToArray(),false);return tracker.Finish(60,1700000000,2,9)!;}
var e=Round();Check(e.Players.All(p=>p.ActiveSeconds==60),"movement activity");Check(e.EventId==e.RoundId,"stable round identity");Check(tracker.Finish(60,1700000000,2,9) is null,"duplicate round end ignored");
tracker.Start(0,roster,true);Check(tracker.Finish(60,1700000000,2,9) is null,"warmup/bot rounds ignored");
tracker.Start(0,roster,false);tracker.Sample(1,roster,true);Check(tracker.Finish(60,1700000000,2,9) is null,"bot or warmup transition invalidates");
tracker.Start(0,roster,false);tracker.Sample(6,roster,false);Check(tracker.Finish(60,1700000000,2,9) is null,"sampling gap invalidates");
tracker.Start(0,roster,false);tracker.Sample(1,roster.Select((p,i)=>i==0?p with{Team=3}:p).ToArray(),false);Check(tracker.Finish(60,1700000000,2,9) is null,"team change invalidates");
tracker.Start(0,roster,false);tracker.Sample(1,roster.Append(roster[0] with{Steamid="76561198000000999"}).ToArray(),false);Check(tracker.Finish(60,1700000000,2,9) is null,"late join invalidates");
tracker.Start(0,roster,false);tracker.Died(roster[0].Steamid,roster[2].Steamid,roster[1].Steamid,true);tracker.Died(roster[0].Steamid,roster[2].Steamid,roster[1].Steamid,true);var combat=tracker.Finish(60,1700000000,2,9)!;Check(combat.Deaths.Length==1 && combat.Deaths[0].Headshot && combat.Deaths[0].Assister==roster[1].Steamid,"deduplicated kill/headshot/assist");
tracker.Start(0,roster,false);tracker.Died(null,roster[2].Steamid,null,false);Check(tracker.Finish(60,1700000000,2,9)!.Deaths[0].Killer is null,"world death");
tracker.Start(0,roster,false);tracker.Died(roster[0].Steamid,roster[2].Steamid,null,false);tracker.Spawned(roster[2].Steamid);Check(tracker.Finish(60,1700000000,2,9) is null,"respawn mode invalidates");
tracker.Start(0,roster,false);tracker.Disconnected(roster[0].Steamid);tracker.Sample(1,roster,false);Check(!tracker.Finish(60,1700000000,2,9)!.Players[0].Finished,"reconnect cannot restore participation");
tracker.Start(0,roster,false);for(int t=1;t<=60;t++)tracker.Sample(t,roster,false);Check(tracker.Finish(60,1700000000,2,9)!.Players.All(p=>p.ActiveSeconds==0),"AFK no activity");
tracker.Start(0,roster,false);for(int shot=0;shot<100;shot++)tracker.Fired(roster[0].Steamid);tracker.Sample(1,roster,false);tracker.Sample(2,roster,false);Check(tracker.Finish(60,1700000000,2,9)!.Players[0].ActiveSeconds==1,"fire activity bounded by elapsed time");
foreach(var reason in new[]{0,10,16,17,18,19,20})Check(!Protocol.ValidOutcome(2,reason),"no inferred outcome "+reason);
Check(Protocol.ValidOutcome(3,11) && Protocol.ValidOutcome(2,13),"hostage outcome mapping CSS376");
tracker.Start(0,roster,false);tracker.Cancel();Check(tracker.Finish(60,1700000000,2,9) is null,"map/restart cancels");
var vector=JsonDocument.Parse(File.ReadAllText(args.Length>0?args[0]:"tests/protocol-vector.json")).RootElement;
string V(string name)=>vector.GetProperty(name).GetString()!;
Check(EventSigner.Sign(V("key"),V("server"),V("timestamp"),V("body"))==V("signature"),"shared UTF-8 HMAC vector");
Check(EventSigner.Sign(V("key"),V("server"),V("timestamp"),V("body")+" ")!=V("signature"),"body integrity");
var directory=Path.Combine(Path.GetTempPath(),"cloudhub-outbox-"+Guid.NewGuid());
var endpoint=new Uri("https://ingest.invalid/api/ingest.php");var key=V("key");
try {
    bool rejected=false;try{await using var bad=new DurableOutbox(directory,new Uri("http://ingest.invalid"),"test",key,_=>{});}catch(ArgumentException){rejected=true;}Check(rejected,"insecure HTTP configuration rejected");
    var unavailable=new FakeHandler(_=>new(HttpStatusCode.ServiceUnavailable));
    await using(var box=new DurableOutbox(directory,endpoint,"test",key,_=>{},unavailable,TimeSpan.FromMilliseconds(20))){Check(!box.TryEnqueue(e with {EventId="../escape"}),"outbox rejects unsafe identity");Check(box.TryEnqueue(e),"bounded admission");await Until(()=>Directory.GetFiles(directory,"*.json").Length==1);await Until(()=>unavailable.Calls>0);Check(File.ReadAllText(Directory.GetFiles(directory,"*.json")[0])==Protocol.Encode(e),"exact payload persisted during outage");}
    var ack=new FakeHandler(r=>{
        var body=r.Content!.ReadAsStringAsync().GetAwaiter().GetResult();var stamp=r.Headers.GetValues("X-CloudHub-Timestamp").Single();
        if(r.Headers.GetValues("X-CloudHub-Signature").Single()!=EventSigner.Sign(key,"test",stamp,body))throw new Exception("bad signature");
        return new(HttpStatusCode.OK){Content=new StringContent("{\"status\":\"duplicate\"}")};
    });
    await using(var restarted=new DurableOutbox(directory,endpoint,"test",key,_=>{},ack,TimeSpan.FromMilliseconds(20))){await Until(()=>ack.Calls>0 && Directory.GetFiles(directory,"*.json").Length==0);Check(ack.Calls>=1,"restart resends and duplicate ack removes record");}
    var e2=Round();File.WriteAllText(Path.Combine(directory,e2.EventId+".json.tmp"),Protocol.Encode(e2));
    var conflict=new FakeHandler(_=>new(HttpStatusCode.Conflict));
    await using(var box=new DurableOutbox(directory,endpoint,"test",key,_=>{},conflict,TimeSpan.FromMilliseconds(20))){await Until(()=>Directory.GetFiles(directory,"*.rejected").Length==1);Check(Directory.GetFiles(directory,"*.json").Length==0,"interrupted write recovered then conflict quarantined");}
    var e3=Round();var badAck=new FakeHandler(_=>new(HttpStatusCode.OK){Content=new StringContent("{\"status\":\"unknown\"}")});
    await using(var box=new DurableOutbox(directory,endpoint,"test",key,_=>{},badAck,TimeSpan.FromMilliseconds(20))){box.TryEnqueue(e3);await Until(()=>badAck.Calls>=2);Check(Directory.GetFiles(directory,"*.json").Length==1,"invalid ack does not delete record");}
    var oversize=new FakeHandler(_=>new(HttpStatusCode.OK){Content=new StringContent(new string('x',5000))});
    await using(var box=new DurableOutbox(directory,endpoint,"test",key,_=>{},oversize,TimeSpan.FromMilliseconds(20))){await Until(()=>oversize.Calls>=2);Check(Directory.GetFiles(directory,"*.json").Length==1,"oversized ack does not delete record");}
} finally {Directory.Delete(directory,true);}
Console.WriteLine($"CloudHub C# assertions passed: {checks}");
sealed class FakeHandler(Func<HttpRequestMessage,HttpResponseMessage> reply):HttpMessageHandler {
    private int calls;
    public int Calls=>Volatile.Read(ref calls);
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken token){Interlocked.Increment(ref calls);return Task.FromResult(reply(request));}
}
