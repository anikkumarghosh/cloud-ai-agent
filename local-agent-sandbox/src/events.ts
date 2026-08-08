import { EventEmitter } from 'events';

export type AgentEventType =
  | 'agent_message'  // Replaced "agent_thought" for accurate terminology
  | 'tool_start'
  | 'sandbox_output' // Explicitly acknowledging this is bulk output, not a byte-stream
  | 'tool_end'
  | 'agent_finish'
  | 'agent_error';

export interface AgentEvent {
  runId: string;
  type: AgentEventType;
  timestamp: string;
  data: Record<string, any>;
}

export class AgentEventEmitter extends EventEmitter {
  private runId: string;

  constructor(runId: string) {
    super();
    this.runId = runId;
  }

  emitEvent(type: AgentEventType, data: Record<string, any>) {
    const event: AgentEvent = {
      runId: this.runId,
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    this.emit('agent_event', event);
  }
}