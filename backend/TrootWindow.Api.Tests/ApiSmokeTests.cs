using System.Net;
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
}
