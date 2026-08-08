import { ChatCompletionTool } from 'groq-sdk/resources/chat/completions';
import { SandboxManager } from '../SandboxManager';
import { terminalToolDeclarations, executeBash } from './terminalTools';
import { fileToolDeclarations, writeFile, readFile, listDir, deleteFile } from './fileTools';
import { gitToolDeclarations, gitClone, gitStatus, gitCommit } from './gitTools';

export const allTools: ChatCompletionTool[] = [
  ...terminalToolDeclarations,
  ...fileToolDeclarations,
  ...gitToolDeclarations
];

export async function executeTool(sandbox: SandboxManager, toolName: string, args: any): Promise<string> {
  switch (toolName) {
    case 'execute_bash':
      return await executeBash(sandbox, args);
    case 'write_file':
      return await writeFile(sandbox, args);
    case 'read_file':
      return await readFile(sandbox, args);
    case 'list_dir':
      return await listDir(sandbox, args);
    case 'delete_file':
      return await deleteFile(sandbox, args);
    case 'git_clone':
      return await gitClone(sandbox, args);
    case 'git_status':
      return await gitStatus(sandbox);
    case 'git_commit':
      return await gitCommit(sandbox, args);
    default:
      return `Error: Unknown tool '${toolName}' requested.`;
  }
}
