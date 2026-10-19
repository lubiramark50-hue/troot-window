using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Xunit;

namespace TrootWindow.Api.Tests;

public sealed class ApiSmokeTests : IClassFixture<TestApplicationFactory>
{
    private readonly HttpClient _client;
    public ApiSmokeTests(TestApplicationFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task JobsEndpoint_IsReachable()
    {
        using var response = await _client.GetAsync("/api/jobs?page=1&pageSize=20");
        Assert.NotEqual(HttpStatusCode.InternalServerError, response.StatusCode);
    }

    [Fact]
    public async Task UnknownRoute_ReturnsNotFound()
    {
        using var response = await _client.GetAsync("/api/this-route-does-not-exist");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
    [Fact]
    public async Task OversizedJobTitle_IsRejectedBeforeDatabaseWrite()
    {
        var payload = new
        {
            title = new string('T', 161), employerName = "Troot Test Employer",
            location = "Kampala", category = "Technology", mode = "Remote",
            pay = "Negotiable", description = "A test job description.",
            requirements = "Test requirements", phone = "+256700000008",
            whatsApp = (string?)null, email = (string?)null
        };

        using var response = await _client.PostAsJsonAsync("/api/jobs", payload);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UndefinedWorkMode_IsRejected()
    {
        using var response = await _client.PostAsJsonAsync("/api/jobs", new
        {
            title = "Valid test title", employerName = "Troot Test Employer",
            location = "Kampala", category = "Technology", mode = 999,
            pay = "Negotiable", description = "A test job description.",
            requirements = "Test requirements", phone = "+256700000009",
            whatsApp = (string?)null, email = (string?)null
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

}
