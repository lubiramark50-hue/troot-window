using System.ComponentModel.DataAnnotations;
namespace TrootWindow.Api.Data;
public enum JobStatus{PendingReview,Published,Rejected,Closed}
public enum WorkMode{OnSite,Hybrid,Remote}
public sealed class Job{public Guid Id{get;set;}[MaxLength(160)]public string Title{get;set;}="";[MaxLength(160)]public string EmployerName{get;set;}="";[MaxLength(120)]public string Location{get;set;}="";[MaxLength(60)]public string Category{get;set;}="Other";public WorkMode Mode{get;set;}[MaxLength(120)]public string Pay{get;set;}="";[MaxLength(5000)]public string Description{get;set;}="";[MaxLength(1000)]public string Requirements{get;set;}="";[MaxLength(40)]public string? Phone{get;set;}[MaxLength(40)]public string? WhatsApp{get;set;}[MaxLength(254)]public string? Email{get;set;}public bool EmployerVerified{get;set;}public JobStatus Status{get;set;}=JobStatus.PendingReview;public DateTimeOffset CreatedAt{get;set;}=DateTimeOffset.UtcNow;public DateTimeOffset? PublishedAt{get;set;}}
public sealed class JobReport{public Guid Id{get;set;}public Guid JobId{get;set;}[MaxLength(40)]public string Reason{get;set;}="";[MaxLength(1000)]public string? Details{get;set;}[MaxLength(64)]public string ReporterKey{get;set;}="";public DateTimeOffset CreatedAt{get;set;}=DateTimeOffset.UtcNow;}
public sealed record CreateJobRequest(
    [Required, StringLength(160)] string Title,
    [Required, StringLength(160)] string EmployerName,
    [Required, StringLength(120)] string Location,
    [Required, StringLength(60)] string Category,
    [EnumDataType(typeof(WorkMode))] WorkMode Mode,
    [Required, StringLength(120)] string Pay,
    [Required, StringLength(5000)] string Description,
    [Required, StringLength(1000)] string Requirements,
    [StringLength(40)] string? Phone,
    [StringLength(40)] string? WhatsApp,
    [EmailAddress, StringLength(254)] string? Email);
public sealed record CreateJobReportRequest([property:Required,MaxLength(40)]string Reason,[property:MaxLength(1000)]string? Details);
public sealed record JobListItem(Guid Id,string Title,string EmployerName,string Location,string Category,WorkMode Mode,string Pay,string Description,string Requirements,bool EmployerVerified,DateTimeOffset CreatedAt,DateTimeOffset? PublishedAt);
public sealed record JobDto(Guid Id,string Title,string EmployerName,string Location,string Category,WorkMode Mode,string Pay,string Description,string Requirements,string? Phone,string? WhatsApp,string? Email,bool EmployerVerified,DateTimeOffset CreatedAt,DateTimeOffset? PublishedAt);
public sealed record JobsPage(IReadOnlyList<JobListItem> Items,int Page,int PageSize,int TotalCount,bool HasNext);