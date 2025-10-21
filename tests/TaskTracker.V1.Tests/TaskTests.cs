using System.Net.Http.Json;
using FluentAssertions;

namespace TaskTracker.V1.Tests;

[Collection("TaskTrackerV1Server")]
public class TaskTests
{
    private readonly HttpClient _http;
    private readonly string _eventFile;

    public TaskTests(NodeServerFixture fixture)
    {
        _http = fixture.Client;
        var appRoot = FindAppRoot(AppContext.BaseDirectory);
        _eventFile = Path.Combine(appRoot, "eventlistTest.txt");
    }

    private string FindAppRoot(string startDir)
    {
        var dir = startDir;
        for (int i = 0; i < 10; i++)
        {
            if (File.Exists(Path.Combine(dir, "server.js")))
                return dir;
            dir = Path.GetDirectoryName(dir) ?? throw new DirectoryNotFoundException("Cannot find app root");
        }
        throw new DirectoryNotFoundException("Cannot find server.js");
    }

    // Helper method to create task and get last event
    private async Task<System.Text.Json.JsonElement> CreateTaskAndGetLastEvent(object task)
    {
        await _http.PostAsJsonAsync("/api/tasks", task);
        var fileContent = File.ReadAllText(_eventFile);
        var events = fileContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        return System.Text.Json.JsonDocument.Parse(events.Last()).RootElement;
    }

    [Fact]
    public async Task CheckTaskName()
    {
        var task = new { name = "Test Task Name", date = "2025-10-25", time = "14:30", description = "Test description" };
        var lastEvent = await CreateTaskAndGetLastEvent(task);
        lastEvent.GetProperty("name").GetString().Should().Be("Test Task Name");
    }

    [Fact]
    public async Task CheckTaskDate()
    {
        var task = new { name = "Date Test Task", date = "2025-11-15", time = "09:00", description = "Testing date" };
        var lastEvent = await CreateTaskAndGetLastEvent(task);
        lastEvent.GetProperty("date").GetString().Should().Be("2025-11-15");
    }

    [Fact]
    public async Task CheckTaskDescription()
    {
        var task = new { name = "Description Test", date = "2025-12-01", time = "16:45", description = "Test description for verification" };
        var lastEvent = await CreateTaskAndGetLastEvent(task);
        lastEvent.GetProperty("description").GetString().Should().Be("Test description for verification");
    }

    [Fact]
    public async Task CheckTaskTime()
    {
        var task = new { name = "Time Test Task", date = "2025-10-30", time = "18:45", description = "Testing time field" };
        var lastEvent = await CreateTaskAndGetLastEvent(task);
        lastEvent.GetProperty("time").GetString().Should().Be("18:45");
    }

    [Fact]
    public async Task CheckTaskId()
    {
        var task = new { name = "ID Test Task", date = "2025-11-01", time = "10:00", description = "Testing ID generation" };
        var lastEvent = await CreateTaskAndGetLastEvent(task);
        var actualId = lastEvent.GetProperty("id").GetString();
        actualId.Should().NotBeNullOrEmpty();
        actualId.Should().StartWith("t_");
    }

    [Fact]
    public async Task CheckEventType()
    {
        var task = new { name = "Event Type Test", date = "2025-11-05", time = "12:00", description = "Testing event type" };
        var lastEvent = await CreateTaskAndGetLastEvent(task);
        lastEvent.GetProperty("type").GetString().Should().Be("create");
    }

    [Fact]
    public async Task CheckCreatedAtTimestamp()
    {
        var task = new { name = "Timestamp Test", date = "2025-11-10", time = "15:30", description = "Testing createdAt field" };
        var lastEvent = await CreateTaskAndGetLastEvent(task);
        var createdAt = lastEvent.GetProperty("createdAt").GetString();
        createdAt.Should().NotBeNullOrEmpty();
        DateTime.TryParse(createdAt, out _).Should().BeTrue();
    }

    [Fact]
    public async Task CheckMultipleTasks()
    {
        await _http.PostAsJsonAsync("/api/tasks", new { name = "First Task", date = "2025-11-15", time = "09:00", description = "First" });
        var lastEvent = await CreateTaskAndGetLastEvent(new { name = "Second Task", date = "2025-11-16", time = "10:00", description = "Second" });
        
        var fileContent = File.ReadAllText(_eventFile);
        var events = fileContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        events.Length.Should().BeGreaterOrEqualTo(2);
        lastEvent.GetProperty("name").GetString().Should().Be("Second Task");
    }

    [Fact]
    public async Task CheckEmptyDescription()
    {
        var task = new { name = "No Description Task", date = "2025-11-20", time = "14:00", description = "" };
        var lastEvent = await CreateTaskAndGetLastEvent(task);
        lastEvent.GetProperty("description").GetString().Should().Be("");
    }

    [Fact]
    public async Task CheckAllTaskFields()
    {
        var task = new { name = "Complete Task", date = "2025-12-25", time = "20:30", description = "Full task verification" };
        var lastEvent = await CreateTaskAndGetLastEvent(task);
        
        lastEvent.GetProperty("type").GetString().Should().Be("create");
        lastEvent.GetProperty("name").GetString().Should().Be("Complete Task");
        lastEvent.GetProperty("date").GetString().Should().Be("2025-12-25");
        lastEvent.GetProperty("time").GetString().Should().Be("20:30");
        lastEvent.GetProperty("description").GetString().Should().Be("Full task verification");
        lastEvent.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
        lastEvent.GetProperty("createdAt").GetString().Should().NotBeNullOrEmpty();
    }
}
