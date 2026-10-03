using Microsoft.EntityFrameworkCore;
namespace TrootWindow.Api.Data;
public sealed class AppDbContext(DbContextOptions<AppDbContext> o):DbContext(o){
 public DbSet<Job> Jobs=>Set<Job>();public DbSet<JobReport> JobReports=>Set<JobReport>();
 protected override void OnModelCreating(ModelBuilder b){
  b.Entity<Job>().HasKey(x=>x.Id);b.Entity<Job>().HasIndex(x=>new{x.Status,x.EmployerVerified,x.CreatedAt});b.Entity<Job>().HasIndex(x=>new{x.Status,x.Category,x.CreatedAt});b.Entity<Job>().HasIndex(x=>new{x.Status,x.Location,x.CreatedAt});b.Entity<Job>().Property(x=>x.Mode).HasConversion<string>();b.Entity<Job>().Property(x=>x.Status).HasConversion<string>();
  b.Entity<JobReport>().HasKey(x=>x.Id);b.Entity<JobReport>().HasIndex(x=>new{x.JobId,x.CreatedAt});b.Entity<JobReport>().HasIndex(x=>new{x.ReporterKey,x.CreatedAt});b.Entity<JobReport>().HasOne<Job>().WithMany().HasForeignKey(x=>x.JobId).OnDelete(DeleteBehavior.Cascade);
 }
}