using System.Text.Json;
namespace CloudHub.Core;
public sealed record PlayerSnapshot(string Steamid, int Team, bool Alive, float X, float Y, float Z, float Pitch, float Yaw);
public sealed record RoundPlayer(string Steamid, int Team, int ActiveSeconds, bool Finished);
public sealed record Death(string? Killer, string Victim, string? Assister, bool Headshot);
public sealed record RoundEvent(int Version, string Kind, string EventId, string RoundId, long EndedAt, int Duration, int Winner, int Reason, bool Warmup, bool HasBots, RoundPlayer[] Players, Death[] Deaths);
public static class Protocol {
    public static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy=JsonNamingPolicy.SnakeCaseLower };
    public static string Encode(RoundEvent e) => JsonSerializer.Serialize(e,Json);
    public static bool ValidOutcome(int winner,int reason) => reason switch {1 or 9 or 13=>winner==2,7 or 8 or 11 or 12=>winner==3,_=>false};
}
// No native game handles leave the main game thread. Match outcomes are deliberately separate.
public interface IMatchResultAdapter {
    event Action<ConfirmedMatchResult>? MatchConfirmed;
}
public sealed record ConfirmedMatchResult(string ExternalMatchId, string[] Winners, string[] Losers);
public sealed class RoundTracker {
    private sealed class State(PlayerSnapshot sample) {
        public PlayerSnapshot Last=sample;
        public double Active;
        public bool Finished=true;
        public bool Fired;
    }
    private readonly Dictionary<string,State> players=[];
    private readonly List<Death> deaths=[];
    private readonly HashSet<string> dead=[];
    private double started,lastSample;
    private string? roundId;
    public void Cancel() { roundId=null; players.Clear(); deaths.Clear(); dead.Clear(); }
    public void Start(double time, IReadOnlyList<PlayerSnapshot> roster, bool unsafeRound) {
        Cancel();
        if(unsafeRound || roster.Count is <2 or >64 || roster.Select(p=>p.Steamid).Distinct().Count()!=roster.Count || roster.Any(p=>!ValidPlayer(p)) || roster.Select(p=>p.Team).Distinct().Count()!=2)return;
        started=lastSample=time; roundId=Guid.NewGuid().ToString();
        foreach(var p in roster)players.Add(p.Steamid,new State(p));
    }
    private static bool ValidPlayer(PlayerSnapshot p) => System.Text.RegularExpressions.Regex.IsMatch(p.Steamid,"^7656119[0-9]{10}$") && p.Team is 2 or 3;
    public void Sample(double time,IReadOnlyList<PlayerSnapshot> roster,bool unsafeRound) {
        if(roundId is null)return;
        double dt=time-lastSample;
        if(unsafeRound || dt<0 || dt>5 || roster.Count>64 || roster.Select(p=>p.Steamid).Distinct().Count()!=roster.Count) { Cancel();return; }
        // Late join/team switches invalidate competitive observations for this round.
        if(roster.Any(p=>!players.TryGetValue(p.Steamid,out var s) || s.Last.Team!=p.Team)){Cancel();return;}
        var current=roster.ToDictionary(p=>p.Steamid);
        foreach(var (id,s) in players) {
            if(!current.TryGetValue(id,out var p)){s.Finished=false;continue;}
            if(s.Finished && dt>0 && s.Last.Alive && p.Alive &&
                (s.Fired || Math.Abs(p.X-s.Last.X)+Math.Abs(p.Y-s.Last.Y)+Math.Abs(p.Z-s.Last.Z)>3 || Math.Abs(p.Pitch-s.Last.Pitch)+Math.Abs(p.Yaw-s.Last.Yaw)>2)) s.Active+=dt;
            if(dt>0)s.Fired=false;
            s.Last=p;
        }
        lastSample=time;
    }
    public void Fired(string id) { if(roundId is not null && players.TryGetValue(id,out var s) && s.Finished && s.Last.Alive)s.Fired=true; }
    public void Disconnected(string id) { if(players.TryGetValue(id,out var s))s.Finished=false; }
    public void Spawned(string id) { if(roundId is not null && dead.Contains(id))Cancel(); }
    public void Died(string? killer,string victim,string? assister,bool headshot) {
        if(roundId is null)return;
        if(!players.ContainsKey(victim) || (killer is not null && !players.ContainsKey(killer))){Cancel();return;}
        if(!dead.Add(victim))return;
        if(assister is not null && (!players.ContainsKey(assister) || assister==killer || assister==victim || killer is null || players[assister].Last.Team!=players[killer].Last.Team || players[assister].Last.Team==players[victim].Last.Team))assister=null;
        deaths.Add(new(killer,victim,assister,headshot));
    }
    public RoundEvent? Finish(double time,long unixTime,int winner,int reason) {
        if(roundId is null)return null;
        int duration=(int)Math.Floor(time-started);
        RoundEvent? result=null;
        if(duration is >=1 and <=3600 && Protocol.ValidOutcome(winner,reason))result=new(1,"round.completed",roundId,roundId,unixTime,duration,winner,reason,false,false,
            players.Select(pair=>new RoundPlayer(pair.Key,pair.Value.Last.Team,Math.Min(duration,(int)Math.Floor(pair.Value.Active)),pair.Value.Finished)).ToArray(),deaths.ToArray());
        Cancel();return result;
    }
}
