using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using TrootWindow.Api.Data;

#nullable disable

namespace TrootWindow.Api.Migrations;

[DbContext(typeof(AppDbContext))]
partial class AppDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
#pragma warning disable 612, 618
        modelBuilder.HasAnnotation("ProductVersion", "10.0.12");
        modelBuilder.Entity("TrootWindow.Api.Data.Job", b =>
        {
            b.Property<Guid>("Id").HasColumnType("uniqueidentifier");
            b.Property<string>("Category").IsRequired().HasMaxLength(60).HasColumnType("nvarchar(60)");
            b.Property<DateTimeOffset>("CreatedAt").HasColumnType("datetimeoffset");
            b.Property<string>("Description").IsRequired().HasMaxLength(5000).HasColumnType("nvarchar(5000)");
            b.Property<string>("Email").HasMaxLength(254).HasColumnType("nvarchar(254)");
            b.Property<bool>("EmployerVerified").HasColumnType("bit");
            b.Property<string>("EmployerName").IsRequired().HasMaxLength(160).HasColumnType("nvarchar(160)");
            b.Property<string>("Location").IsRequired().HasMaxLength(120).HasColumnType("nvarchar(120)");
            b.Property<string>("Mode").IsRequired().HasColumnType("nvarchar(max)");
            b.Property<string>("Pay").IsRequired().HasMaxLength(120).HasColumnType("nvarchar(120)");
            b.Property<DateTimeOffset?>("PublishedAt").HasColumnType("datetimeoffset");
            b.Property<string>("Phone").HasMaxLength(40).HasColumnType("nvarchar(40)");
            b.Property<string>("Requirements").IsRequired().HasMaxLength(1000).HasColumnType("nvarchar(1000)");
            b.Property<string>("Status").IsRequired().HasColumnType("nvarchar(max)");
            b.Property<string>("Title").IsRequired().HasMaxLength(160).HasColumnType("nvarchar(160)");
            b.Property<string>("WhatsApp").HasMaxLength(40).HasColumnType("nvarchar(40)");
            b.HasKey("Id");
            b.HasIndex("Status","EmployerVerified","CreatedAt");
            b.HasIndex("Status","Category","CreatedAt");
            b.HasIndex("Status","Location","CreatedAt");
            b.ToTable("Jobs");
        });
        modelBuilder.Entity("TrootWindow.Api.Data.JobReport", b =>
        {
            b.Property<Guid>("Id").HasColumnType("uniqueidentifier");
            b.Property<DateTimeOffset>("CreatedAt").HasColumnType("datetimeoffset");
            b.Property<string>("Details").HasMaxLength(1000).HasColumnType("nvarchar(1000)");
            b.Property<Guid>("JobId").HasColumnType("uniqueidentifier");
            b.Property<string>("Reason").IsRequired().HasMaxLength(40).HasColumnType("nvarchar(40)");
            b.Property<string>("ReporterKey").IsRequired().HasMaxLength(64).HasColumnType("nvarchar(64)");
            b.HasKey("Id");
            b.HasIndex("JobId","CreatedAt");
            b.HasIndex("ReporterKey","CreatedAt");
            b.ToTable("JobReports");
        });
        modelBuilder.Entity("TrootWindow.Api.Data.JobReport", b =>
        {
            b.HasOne("TrootWindow.Api.Data.Job", null).WithMany().HasForeignKey("JobId").OnDelete(DeleteBehavior.Cascade).IsRequired();
        });
#pragma warning restore 612, 618
    }
}
