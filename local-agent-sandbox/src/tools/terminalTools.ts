import { ChatCompletionTool } from 'groq-sdk/resources/chat/completions';
import { SandboxManager } from '../SandboxManager';

export const terminalToolDeclarations: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'execute_bash',
      description: 'Executes a bash command in /workspace. Use for running scripts, installing packages, or system tasks.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The bash command to execute.' },
          timeoutMs: { type: 'number', description: 'Optional timeout in milliseconds (default: 15000).' }
        },
        required: ['command']
      }
    }
  }
];

export async function executeBash(sandbox: SandboxManager, args: { command: string; timeoutMs?: number }) {
  const timeout = args.timeoutMs ?? 15000;
  const res = await sandbox.exec(args.command, timeout);
  return `Exit Code: ${res.exitCode}\nTimed Out: ${res.timedOut}\nStdout:\n${res.stdout}\nStderr:\n${res.stderr}`;
}
