// import Groq from 'groq-sdk';
// import { SandboxManager } from './SandboxManager';
// import { allTools, executeTool } from './tools';
// import { AgentEventEmitter } from './events';

// export class Agent {
//   private groq: Groq;
//   private sandbox: SandboxManager;
//   private contextHistory: any[] = [];
//   private emitter: AgentEventEmitter;

//   constructor(sandbox: SandboxManager, emitter: AgentEventEmitter) {
//     if (!process.env.GROQ_API_KEY) {
//       throw new Error('Missing GROQ_API_KEY in environment variables.');
//     }
//     this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
//     this.sandbox = sandbox;
//     this.emitter = emitter;
//   }

//   private initializeContext() {
//     this.contextHistory = [
//       {
//         role: 'system',
//         content: `You are an elite, autonomous AI software engineer.
//                   You have full access to an isolated Ubuntu workspace (/workspace).
//                   You can manipulate files, run bash scripts, list directories, and manage Git repositories using your available tools.
//                   Think step-by-step. Verify your actions.
//                   When finished, summarize your work clearly without invoking more tools.`
//       }
//     ];
//   }

//   async runTask(userGoal: string) {
//     this.initializeContext();
//     this.contextHistory.push({ role: 'user', content: userGoal });

//     let isTaskComplete = false;
//     let loopCount = 0;
//     const MAX_LOOPS = 15;

//     this.emitter.emitEvent('agent_thought', { message: `Goal received: "${userGoal}"` });

//     while (!isTaskComplete && loopCount < MAX_LOOPS) {
//       loopCount++;

//       const response = await this.groq.chat.completions.create({
//         model: 'llama-3.3-70b-versatile',
//         messages: this.contextHistory,
//         tools: allTools,
//         tool_choice: 'auto'
//       });

//       const responseMessage = response.choices[0].message;
//       this.contextHistory.push(responseMessage);

//       if (responseMessage.content) {
//         this.emitter.emitEvent('agent_thought', { message: responseMessage.content.trim() });
//       }

//       if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
//         for (const toolCall of responseMessage.tool_calls) {
//           const fnName = toolCall.function.name;
//           const args = JSON.parse(toolCall.function.arguments);

//           this.emitter.emitEvent('tool_start', {
//             tool: fnName,
//             args,
//             callId: toolCall.id,
//           });

//           const toolResult = await executeTool(this.sandbox, fnName, args);

//           this.emitter.emitEvent('sandbox_output', {
//             tool: fnName,
//             output: toolResult,
//           });

//           this.emitter.emitEvent('tool_end', {
//             tool: fnName,
//             callId: toolCall.id,
//           });

//           this.contextHistory.push({
//             tool_call_id: toolCall.id,
//             role: 'tool',
//             name: fnName,
//             content: toolResult
//           });
//         }
//       } else {
//         isTaskComplete = true;
//         this.emitter.emitEvent('agent_finish', {
//           summary: responseMessage.content || 'Task completed successfully.'
//         });
//       }
//     }

//     if (loopCount >= MAX_LOOPS) {
//       this.emitter.emitEvent('agent_error', { message: 'Maximum loop count reached.' });
//     }
//   }
// }

import Groq from 'groq-sdk';
import { SandboxManager } from './SandboxManager';
import { allTools, executeTool } from './tools';
import { AgentEventEmitter } from './events';

export class Agent {
  private groq: Groq;
  private sandbox: SandboxManager;
  private contextHistory: any[] = [];
  private emitter: AgentEventEmitter;

  constructor(sandbox: SandboxManager, emitter: AgentEventEmitter) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('Missing GROQ_API_KEY in environment variables.');
    }
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.sandbox = sandbox;
    this.emitter = emitter;
  }

  private initializeContext() {
    this.contextHistory = [
      {
        role: 'system',
        content: `You are an elite, autonomous AI software engineer.
                  You have full access to an isolated Ubuntu workspace (/workspace).
                  You can manipulate files, run bash scripts, list directories, and manage Git repositories using your available tools.
                  Think step-by-step. Verify your actions.
                  When finished, summarize your work clearly without invoking more tools.`
      }
    ];
  }

  async runTask(userGoal: string) {
    this.initializeContext();
    this.contextHistory.push({ role: 'user', content: userGoal });

    let isTaskComplete = false;
    let loopCount = 0;
    const MAX_LOOPS = 15;

    this.emitter.emitEvent('agent_message', { message: `Goal received: "${userGoal}"` });

    while (!isTaskComplete && loopCount < MAX_LOOPS) {
      loopCount++;

      const response = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: this.contextHistory,
        tools: allTools,
        tool_choice: 'auto'
      });

      const responseMessage = response.choices[0].message;
      this.contextHistory.push(responseMessage);

      if (responseMessage.content) {
        this.emitter.emitEvent('agent_message', { message: responseMessage.content.trim() });
      }

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const toolCall of responseMessage.tool_calls) {
          const fnName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          this.emitter.emitEvent('tool_start', {
            tool: fnName,
            args,
            callId: toolCall.id,
          });

          // Block execution: waits for the command to finish completely
          const toolResult = await executeTool(this.sandbox, fnName, args);

          // Emits the bulk output block
          this.emitter.emitEvent('sandbox_output', {
            tool: fnName,
            output: toolResult,
          });

          this.emitter.emitEvent('tool_end', {
            tool: fnName,
            callId: toolCall.id,
          });

          this.contextHistory.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: fnName,
            content: toolResult
          });
        }
      } else {
        isTaskComplete = true;
        this.emitter.emitEvent('agent_finish', {
          summary: responseMessage.content || 'Task completed successfully.'
        });
      }
    }

    if (loopCount >= MAX_LOOPS) {
      this.emitter.emitEvent('agent_error', { message: 'Maximum loop count reached. Forced stop.' });
    }
  }
}