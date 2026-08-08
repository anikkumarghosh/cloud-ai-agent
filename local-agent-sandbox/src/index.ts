import path from 'path';
import dotenv from 'dotenv';
import { SandboxManager } from './SandboxManager';
import { Agent } from './Agent';
import { AgentEventEmitter } from './events';

dotenv.config();

async function runDay3ToolLayerTest() {
  console.log('=== Day 3: Modular Tool Layer Verification ===\n');

  const workspacePath = path.join(__dirname, '..', 'workspace');

  const sandbox = new SandboxManager({
    image: 'python:3.12-slim',
    workspaceHostPath: workspacePath,
  });

  try {
    await sandbox.create();
    const emitter = new AgentEventEmitter(`run-${Date.now()}`);
    const agent = new Agent(sandbox, emitter);

    const goal = `1. Write a python file 'calculator.py' with a function that adds two numbers.
2. Initialize a git repository in /workspace using execute_bash.
3. List the directory contents using list_dir.
4. Check git_status and then commit the file using git_commit with message "Add calculator module".`;

    await agent.runTask(goal);
  } catch (error) {
    console.error('[Fatal Error]:', error);
  } finally {
    console.log('\n--- Cleanup Phase ---');
    await sandbox.destroy();
    console.log('\n=== Day 3 Tool Layer Verification Complete ===');
  }
}

runDay3ToolLayerTest();