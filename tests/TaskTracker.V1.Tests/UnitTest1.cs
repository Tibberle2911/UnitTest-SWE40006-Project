using System.Diagnostics;
using System.Net.Http.Json;
using FluentAssertions;

namespace TaskTracker.V1.Tests;

[CollectionDefinition("TaskTrackerV1Server")]
public class TaskTrackerV1ServerCollection : ICollectionFixture<NodeServerFixture> { }

public class NodeServerFixture : IDisposable
{
    private Process? _process;
    public HttpClient Client;
    private string _eventFile;

    public NodeServerFixture()
    {
        // Find the app root directory
        var appRoot = FindAppRoot(AppContext.BaseDirectory);
        _eventFile = Path.Combine(appRoot, "eventlistTest.txt");

        // Clear previous test data
        File.WriteAllText(_eventFile, string.Empty);

        // Install npm packages (cross-platform)
        InstallNodeDependencies(appRoot);

        // Start Node.js server
        var port = 3456;
        _process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "node",
                Arguments = "server.js",
                WorkingDirectory = appRoot,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                Environment = { 
                    ["PORT"] = port.ToString(),
                    ["EVENT_FILE"] = "eventlistTest.txt"
                }
            }
        };

        _process.Start();

        // Wait for server to start
        WaitForServerStart(_process, port);

        Client = new HttpClient { BaseAddress = new Uri($"http://localhost:{port}") };
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

    private void RunCommand(string fileName, string arguments, string workingDir)
    {
        var process = Process.Start(new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            WorkingDirectory = workingDir,
            UseShellExecute = false,
            CreateNoWindow = true
        });
        
        process?.WaitForExit(120000); // 2 minutes timeout
    }

    private void InstallNodeDependencies(string workingDir)
    {
        // Prefer reproducible installs
        var npmArgs = "ci --no-audit --no-fund";
        if (OperatingSystem.IsWindows())
        {
            // Use cmd on Windows to resolve npm.cmd
            RunCommand("cmd.exe", $"/c npm {npmArgs}", workingDir);
        }
        else
        {
            // Use bash on Linux/macOS to ensure PATH resolution of npm
            RunCommand("/usr/bin/env", $"bash -lc \"npm {npmArgs}\"", workingDir);
        }
    }

    private void WaitForServerStart(Process process, int port)
    {
        var timeout = DateTime.Now.AddSeconds(20);
        while (DateTime.Now < timeout)
        {
            var line = process.StandardOutput.ReadLine();
            if (line != null && line.Contains($"listening on http://localhost:{port}"))
                return;
            Thread.Sleep(100);
        }
        throw new Exception("Server did not start in time");
    }

    public void Dispose()
    {
        Client?.Dispose();
        
        if (_process != null && !_process.HasExited)
        {
            _process.Kill(true);
            _process.WaitForExit(3000);
        }
        
        // Clean up test data
        if (File.Exists(_eventFile))
            File.WriteAllText(_eventFile, string.Empty);
    }
}
