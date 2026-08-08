import { ChatCompletionTool } from 'groq-sdk/resources/chat/completions';
import { SandboxManager } from '../SandboxManager';

export const gitToolDeclarations: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'git_clone',
      description: 'Clones a Git repository into /workspace.',
      parameters: {
        type: 'object',
        properties: {
          repoUrl: { type: 'string', description: 'Git clone URL (HTTPS or SSH format).' },
          targetFolder: { type: 'string', description: 'Optional directory name to clone into.' }
        },
        required: ['repoUrl']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Returns the current git status and modified files in /workspace.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_commit',
      description: 'Stages modified files and creates a git commit in /workspace.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message describing changes.' },
          authorName: { type: 'string', description: 'Author name (default: "AI Agent").' },
          authorEmail: { type: 'string', description: 'Author email (default: "agent@local.internal").' }
        },
        required: ['message']
      }
    }
  }
];

async function ensureGitInstalled(sandbox: SandboxManager): Promise<void> {
  const checkGit = await sandbox.exec('git --version');
  if (checkGit.exitCode !== 0) {
    console.log('[Tool Registry] Git not found in container. Installing...');
    await sandbox.exec('apt-get update && apt-get install -y git', 30000);
  }
}

export async function gitClone(sandbox: SandboxManager, args: { repoUrl: string; targetFolder?: string }) {
  await ensureGitInstalled(sandbox);
  const target = args.targetFolder ? `/workspace/${args.targetFolder}` : '/workspace';
  const res = await sandbox.exec(`git clone ${args.repoUrl} ${target}`, 30000);
  return res.exitCode === 0 ? `Cloned successfully:\n${res.stdout}` : `Git clone failed:\n${res.stderr}`;
}

export async function gitStatus(sandbox: SandboxManager) {
  await ensureGitInstalled(sandbox);
  const res = await sandbox.exec('git status');
  return res.exitCode === 0 ? res.stdout : `Git status error:\n${res.stderr}`;
}

export async function gitCommit(sandbox: SandboxManager, args: { message: string; authorName?: string; authorEmail?: string }) {
  await ensureGitInstalled(sandbox);
  const name = args.authorName || 'AI Agent';
  const email = args.authorEmail || 'agent@local.internal';

  const setupCmd = `git config user.name "${name}" && git config user.email "${email}"`;
  await sandbox.exec(setupCmd);

  const addRes = await sandbox.exec('git add .');
  if (addRes.exitCode !== 0) return `Failed to stage files:\n${addRes.stderr}`;

  const commitRes = await sandbox.exec(`git commit -m "${args.message}"`);
  return commitRes.exitCode === 0 ? `Commit successful:\n${commitRes.stdout}` : `Commit failed:\n${commitRes.stderr}`;
}
