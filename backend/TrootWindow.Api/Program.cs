using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TrootWindow.Api.Data;

var builder=WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();
builder.Services.AddResponseCompression(o=>o.EnableForHttps=true);
builder.Services.AddOutputCache();
builder.Services.AddDbContextPool<AppDbContext>(o=>o.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"),sql=>sql.EnableRetryOnFailure(5,TimeSpan.FromSeconds(10),null)));
builder.Services.AddRateLimiter(o=>o.AddFixedWindowLimiter("public",x=>{x.PermitLimit=120;x.Window=TimeSpan.FromMinutes(1);x.QueueLimit=0;}));
builder.Services.AddCors(o=>o.AddPolicy("frontend",p=>p.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>()??[]).AllowAnyHeader().AllowAnyMethod()));
var app=builder.Build();
app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseResponseCompression();
app.UseOutputCache();
app.UseRateLimiter();
app.UseCors("frontend");
app.MapHealthChecks("/health");
app.MapControllers();
using(var scope=app.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();await db.Database.EnsureCreatedAsync();}
app.Run();
