import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { SandboxManager } from './SandboxManager';
import { Agent } from './Agent';
import { AgentEventEmitter, AgentEvent } from './events';

dotenv.config();

const PORT = 4000;
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const workspacePath = path.join(__dirname, '..', 'workspace');

// SINGLETON SANDBOX MANAGER: Persists across HTTP requests
const sandbox = new SandboxManager({
  image: 'local-ai-sandbox:latest',
  workspaceHostPath: workspacePath,
});

function broadcast(event: AgentEvent) {
  const payload = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// REST: Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', sandboxRunning: sandbox.isRunning });
});

// REST: Explicitly stop the sandbox
app.post('/api/sandbox/stop', async (req, res) => {
  try {
    if (sandbox.isRunning) {
      await sandbox.destroy();
    }
    res.json({ status: 'stopped' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// REST: Start the Agent Orchestrator
app.post('/api/agent/run', async (req, res) => {
  const { goal, runId } = req.body;

  if (!goal || !runId) {
    return res.status(400).json({ error: 'Fields "goal" and "runId" are required.' });
  }

  res.json({ status: 'orchestration_started', runId, goal });

  const emitter = new AgentEventEmitter(runId);
  emitter.on('agent_event', (event: AgentEvent) => {
    broadcast(event);
  });

  try {
    // Only create the sandbox if it isn't already running
    if (!sandbox.isRunning) {
      await sandbox.create();
    }

    const agent = new Agent(sandbox, emitter);
    await agent.runTask(goal);
  } catch (err: any) {
    emitter.emitEvent('agent_error', { message: err.message });
  }
  // NOTICE: We removed the `finally { sandbox.destroy() }` block.
  // The container remains alive so the user can use the IDE.
});

wss.on('connection', (ws) => {
  console.log('[WebSocket] UI Client connected on port 4000.');
  ws.send(JSON.stringify({
    runId: 'system',
    type: 'agent_message',
    timestamp: new Date().toISOString(),
    data: { message: 'System: WebSocket Event Bus Connected.' },
  }));
});

server.listen(PORT, () => {
  console.log(`🚀 Backend Core running on http://localhost:${PORT}`);
});
