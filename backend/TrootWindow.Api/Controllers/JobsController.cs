using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using TrootWindow.Api.Data;
namespace TrootWindow.Api.Controllers;
[ApiController][Route("api/jobs")]
public sealed class JobsController(AppDbContext db):ControllerBase{
 [HttpGet][OutputCache(Duration=10,VaryByQueryKeys=new[]{"q","category","mode","page","pageSize"})]
 public async Task<ActionResult<JobsPage>> Get([FromQuery]string?q,[FromQuery]string?category,[FromQuery]WorkMode?mode,[FromQuery]int page=1,[FromQuery]int pageSize=20,CancellationToken ct=default){
  page=Math.Clamp(page,1,10000);pageSize=Math.Clamp(pageSize,1,50);
  var x=db.Jobs.AsNoTracking().Where(j=>j.Status==JobStatus.Published);
  if(!string.IsNullOrWhiteSpace(q)){q=q.Trim();x=x.Where(j=>j.Title.Contains(q)||j.EmployerName.Contains(q)||j.Location.Contains(q)||j.Category.Contains(q)||j.Requirements.Contains(q));}
  if(!string.IsNullOrWhiteSpace(category)&&category!="All")x=x.Where(j=>j.Category==category);
  if(mode.HasValue)x=x.Where(j=>j.Mode==mode);
  var total=await x.CountAsync(ct);
  var rows=await x.OrderByDescending(j=>j.EmployerVerified).ThenByDescending(j=>j.CreatedAt).Skip((page-1)*pageSize).Take(pageSize).Select(j=>new JobDto(j.Id,j.Title,j.EmployerName,j.Location,j.Category,j.Mode,j.Pay,j.Description,j.Requirements,j.Phone,j.WhatsApp,j.Email,j.EmployerVerified,j.CreatedAt,j.PublishedAt)).ToListAsync(ct);
  return Ok(new JobsPage(rows,page,pageSize,total,page*pageSize<total));
 }
 [HttpGet("{id:guid}")]
 [OutputCache(Duration=30,VaryByRouteValueNames=new[]{"id"})]
 public async Task<ActionResult<JobDto>> One(Guid id,CancellationToken ct){
  var j=await db.Jobs.AsNoTracking().Where(x=>x.Id==id&&x.Status==JobStatus.Published).Select(x=>new JobDto(x.Id,x.Title,x.EmployerName,x.Location,x.Category,x.Mode,x.Pay,x.Description,x.Requirements,x.Phone,x.WhatsApp,x.Email,x.EmployerVerified,x.CreatedAt,x.PublishedAt)).FirstOrDefaultAsync(ct);
  return j is null?NotFound():Ok(j);
 }
 [HttpPost][Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("public")]
 public async Task<IActionResult>Create(CreateJobRequest r,CancellationToken ct){
  if(string.IsNullOrWhiteSpace(r.Phone)&&string.IsNullOrWhiteSpace(r.WhatsApp)&&string.IsNullOrWhiteSpace(r.Email))return BadRequest(new{message="At least one contact method is required."});
  var j=new Job{Id=Guid.NewGuid(),Title=r.Title.Trim(),EmployerName=r.EmployerName.Trim(),Location=r.Location.Trim(),Category=r.Category.Trim(),Mode=r.Mode,Pay=r.Pay.Trim(),Description=r.Description.Trim(),Requirements=r.Requirements.Trim(),Phone=Clean(r.Phone),WhatsApp=Clean(r.WhatsApp),Email=string.IsNullOrWhiteSpace(r.Email)?null:r.Email.Trim()};
  db.Jobs.Add(j);await db.SaveChangesAsync(ct);return Accepted(new{id=j.Id,status=j.Status.ToString()});
 }
 static string? Clean(string? s)=>string.IsNullOrWhiteSpace(s)?null:s.Trim();
}
