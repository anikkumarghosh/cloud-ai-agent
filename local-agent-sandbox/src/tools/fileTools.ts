import { ChatCompletionTool } from 'groq-sdk/resources/chat/completions';
import { SandboxManager } from '../SandboxManager';

export const fileToolDeclarations: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Creates or overwrites a file in /workspace with the specified content.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path (e.g., src/index.js or config.json).' },
          content: { type: 'string', description: 'Complete content to write into the file.' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Reads the contents of a file in /workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path to read.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'Lists files and directories in /workspace or a subfolder.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative directory path (default: ".").' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Deletes a file or directory inside /workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file or directory path to delete.' }
        },
        required: ['path']
      }
    }
  }
];

export async function writeFile(sandbox: SandboxManager, args: { path?: string; filename?: string; content: string }) {
  const filePath = args.path ?? args.filename;
  if (!filePath) {
    return 'Error: Missing file path.';
  }

  const dirPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
  if (dirPath) {
    await sandbox.exec(`mkdir -p /workspace/${dirPath}`);
  }

  const delimiter = 'AGENT_EOF_' + Math.random().toString(36).slice(2, 8);
  const res = await sandbox.exec(`cat << '${delimiter}' > /workspace/${filePath}\n${args.content}\n${delimiter}`);
  return res.exitCode === 0
    ? `Successfully wrote file: ${filePath}`
    : `Error writing file: ${res.stderr}`;
}

export async function readFile(sandbox: SandboxManager, args: { path?: string; filename?: string }) {
  const filePath = args.path ?? args.filename;
  if (!filePath) {
    return 'Error: Missing file path.';
  }

  const res = await sandbox.exec(`cat /workspace/${filePath}`);
  return res.exitCode === 0 ? res.stdout : `Error reading file: ${res.stderr}`;
}

export async function listDir(sandbox: SandboxManager, args: { path?: string }) {
  const target = args.path || '.';
  const res = await sandbox.exec(`ls -la /workspace/${target}`);
  return res.exitCode === 0 ? res.stdout : `Error listing directory: ${res.stderr}`;
}

export async function deleteFile(sandbox: SandboxManager, args: { path?: string; filename?: string }) {
  const filePath = args.path ?? args.filename;
  if (!filePath) {
    return 'Error: Missing file path.';
  }

  const res = await sandbox.exec(`rm -rf /workspace/${filePath}`);
  return res.exitCode === 0
    ? `Successfully deleted: ${filePath}`
    : `Error deleting: ${res.stderr}`;
}
