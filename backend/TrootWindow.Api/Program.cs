using System.Net;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TrootWindow.Api.Data;

var builder=WebApplication.CreateBuilder(args);
builder.Services.AddControllers().AddJsonOptions(o=>o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();
builder.Services.AddResponseCompression(o=>o.EnableForHttps=true);
builder.Services.AddOutputCache();

var connection=builder.Configuration.GetConnectionString("DefaultConnection")??throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");
builder.Services.AddDbContextPool<AppDbContext>(o=>o.UseSqlServer(connection,sql=>sql.EnableRetryOnFailure(5,TimeSpan.FromSeconds(10),null)));

builder.Services.Configure<ForwardedHeadersOptions>(o=>{
    o.ForwardedHeaders=ForwardedHeaders.XForwardedFor|ForwardedHeaders.XForwardedProto;
    var trusted=builder.Configuration.GetSection("TrustedProxies").Get<string[]>()??[];
    foreach(var value in trusted.Where(x=>IPAddress.TryParse(x,out _))) o.KnownProxies.Add(IPAddress.Parse(value));
});

builder.Services.AddRateLimiter(o=>{
    o.GlobalLimiter=PartitionedRateLimiter.Create<HttpContext,string>(context=>RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString()??"unknown",_=>new FixedWindowRateLimiterOptions{PermitLimit=120,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));
    o.AddFixedWindowLimiter("job-submit",x=>{x.PermitLimit=6;x.Window=TimeSpan.FromMinutes(10);x.QueueLimit=0;});
    o.RejectionStatusCode=StatusCodes.Status429TooManyRequests;
    o.OnRejected=async(context,token)=>{context.HttpContext.Response.Headers.RetryAfter="60";await context.HttpContext.Response.WriteAsJsonAsync(new{title="Too many requests",status=429},token);};
});

builder.Services.AddCors(o=>o.AddPolicy("frontend",p=>p.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>()??[]).AllowAnyHeader().AllowAnyMethod()));
var app=builder.Build();
app.UseExceptionHandler();
app.UseForwardedHeaders();
if(!app.Environment.IsDevelopment())app.UseHsts();
app.UseHttpsRedirection();app.UseResponseCompression();app.UseOutputCache();app.UseRateLimiter();app.UseCors("frontend");
app.Use(async(context,next)=>{context.Response.Headers["X-Content-Type-Options"]="nosniff";context.Response.Headers["X-Frame-Options"]="DENY";context.Response.Headers["Referrer-Policy"]="strict-origin-when-cross-origin";context.Response.Headers["Permissions-Policy"]="camera=(), microphone=(), geolocation=()";await next();});
app.MapHealthChecks("/health");app.MapControllers();
using(var scope=app.Services.CreateScope())
{
    var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}
app.Run();
