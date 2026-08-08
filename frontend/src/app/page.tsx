// // import Image from "next/image";

// // export default function Home() {
// //   return (
// //     <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
// //       <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
// //         <Image
// //           className="dark:invert h-5 w-[100px]"
// //           src="/next.svg"
// //           alt="Next.js logo"
// //           width={100}
// //           height={20}
// //           priority
// //         />
// //         <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
// //           <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
// //             To get started, edit the{" "}
// //             <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
// //               page.tsx
// //             </code>{" "}
// //             file.
// //           </h1>
// //           <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
// //             Looking for a starting point or more instructions? Head over to{" "}
// //             <a
// //               href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
// //               className="font-medium text-zinc-950 dark:text-zinc-50"
// //             >
// //               Templates
// //             </a>{" "}
// //             or the{" "}
// //             <a
// //               href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
// //               className="font-medium text-zinc-950 dark:text-zinc-50"
// //             >
// //               Learning
// //             </a>{" "}
// //             center.
// //           </p>
// //         </div>
// //         <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
// //           <a
// //             className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
// //             href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
// //             target="_blank"
// //             rel="noopener noreferrer"
// //           >
// //             <Image
// //               className="dark:invert h-[14px] w-4"
// //               src="/vercel.svg"
// //               alt="Vercel logomark"
// //               width={16}
// //               height={14}
// //             />
// //             Deploy Now
// //           </a>
// //           <a
// //             className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
// //             href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
// //             target="_blank"
// //             rel="noopener noreferrer"
// //           >
// //             Documentation
// //           </a>
// //         </div>
// //       </main>
// //     </div>
// //   );
// // }
// 'use client';

// import { useState, useEffect, useRef } from 'react';
// import { Play, Terminal, Brain, Wrench, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

// type AgentEventType = 'agent_message' | 'tool_start' | 'sandbox_output' | 'tool_end' | 'agent_finish' | 'agent_error';

// interface AgentEvent {
//   runId: string;
//   type: AgentEventType;
//   timestamp: string;
//   data: Record<string, any>;
// }

// export default function Dashboard() {
//   const [goal, setGoal] = useState('');
//   const [events, setEvents] = useState<AgentEvent[]>([]);
//   const [isRunning, setIsRunning] = useState(false);
//   const [wsReady, setWsReady] = useState(false);
//   const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  
//   const logsEndRef = useRef<HTMLDivElement>(null);

//   // Auto-scroll to bottom of logs
//   useEffect(() => {
//     logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [events]);

//   // Establish WebSocket connection
//   useEffect(() => {
//     const ws = new WebSocket('ws://localhost:4000');

//     ws.onopen = () => setWsReady(true);

//     ws.onmessage = (message) => {
//       try {
//         const event: AgentEvent = JSON.parse(message.data);
        
//         // Prevent older execution logs from ghosting into the current view
//         setEvents((prev) => [...prev, event]);
        
//         if (event.type === 'agent_finish' || event.type === 'agent_error') {
//           setIsRunning(false);
//         }
//       } catch (err) {
//         console.error('Failed to parse WS message:', err);
//       }
//     };

//     ws.onclose = () => setWsReady(false);

//     return () => ws.close();
//   }, []);

//   const handleRunAgent = async () => {
//     if (!goal.trim() || !wsReady) return;
    
//     const runId = `run_${Date.now()}`;
//     setCurrentRunId(runId);
//     setIsRunning(true);
//     setEvents([]);

//     try {
//       const response = await fetch('http://localhost:4000/api/agent/run', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ goal, runId }),
//       });

//       if (!response.ok) throw new Error('Failed to start orchestration');
//     } catch (error: any) {
//       setEvents((prev) => [
//         ...prev,
//         {
//           runId,
//           type: 'agent_error',
//           timestamp: new Date().toISOString(),
//           data: { message: error.message },
//         },
//       ]);
//       setIsRunning(false);
//     }
//   };

//   const renderEventIcon = (type: AgentEventType) => {
//     switch (type) {
//       case 'agent_message': return <Brain className="w-5 h-5 text-purple-400" />;
//       case 'tool_start': return <Wrench className="w-5 h-5 text-blue-400" />;
//       case 'sandbox_output': return <Terminal className="w-5 h-5 text-gray-400" />;
//       case 'agent_finish': return <CheckCircle className="w-5 h-5 text-green-400" />;
//       case 'agent_error': return <AlertTriangle className="w-5 h-5 text-red-400" />;
//       default: return <Terminal className="w-5 h-5 text-gray-400" />;
//     }
//   };

//   return (
//     <div className="flex h-screen bg-neutral-950 text-neutral-200 font-sans">
      
//       {/* LEFT COLUMN: Input & Control */}
//       <div className="w-1/3 border-r border-neutral-800 p-6 flex flex-col bg-neutral-900">
//         <h1 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
//           <Terminal className="w-6 h-6" /> Local Agent Platform
//         </h1>
        
//         <div className="flex-1 flex flex-col gap-4">
//           <label className="text-sm font-semibold text-neutral-400">Agent Goal / Task</label>
//           <textarea
//             className="w-full h-40 bg-neutral-950 border border-neutral-800 rounded-lg p-4 text-sm focus:outline-none focus:border-blue-500 resize-none"
//             placeholder="e.g., Create a python script that calculates factorials, run it, and save the output to a text file."
//             value={goal}
//             onChange={(e) => setGoal(e.target.value)}
//             disabled={isRunning}
//           />
          
//           <button
//             onClick={handleRunAgent}
//             disabled={isRunning || !goal.trim() || !wsReady}
//             className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-medium py-3 rounded-lg transition-colors"
//           >
//             {isRunning ? (
//               <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Orchestrating...</span>
//             ) : wsReady ? (
//               <><Play className="w-4 h-4" /> Start Execution</>
//             ) : (
//               <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Connecting WS...</span>
//             )}
//           </button>
//         </div>
//       </div>

//       {/* RIGHT COLUMN: Event Stream Log Viewer */}
//       <div className="w-2/3 flex flex-col bg-neutral-950 overflow-hidden">
//         <div className="border-b border-neutral-800 p-4 bg-neutral-900">
//           <h2 className="text-sm font-semibold text-neutral-400 tracking-wider uppercase">Execution Stream</h2>
//         </div>
        
//         <div className="flex-1 overflow-y-auto p-6 space-y-6">
//           {events.length === 0 ? (
//             <div className="text-neutral-600 italic text-sm text-center mt-20">
//               Waiting for tasks...
//             </div>
//           ) : (
//             events.map((event, index) => (
//               <div key={index} className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
//                 <div className="mt-1 flex-shrink-0">
//                   {renderEventIcon(event.type)}
//                 </div>
//                 <div className="flex-1 space-y-1">
//                   <div className="text-xs text-neutral-500 font-mono">
//                     [{new Date(event.timestamp).toLocaleTimeString()}] {event.type.toUpperCase()}
//                   </div>
                  
//                   {event.type === 'agent_message' && (
//                     <div className="text-neutral-300">{event.data.message}</div>
//                   )}
                  
//                   {event.type === 'tool_start' && (
//                     <div className="text-blue-300 font-mono text-sm bg-blue-950/30 p-2 rounded border border-blue-900/50">
//                       Calling {event.data.tool}({JSON.stringify(event.data.args)})
//                     </div>
//                   )}
                  
//                   {event.type === 'sandbox_output' && (
//                     <pre className="text-gray-300 font-mono text-xs bg-black p-3 rounded-md overflow-x-auto border border-neutral-800">
//                       {event.data.output}
//                     </pre>
//                   )}
                  
//                   {event.type === 'agent_finish' && (
//                     <div className="text-green-400 font-medium bg-green-950/30 p-3 rounded border border-green-900/50">
//                       {event.data.summary}
//                     </div>
//                   )}

//                   {event.type === 'agent_error' && (
//                     <div className="text-red-400 font-medium bg-red-950/30 p-3 rounded border border-red-900/50">
//                       {event.data.message}
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))
//           )}
//           <div ref={logsEndRef} />
//         </div>
//       </div>
//     </div>
//   );
// }
'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Terminal, Brain, Wrench, CheckCircle, AlertTriangle, Loader2, Code2, Square } from 'lucide-react';

type AgentEventType = 'agent_message' | 'tool_start' | 'sandbox_output' | 'tool_end' | 'agent_finish' | 'agent_error';

interface AgentEvent {
  runId: string;
  type: AgentEventType;
  timestamp: string;
  data: Record<string, any>;
}

export default function Dashboard() {
  const [goal, setGoal] = useState('');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [wsReady, setWsReady] = useState(false);
  
  // New Lifecycle States
  const [isSandboxActive, setIsSandboxActive] = useState(false);
  const [isIdeReady, setIsIdeReady] = useState(false);
  const [idePort, setIdePort] = useState<string | null>(null);

  // Preview states
  const [activeTab, setActiveTab] = useState<'ide' | 'preview'>('ide');
  const [previewKey, setPreviewKey] = useState(0);
  const [previewPort, setPreviewPort] = useState<{ containerPort: string; hostPort: string } | null>(null);
  const lastPreviewHostRef = useRef<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4000');
    ws.onopen = () => setWsReady(true);
    ws.onmessage = (message) => {
      try {
        const event: AgentEvent = JSON.parse(message.data);
        setEvents((prev) => [...prev, event]);
        if (event.type === 'agent_finish' || event.type === 'agent_error') {
          setIsRunning(false);
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };
    ws.onclose = () => setWsReady(false);
    return () => ws.close();
  }, []);

  // Poll until Code-Server responds before mounting the IDE iframe
  useEffect(() => {
    if (!isSandboxActive || isIdeReady) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const checkReady = async () => {
      try {
        // The IDE host port is auto-assigned by Docker, so ask the backend for it.
        const healthRes = await fetch('http://localhost:4000/api/health');
        const health = await healthRes.json();
        const port = health.idePort as string | null;
        if (port) {
          await fetch(`http://localhost:${port}`, { mode: 'no-cors' });
          if (!cancelled) {
            setIdePort(port);
            setIsIdeReady(true);
          }
        } else if (!cancelled) {
          retryTimer = setTimeout(checkReady, 2000);
        }
      } catch {
        if (!cancelled) retryTimer = setTimeout(checkReady, 2000);
      }
    };
    checkReady();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isSandboxActive, isIdeReady]);

  // Poll the backend for the live app preview port while the sandbox is active
  useEffect(() => {
    if (!isSandboxActive) return;
    let cancelled = false;

    const pollPreviewPort = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/sandbox/preview-port');
        if (!res.ok) throw new Error('Failed to poll preview port');
        const data = await res.json();
        if (!cancelled) setPreviewPort(data);
      } catch (err) {
        console.error('Failed to poll preview port:', err);
      }
    };

    pollPreviewPort();
    const interval = setInterval(pollPreviewPort, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isSandboxActive]);

  // Remount the preview iframe whenever the detected host port changes
  useEffect(() => {
    if (previewPort) {
      if (lastPreviewHostRef.current !== previewPort.hostPort) {
        lastPreviewHostRef.current = previewPort.hostPort;
        setPreviewKey((k) => k + 1);
      }
    } else {
      lastPreviewHostRef.current = null;
    }
  }, [previewPort]);

  const handleRunAgent = async () => {
    if (!goal.trim() || !wsReady) return;

    const runId = `run_${Date.now()}`;
    setIsRunning(true);

    // If sandbox isn't active, we are booting it now. Trigger IDE loading sequence.
    if (!isSandboxActive) {
      setIsSandboxActive(true);
      setIsIdeReady(false);
    }

    try {
      const response = await fetch('http://localhost:4000/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, runId }),
      });
      if (!response.ok) throw new Error('Failed to start orchestration');
    } catch (error: any) {
      setEvents((prev) => [
        ...prev,
        { runId, type: 'agent_error', timestamp: new Date().toISOString(), data: { message: error.message } },
      ]);
      setIsRunning(false);
    }
  };

  const handleStopEnvironment = async () => {
    try {
      await fetch('http://localhost:4000/api/sandbox/stop', { method: 'POST' });
      setIsSandboxActive(false);
      setIsIdeReady(false);
      setIsRunning(false);
      setIdePort(null);
      setPreviewPort(null);
      lastPreviewHostRef.current = null;
      setEvents((prev) => [
        ...prev,
        { runId: 'system', type: 'agent_message', timestamp: new Date().toISOString(), data: { message: 'Environment manually stopped and destroyed.' } }
      ]);
    } catch (error) {
      console.error("Failed to stop environment", error);
    }
  };

  const renderEventIcon = (type: AgentEventType) => {
    switch (type) {
      case 'agent_message': return <Brain className="w-4 h-4 text-purple-400" />;
      case 'tool_start': return <Wrench className="w-4 h-4 text-blue-400" />;
      case 'sandbox_output': return <Terminal className="w-4 h-4 text-gray-400" />;
      case 'agent_finish': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'agent_error': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default: return <Terminal className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-200 font-sans overflow-hidden">
      
      {/* LEFT COLUMN: Input & Control */}
      <div className="w-[30%] border-r border-neutral-800 flex flex-col bg-neutral-900 z-10 shadow-xl">
        <div className="p-6 border-b border-neutral-800">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5" /> Agent Platform
          </h1>
        </div>
        
        <div className="p-6 flex-1 flex flex-col gap-4">
          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Agent Task</label>
          <textarea
            className="w-full h-40 bg-neutral-950 border border-neutral-800 rounded-lg p-4 text-sm focus:outline-none focus:border-blue-500 resize-none shadow-inner"
            placeholder="e.g., Create a complex python script and run it."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={isRunning}
          />
          
          <div className="flex gap-2">
            <button
              onClick={handleRunAgent}
              disabled={isRunning || !goal.trim() || !wsReady}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-medium py-3 rounded-lg transition-colors shadow-lg"
            >
              {isRunning ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Working...</span>
              ) : (
                <><Play className="w-4 h-4" /> Run Task</>
              )}
            </button>
            
            {isSandboxActive && (
              <button
                onClick={handleStopEnvironment}
                className="px-4 flex items-center justify-center gap-2 bg-red-950/50 hover:bg-red-900/50 text-red-400 border border-red-900/50 font-medium rounded-lg transition-colors"
                title="Destroy Sandbox"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Split View */}
      <div className="w-[70%] flex flex-col">
        
        {/* TOP HALF: Event Stream */}
        <div className="h-[40%] flex flex-col border-b border-neutral-800 bg-neutral-950">
          <div className="p-3 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase flex items-center gap-2">
              <Terminal className="w-3 h-3" /> Execution Stream
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {events.length === 0 ? (
              <div className="text-neutral-600 italic text-xs text-center mt-10">Awaiting tasks...</div>
            ) : (
              events.map((event, index) => (
                <div key={index} className="flex gap-3 text-sm animate-in fade-in">
                  <div className="mt-0.5">{renderEventIcon(event.type)}</div>
                  <div className="flex-1 space-y-1">
                    {event.type === 'agent_message' && <div className="text-neutral-300">{event.data.message}</div>}
                    {event.type === 'tool_start' && (
                      <div className="text-blue-300 font-mono text-xs bg-blue-950/20 p-2 rounded border border-blue-900/30">
                        {event.data.tool}({JSON.stringify(event.data.args)})
                      </div>
                    )}
                    {event.type === 'sandbox_output' && (
                      <pre className="text-gray-400 font-mono text-[11px] bg-black p-2 rounded overflow-x-auto border border-neutral-800">
                        {event.data.output}
                      </pre>
                    )}
                    {event.type === 'agent_finish' && <div className="text-green-400 text-xs font-medium">{event.data.summary}</div>}
                    {event.type === 'agent_error' && <div className="text-red-400 text-xs font-medium">{event.data.message}</div>}
                  </div>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* BOTTOM HALF: Web IDE + Live Preview */}
        <div className="h-[60%] flex flex-col bg-[#1e1e1e]">
          <div className="p-3 bg-[#252526] border-b border-[#333333] flex items-center gap-1">
            <button
              onClick={() => setActiveTab('ide')}
              className={`text-xs font-semibold tracking-wider uppercase flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
                activeTab === 'ide'
                  ? 'bg-[#37373d] text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Code2 className="w-3 h-3" /> Workspace IDE
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`text-xs font-semibold tracking-wider uppercase flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
                activeTab === 'preview'
                  ? 'bg-[#37373d] text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Play className="w-3 h-3" /> Live App Preview
              {previewPort && (
                <span className="ml-1 text-[10px] bg-emerald-900 text-emerald-300 px-1.5 py-0.5 rounded">
                  ● Port {previewPort.containerPort}
                </span>
              )}
            </button>
          </div>
          <div className="flex-1 relative">
            {activeTab === 'ide' ? (
              !isSandboxActive ? (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-sm italic">
                  Environment inactive. Click Run Task to boot sandbox.
                </div>
              ) : !isIdeReady ? (
                <div className="absolute inset-0 flex items-center justify-center text-blue-400 text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Booting VS Code Server...
                </div>
              ) : (
                <iframe
                  src={idePort ? `http://localhost:${idePort}` : 'about:blank'}
                  className="absolute inset-0 w-full h-full border-none"
                  title="Workspace IDE"
                />
              )
            ) : previewPort ? (
              <iframe
                key={previewKey}
                src={`http://localhost:${previewPort.hostPort}`}
                className="absolute inset-0 w-full h-full border-none"
                title="Live Preview"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-sm italic bg-[#1e1e1e]">
                No live server detected yet. Waiting for the agent to start one...
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}