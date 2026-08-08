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
  private docker: Docker;
  private container: Docker.Container | null = null;
  private config: Required<SandboxConfig>;

  get isRunning(): boolean {
    return this.container !== null;
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

    console.log(`[Sandbox] Spawning container with workspace: ${this.config.workspaceHostPath}`);

    const cpuQuota = Math.floor(100000 * this.config.cpuQuotaCoreRatio);

    this.container = await this.docker.createContainer({
      Image: this.config.image,
      Cmd: ['/bin/sh', '-c', 'code-server --auth none --bind-addr 0.0.0.0:8080 /workspace & tail -f /dev/null'],
      Tty: false,
      WorkingDir: '/workspace',
      ExposedPorts: {
        '8080/tcp': {} // Expose Web IDE port
      },
      HostConfig: {
        Binds: [`${this.config.workspaceHostPath}:/workspace`],
        PortBindings: {
          '8080/tcp': [{ HostPort: '8080' }] // Map to host localhost:8080
        },
        Memory: this.config.memoryLimitMB * 1024 * 1024,
        CpuPeriod: 100000,
        CpuQuota: cpuQuota,
      },
    });

    await this.container.start();
    console.log(`[Sandbox] Container started (ID: ${this.container.id.substring(0, 12)})`);
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