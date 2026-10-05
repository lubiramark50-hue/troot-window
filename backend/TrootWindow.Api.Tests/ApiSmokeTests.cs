using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
namespace TrootWindow.Api.Tests;

public sealed class ApiSmokeTests : IClassFixture<TestApplicationFactory>
{
    private readonly HttpClient _client;
    public ApiSmokeTests(TestApplicationFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task JobsEndpoint_IsReachable_AndReturnsPagedPayload()
    {
        using var response = await _client.GetAsync("/api/jobs?page=1&pageSize=20");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JobsPageContract>();
        Assert.NotNull(payload);
        Assert.Equal(1, payload!.Page);
        Assert.Equal(20, payload.PageSize);
    }

    [Fact]
    public async Task CreateJob_Persists_AndCanBeReported()
    {
        var request = new
        {
            title = "Integration Test Mason", employerName = "Troot Test Employer", location = "Kampala",
            category = "Construction", mode = "OnSite", pay = "UGX 100,000/day",
            description = "Build test structures", requirements = "Masonry, Safety", phone = "+256700000000",
            whatsApp = (string?)null, email = (string?)null
        };
        using var create = await _client.PostAsJsonAsync("/api/jobs", request);
        Assert.Equal(HttpStatusCode.Accepted, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<CreatedJobContract>();
        Assert.NotNull(created);
        Assert.NotEqual(Guid.Empty, created!.Id);

        using var get = await _client.GetAsync($"/api/jobs/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);

        using var report = await _client.PostAsJsonAsync($"/api/jobs/{created.Id}/reports", new { reason = "Test report", details = "Automated integration test" });
        Assert.Equal(HttpStatusCode.Accepted, report.StatusCode);
    }

    [Fact]
    public async Task UnknownRoute_ReturnsNotFound()
    {
        using var response = await _client.GetAsync("/api/this-route-does-not-exist");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private sealed record JobsPageContract(List<object> Items, int Page, int PageSize, int TotalCount, bool HasNext);
    private sealed record CreatedJobContract(Guid Id, string Status);
}
