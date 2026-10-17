using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;
namespace CloudHub.Core;
public static class EventSigner {
    public static string Sign(string key,string server,string timestamp,string body) =>
        Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key),Encoding.UTF8.GetBytes($"v1\n{server}\n{timestamp}\n{Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(body)))}")));
}
/// <summary>Bounded admission, independent disk writer and HTTP sender. Only persisted records survive process failure.</summary>
public sealed class DurableOutbox : IAsyncDisposable {
    private readonly Channel<RoundEvent> input=Channel.CreateBounded<RoundEvent>(new BoundedChannelOptions(128){SingleReader=true,FullMode=BoundedChannelFullMode.Wait});
    private readonly string directory,server,key;
    private readonly Uri endpoint;
    private readonly HttpClient client;
    private readonly Action<string> log;
    private readonly CancellationTokenSource stop=new();
    private readonly FileStream lease;
    private readonly Task writer,sender;
    private readonly TimeSpan retryBase;
    public DurableOutbox(string directory,Uri endpoint,string server,string key,Action<string> log,HttpMessageHandler? handler=null,TimeSpan? retryBase=null) {
        if(endpoint.Scheme!="https" || !string.IsNullOrEmpty(endpoint.UserInfo) || !string.IsNullOrEmpty(endpoint.Fragment))throw new ArgumentException("HTTPS endpoint required");
        if(key.Length<32 || !System.Text.RegularExpressions.Regex.IsMatch(server,"^[a-zA-Z0-9_-]{1,64}$"))throw new ArgumentException("Server/key configuration invalid");
        this.directory=Path.GetFullPath(directory);this.endpoint=endpoint;this.server=server;this.key=key;this.log=log;this.retryBase=retryBase??TimeSpan.FromSeconds(1);
        Directory.CreateDirectory(this.directory);
        if(!OperatingSystem.IsWindows())File.SetUnixFileMode(this.directory,UnixFileMode.UserRead|UnixFileMode.UserWrite|UnixFileMode.UserExecute);
        lease=new FileStream(Path.Combine(this.directory,"writer.lock"),FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None);
        client=new HttpClient(handler??new HttpClientHandler{AllowAutoRedirect=false}){Timeout=TimeSpan.FromSeconds(15)};
        var recovery=Task.Run(Recover);
        writer=Task.Run(async()=>{await recovery;await WriteLoop();}); sender=Task.Run(async()=>{await recovery;await SendLoop();});
    }
    public bool TryEnqueue(RoundEvent e) => Guid.TryParseExact(e.EventId,"D",out _) && Guid.TryParseExact(e.RoundId,"D",out _) && input.Writer.TryWrite(e);
    private async Task WriteLoop() {
        await foreach(var e in input.Reader.ReadAllAsync()) {
            var body=Protocol.Encode(e); var bytes=Encoding.UTF8.GetBytes(body);
            if(bytes.Length>65536){log("Event exceeds 64 KiB; not queued");continue;}
            var name=Path.Combine(directory,e.EventId+".json");
            while(true) {
                try {
                    if(Directory.EnumerateFiles(directory).Count()>=10001)throw new IOException("Outbox capacity reached");
                    if(File.Exists(name)) {
                        if(await File.ReadAllTextAsync(name)!=body)throw new IOException("Event identity collision");
                    } else {
                        await using(var file=new FileStream(name+".tmp",FileMode.Create,FileAccess.Write,FileShare.None,4096,FileOptions.Asynchronous|FileOptions.WriteThrough)) {
                            await file.WriteAsync(bytes); file.Flush(true);
                        }
                        File.Move(name+".tmp",name);
                    }
                    break;
                } catch(IOException) { log("Outbox write blocked; retaining event in memory, inspect disk/capacity"); await Task.Delay(retryBase); }
            }
        }
    }
    private async Task Recover() {
            // Complete writes interrupted between flush and rename; partial files are retained for operator review.
            foreach(var tmp in Directory.EnumerateFiles(directory,"*.json.tmp")) {
                try {
                    var e=JsonSerializer.Deserialize<RoundEvent>(await File.ReadAllTextAsync(tmp),Protocol.Json);
                    if(e is null || Path.GetFileName(tmp)!=e.EventId+".json.tmp")throw new JsonException();
                    File.Move(tmp,tmp[..^4],false);
                }catch(Exception ex) when(ex is IOException or JsonException){File.Move(tmp,tmp+".rejected",true);log("Interrupted record quarantined");}
            }
    }
    private async Task SendLoop() {
        try {
            int failures=0;
            while(!stop.IsCancellationRequested) {
                var files=Directory.GetFiles(directory,"*.json").OrderBy(File.GetCreationTimeUtc).ThenBy(x=>x,StringComparer.Ordinal).ToArray();
                foreach(var path in files) {
                    try {
                        if(new FileInfo(path).Length>65536) { File.Move(path,path+".rejected");log("Oversized record quarantined");continue; }
                        var body=await File.ReadAllTextAsync(path,stop.Token);
                        var stamp=DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
                        using var request=new HttpRequestMessage(HttpMethod.Post,endpoint){Content=new StringContent(body,Encoding.UTF8,"application/json")};
                        request.Headers.Add("X-CloudHub-Server",server);request.Headers.Add("X-CloudHub-Timestamp",stamp);request.Headers.Add("X-CloudHub-Signature",EventSigner.Sign(key,server,stamp,body));
                        using var response=await client.SendAsync(request,HttpCompletionOption.ResponseHeadersRead,stop.Token);
                        if(response.StatusCode is HttpStatusCode.Conflict or HttpStatusCode.UnprocessableEntity) { File.Move(path,path+".rejected");log("Event rejected; retained for review (409/422)");failures=0;continue; }
                        if(response.StatusCode!=HttpStatusCode.OK)throw new HttpRequestException("Ingestion unavailable");
                        await using var stream=await response.Content.ReadAsStreamAsync(stop.Token);
                        byte[] buffer=new byte[4097];int length=0,read;
                        while(length<buffer.Length && (read=await stream.ReadAsync(buffer.AsMemory(length),stop.Token))>0)length+=read;
                        if(length>4096)throw new HttpRequestException("Oversized acknowledgement");
                        using var ack=JsonDocument.Parse(buffer.AsMemory(0,length));
                        if(!ack.RootElement.TryGetProperty("status",out var status) || status.GetString() is not ("applied" or "duplicate"))throw new HttpRequestException("Invalid acknowledgement");
                        File.Delete(path);failures=0;
                    } catch(Exception ex) when(ex is IOException or HttpRequestException or JsonException or TaskCanceledException or InvalidOperationException) {
                        if(stop.IsCancellationRequested)return;
                        log("Delivery pending; retrying persisted event");
                        failures=Math.Min(failures+1,5);
                        await Task.Delay(TimeSpan.FromMilliseconds(Math.Min(30000,retryBase.TotalMilliseconds*Math.Pow(2,failures))+Random.Shared.Next(100)),stop.Token);
                        break;
                    }
                }
                await Task.Delay(retryBase,stop.Token);
            }
        }catch(OperationCanceledException) when(stop.IsCancellationRequested){}
    }
    public async ValueTask DisposeAsync() {
        input.Writer.TryComplete();
        // Caller awaits off the game thread. Disk errors intentionally prevent claiming a durable drain.
        await writer;
        await stop.CancelAsync();await sender;client.Dispose();lease.Dispose();stop.Dispose();
    }
}
