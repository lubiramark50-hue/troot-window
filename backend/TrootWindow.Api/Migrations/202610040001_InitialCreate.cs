using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrootWindow.Api.Migrations;

public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(name:"Jobs",columns:table=>new
        {
            Id=table.Column<Guid>(type:"uniqueidentifier",nullable:false),
            Title=table.Column<string>(type:"nvarchar(160)",maxLength:160,nullable:false),
            EmployerName=table.Column<string>(type:"nvarchar(160)",maxLength:160,nullable:false),
            Location=table.Column<string>(type:"nvarchar(120)",maxLength:120,nullable:false),
            Category=table.Column<string>(type:"nvarchar(60)",maxLength:60,nullable:false),
            Mode=table.Column<string>(type:"nvarchar(max)",nullable:false),
            Pay=table.Column<string>(type:"nvarchar(120)",maxLength:120,nullable:false),
            Description=table.Column<string>(type:"nvarchar(5000)",maxLength:5000,nullable:false),
            Requirements=table.Column<string>(type:"nvarchar(1000)",maxLength:1000,nullable:false),
            Phone=table.Column<string>(type:"nvarchar(40)",maxLength:40,nullable:true),
            WhatsApp=table.Column<string>(type:"nvarchar(40)",maxLength:40,nullable:true),
            Email=table.Column<string>(type:"nvarchar(254)",maxLength:254,nullable:true),
            EmployerVerified=table.Column<bool>(type:"bit",nullable:false),
            Status=table.Column<string>(type:"nvarchar(max)",nullable:false),
            CreatedAt=table.Column<DateTimeOffset>(type:"datetimeoffset",nullable:false),
            PublishedAt=table.Column<DateTimeOffset>(type:"datetimeoffset",nullable:true)
        },constraints:table=>table.PrimaryKey("PK_Jobs",x=>x.Id));
        migrationBuilder.CreateTable(name:"JobReports",columns:table=>new
        {
            Id=table.Column<Guid>(type:"uniqueidentifier",nullable:false),
            JobId=table.Column<Guid>(type:"uniqueidentifier",nullable:false),
            Reason=table.Column<string>(type:"nvarchar(40)",maxLength:40,nullable:false),
            Details=table.Column<string>(type:"nvarchar(1000)",maxLength:1000,nullable:true),
            ReporterKey=table.Column<string>(type:"nvarchar(64)",maxLength:64,nullable:false),
            CreatedAt=table.Column<DateTimeOffset>(type:"datetimeoffset",nullable:false)
        },constraints:table=>{table.PrimaryKey("PK_JobReports",x=>x.Id);table.ForeignKey("FK_JobReports_Jobs_JobId",x=>x.JobId,"Jobs", "Id",onDelete:ReferentialAction.Cascade);});
        migrationBuilder.CreateIndex(name:"IX_Jobs_Status_EmployerVerified_CreatedAt",table:"Jobs",columns:new[]{"Status","EmployerVerified","CreatedAt"});
        migrationBuilder.CreateIndex(name:"IX_Jobs_Status_Category_CreatedAt",table:"Jobs",columns:new[]{"Status","Category","CreatedAt"});
        migrationBuilder.CreateIndex(name:"IX_Jobs_Status_Location_CreatedAt",table:"Jobs",columns:new[]{"Status","Location","CreatedAt"});
        migrationBuilder.CreateIndex(name:"IX_JobReports_JobId_CreatedAt",table:"JobReports",columns:new[]{"JobId","CreatedAt"});
        migrationBuilder.CreateIndex(name:"IX_JobReports_ReporterKey_CreatedAt",table:"JobReports",columns:new[]{"ReporterKey","CreatedAt"});
    }
    protected override void Down(MigrationBuilder migrationBuilder){migrationBuilder.DropTable(name:"JobReports");migrationBuilder.DropTable(name:"Jobs");}
}
