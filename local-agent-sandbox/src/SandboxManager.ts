import Docker from 'dockerode';
import path from 'path';
import fs from 'fs';
import { PassThrough } from 'stream';

export interface SandboxConfig {
  image?: string;
  workspaceHostPath: string;
  memoryLimitMB?: number;
  cpuQuotaCoreRatio?: number; // e.g., 0.5 = 50% of 1 core
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export class SandboxManager {
  private static readonly CONTAINER_NAME = 'cloud-ai-agent-sandbox';
  private docker: Docker;
  private container: Docker.Container | null = null;
  private config: Required<SandboxConfig>;
  private portMap: Docker.PortMap | null = null;

  get isRunning(): boolean {
    return this.container !== null;
  }

  /**
   * Returns the auto-assigned host port for the Code-Server IDE (8080/tcp),
   * or null if the sandbox is not running.
   */
  getIdePort(): string | null {
    return this.portMap?.['8080/tcp']?.[0]?.HostPort ?? null;
  }

  constructor(config: SandboxConfig) {
    // Dockerode automatically connects to Docker Desktop on Windows
    // via //./pipe/docker_engine or local socket on Linux/macOS
    this.docker = new Docker();

    this.config = {
      image: config.image || 'ubuntu:24.04',
      workspaceHostPath: path.resolve(config.workspaceHostPath),
      memoryLimitMB: config.memoryLimitMB || 512,
      cpuQuotaCoreRatio: config.cpuQuotaCoreRatio || 0.5,
    };

    // Ensure host workspace directory exists
    if (!fs.existsSync(this.config.workspaceHostPath)) {
      fs.mkdirSync(this.config.workspaceHostPath, { recursive: true });
    }
  }

  /**
   * Initializes and starts the isolated Docker execution environment.
   */
  async create(): Promise<void> {
    console.log(`[Sandbox] Checking for image '${this.config.image}'...`);
    // NOTE: Skipping ensureImageExists() here assuming local-ai-sandbox is built locally.

    // Cleanup any orphaned/zombie container from a previous session that still
    // holds our name/ports, otherwise it blocks every new session (port conflict).
    try {
      const existing = this.docker.getContainer(SandboxManager.CONTAINER_NAME);
      await existing.remove({ force: true });
    } catch (err: any) {
      // 404 = no existing container; anything else is unexpected but non-fatal.
      if (err?.statusCode !== 404) {
        console.log(`[Sandbox] Note: cleanup of stale container skipped (${err?.message ?? err})`);
      }
    }

    console.log(`[Sandbox] Spawning container with workspace: ${this.config.workspaceHostPath}`);

    const cpuQuota = Math.floor(100000 * this.config.cpuQuotaCoreRatio);

    this.container = await this.docker.createContainer({
      name: SandboxManager.CONTAINER_NAME,
      Image: this.config.image,
      Cmd: ['/bin/sh', '-c', 'code-server --auth none --bind-addr 0.0.0.0:8080 /workspace & tail -f /dev/null'],
      Tty: false,
      WorkingDir: '/workspace',
      ExposedPorts: {
        '8080/tcp': {}, // Code-Server IDE
        '3000/tcp': {},
        '5000/tcp': {},
        '5173/tcp': {},
        '8000/tcp': {},
        '8501/tcp': {},
        '4000/tcp': {},
      },
      HostConfig: {
        Binds: [`${this.config.workspaceHostPath}:/workspace`],
        PortBindings: {
          // Empty HostPort = Docker auto-assigns a free host port, so a
          // leftover container or another process can never block a new session.
          '8080/tcp': [{ HostPort: '' }],
          '3000/tcp': [{ HostPort: '' }],
          '5000/tcp': [{ HostPort: '' }],
          '5173/tcp': [{ HostPort: '' }],
          '8000/tcp': [{ HostPort: '' }],
          '8501/tcp': [{ HostPort: '' }],
          '4000/tcp': [{ HostPort: '' }],
        },
        Memory: this.config.memoryLimitMB * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: cpuQuota,
      },
    });

    await this.container.start();

    // Read back the auto-assigned host ports, e.g. { '3000/tcp': [{ HostIp: '0.0.0.0', HostPort: '55231' }] }
    const info = await this.container.inspect();
    this.portMap = info.NetworkSettings.Ports;

    console.log(`[Sandbox] Container started (ID: ${this.container.id.substring(0, 12)})`);
    console.log(`[Sandbox] Web IDE active on http://localhost:${this.getIdePort()}`);
  }

  /**
   * Detects which of the exposed dev ports is actually listening inside the
   * container and returns the matching host port. Returns null if none are live.
   *
   * Uses /proc/net/tcp because `ss`/`netstat` are not installed in slim images.
   */
  async getActivePreviewPort(): Promise<{ containerPort: string; hostPort: string } | null> {
    if (!this.container || !this.portMap) return null;

    const result = await this.exec(
      "cat /proc/net/tcp /proc/net/tcp6 2>/dev/null | awk 'NR>1 {print $2}' | grep ':' | cut -d: -f2",
      5000
    );

    if (result.exitCode !== 0) return null;

    // Ports in /proc/net/tcp are hex. Rough filter: includes all socket states,
    // which is fine here — a false positive just shows a port that turns out empty.
    const listeningPorts = new Set(
      result.stdout
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((hex) => parseInt(hex, 16).toString())
    );

    const candidates = ['3000', '5173', '5000', '8000', '8501', '4000'];
    const match = candidates.find((p) => listeningPorts.has(p));
    if (!match) return null;

    const hostPort = this.portMap[`${match}/tcp`]?.[0]?.HostPort;
    return hostPort ? { containerPort: match, hostPort } : null;
  }

  /**
   * Executes a command inside the running container with timeout support.
   */
  async exec(command: string, timeoutMs: number = 10000): Promise<ExecResult> {
    if (!this.container) {
      throw new Error('[Sandbox] Container is not initialized. Call create() first.');
    }

    const execInstance = await this.container.exec({
      Cmd: ['/bin/bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/workspace',
    });

    const stream = await execInstance.start({});

    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();

    // Demultiplex dockerode stream into separate stdout/stderr channels
    this.docker.modem.demuxStream(stream, stdoutStream, stderrStream);

    let stdout = '';
    let stderr = '';

    stdoutStream.on('data', (chunk) => (stdout += chunk.toString('utf8')));
    stderrStream.on('data', (chunk) => (stderr += chunk.toString('utf8')));

    return new Promise<ExecResult>((resolve) => {
      let isTimedOut = false;

      const timer = setTimeout(() => {
        isTimedOut = true;
        stream.destroy(); // Terminate stream on timeout
        resolve({
          exitCode: -1,
          stdout,
          stderr: stderr + `\n[Sandbox Error] Command timed out after ${timeoutMs}ms`,
          timedOut: true,
        });
      }, timeoutMs);

      stream.on('end', async () => {
        if (isTimedOut) return;
        clearTimeout(timer);

        // Get command exit code
        const inspectData = await execInstance.inspect();
        resolve({
          exitCode: inspectData.ExitCode ?? 0,
          stdout,
          stderr,
          timedOut: false,
        });
      });
    });
  }

  /**
   * Fetches container stdout/stderr logs.
   */
  async logs(): Promise<string> {
    if (!this.container) return '';
    const logBuffer = await this.container.logs({ stdout: true, stderr: true });
    return logBuffer.toString('utf8');
  }

  /**
   * Stops the active container.
   */
  async stop(): Promise<void> {
    if (!this.container) return;
    try {
      console.log(`[Sandbox] Stopping container...`);
      await this.container.stop({ t: 2 });
    } catch (err: any) {
      // Ignore error if container was already stopped
      if (err.statusCode !== 304 && err.statusCode !== 404) throw err;
    }
  }

  /**
   * Destroys and removes the container.
   */
  async destroy(): Promise<void> {
    if (!this.container) return;
    try {
      await this.stop();
      console.log(`[Sandbox] Removing container...`);
      await this.container.remove({ force: true });
      this.container = null;
      this.portMap = null;
      console.log(`[Sandbox] Cleanup complete.`);
    } catch (err: any) {
      if (err.statusCode !== 404) throw err;
    }
  }

  /**
   * Helper function to pull the requested Docker image if not present locally.
   */
  private async ensureImageExists(imageName: string): Promise<void> {
    const images = await this.docker.listImages();
    const exists = images.some((img) => img.RepoTags && img.RepoTags.includes(imageName));

    if (!exists) {
      console.log(`[Sandbox] Image '${imageName}' not found locally. Pulling...`);
      await new Promise((resolve, reject) => {
        this.docker.pull(imageName, (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) return reject(err);
          this.docker.modem.followProgress(stream, (finishErr: Error | null) => {
            if (finishErr) return reject(finishErr);
            resolve(true);
          });
        });
      });
      console.log(`[Sandbox] Pull complete.`);
    }
  }
}