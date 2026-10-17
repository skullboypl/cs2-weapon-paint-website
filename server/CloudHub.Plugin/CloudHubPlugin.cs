using CloudHub.Core;
using CounterStrikeSharp.API;
using CounterStrikeSharp.API.Core;
using CounterStrikeSharp.API.Core.Attributes;
using CounterStrikeSharp.API.Core.Attributes.Registration;
using CounterStrikeSharp.API.Modules.Timers;
using Microsoft.Extensions.Logging;
namespace CloudHub.Plugin;
public sealed class CloudHubConfig : BasePluginConfig {
    public bool Enabled { get; set; } = false;
    public string ServerId { get; set; } = "cs2-main";
    public string Endpoint { get; set; } = "https://skins.cloudhub.autos/api/ingest.php";
    public string SecretEnvironmentVariable { get; set; } = "CLOUDHUB_EVENT_KEY";
}
[MinimumApiVersion(376)]
public sealed class CloudHubPlugin : BasePlugin, IPluginConfig<CloudHubConfig> {
    public override string ModuleName => "CloudHub Core";
    public override string ModuleVersion => "0.2.0";
    public override string ModuleAuthor => "CloudHub";
    public override string ModuleDescription => "Opt-in signed round telemetry; no match inference or game mutations";
    public CloudHubConfig Config {get;set;}=new();
    private readonly RoundTracker tracker=new();
    private DurableOutbox? outbox;
    public void OnConfigParsed(CloudHubConfig config) { Config=config; }
    public override void Load(bool hotReload) {
        if(!Config.Enabled){Logger.LogInformation("CloudHub Core is disabled");return;}
        var secret=Environment.GetEnvironmentVariable(Config.SecretEnvironmentVariable);
        if(secret is null || secret.Length<32 || !Uri.TryCreate(Config.Endpoint,UriKind.Absolute,out var endpoint) || endpoint.Scheme!="https") {
            Logger.LogError("CloudHub disabled: HTTPS endpoint and environment secret of 32+ characters required");return;
        }
        try { outbox=new DurableOutbox(Path.Combine(ModuleDirectory,"outbox"),endpoint,Config.ServerId,secret,message=>Logger.LogWarning("CloudHub: {Message}",message)); }
        catch(Exception ex) {Logger.LogError("CloudHub disabled: outbox initialization failed ({Type})",ex.GetType().Name);return;}
        RegisterListener<Listeners.OnMapStart>(_=>tracker.Cancel());
        RegisterListener<Listeners.OnMapEnd>(()=>tracker.Cancel());
        AddTimer(1.0f,Sample,TimerFlags.REPEAT);
    }
    private static string? Id(CCSPlayerController? p) {
        if(p is null || !p.IsValid || p.IsBot || p.IsHLTV)return null;
        return p.AuthorizedSteamID?.SteamId64.ToString(System.Globalization.CultureInfo.InvariantCulture);
    }
    private static (PlayerSnapshot[] Players,bool Unsafe) Snapshot() {
        var rules=Utilities.FindAllEntitiesByDesignerName<CCSGameRulesProxy>("cs_gamerules").FirstOrDefault()?.GameRules;
        bool unsafeRound=rules is null || rules.WarmupPeriod;
        var players=new List<PlayerSnapshot>();
        foreach(var p in Utilities.GetPlayers()) {
            if(!p.IsValid || p.IsHLTV || p.TeamNum is not (2 or 3))continue;
            var id=Id(p);var pawn=p.PlayerPawn.Value;
            if(p.IsBot || id is null || pawn is null || !pawn.IsValid){unsafeRound=true;continue;}
            var pos=pawn.AbsOrigin;var angles=pawn.EyeAngles;
            if(pos is null){unsafeRound=true;continue;}
            players.Add(new(id,p.TeamNum,p.PawnIsAlive,pos.X,pos.Y,pos.Z,angles.X,angles.Y));
        }
        return(players.ToArray(),unsafeRound);
    }
    private void Sample() {
        if(outbox is null)return;
        try {var s=Snapshot();tracker.Sample(Server.CurrentTime,s.Players,s.Unsafe);}
        catch(Exception ex){tracker.Cancel();Logger.LogWarning("CloudHub round discarded: snapshot failed ({Type})",ex.GetType().Name);}
    }
    [GameEventHandler(HookMode.Post)]
    public HookResult RoundStart(EventRoundStart e,GameEventInfo info){tracker.Cancel();return HookResult.Continue;}
    [GameEventHandler(HookMode.Post)]
    public HookResult FreezeEnd(EventRoundFreezeEnd e,GameEventInfo info) {
        if(outbox is not null) {
            try {var s=Snapshot();tracker.Start(Server.CurrentTime,s.Players,s.Unsafe);}
            catch(Exception){tracker.Cancel();}
        }
        return HookResult.Continue;
    }
    [GameEventHandler(HookMode.Post)]
    public HookResult Death(EventPlayerDeath e,GameEventInfo info) {
        if(outbox is null)return HookResult.Continue;
        var victim=Id(e.Userid);var killer=Id(e.Attacker);
        if(victim is null || (e.Attacker is not null && killer is null)){tracker.Cancel();return HookResult.Continue;}
        tracker.Died(killer,victim,Id(e.Assister),e.Headshot);return HookResult.Continue;
    }
    [GameEventHandler(HookMode.Post)]
    public HookResult Fire(EventWeaponFire e,GameEventInfo info){if(outbox is null)return HookResult.Continue;var id=Id(e.Userid);if(id is not null)tracker.Fired(id);return HookResult.Continue;}
    [GameEventHandler(HookMode.Post)]
    public HookResult Spawn(EventPlayerSpawn e,GameEventInfo info){if(outbox is null)return HookResult.Continue;var id=Id(e.Userid);if(id is not null)tracker.Spawned(id);return HookResult.Continue;}
    [GameEventHandler(HookMode.Pre)]
    public HookResult Disconnect(EventPlayerDisconnect e,GameEventInfo info){if(outbox is null)return HookResult.Continue;var id=Id(e.Userid) ?? e.Xuid.ToString(System.Globalization.CultureInfo.InvariantCulture);tracker.Disconnected(id);return HookResult.Continue;}
    [GameEventHandler(HookMode.Post)]
    public HookResult RoundEnd(EventRoundEnd e,GameEventInfo info) {
        if(outbox is null)return HookResult.Continue;
        Sample();var completed=tracker.Finish(Server.CurrentTime,DateTimeOffset.UtcNow.ToUnixTimeSeconds(),e.Winner,e.Reason);
        if(completed is not null && !outbox.TryEnqueue(completed))Logger.LogError("CloudHub queue full; round {RoundId} not accepted",completed.RoundId);
        return HookResult.Continue;
    }
    public override void Unload(bool hotReload) {
        tracker.Cancel();var old=outbox;outbox=null;
        if(old is not null)_=Drain(old);
    }
    private async Task Drain(DurableOutbox old){try{await old.DisposeAsync();}catch(Exception ex){Logger.LogError("CloudHub outbox drain failed ({Type})",ex.GetType().Name);}}
}
