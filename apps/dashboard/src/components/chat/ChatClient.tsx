"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type Agent = { id: string; name: string; provider: string; mode: string; model?: string; roleType: string };
type ChatMessage = { id: string; role: "user" | "assistant" | "system" | "tool"; content: string; createdAt: string };
type ChatSession = { id: string; title: string; agentRoleId: string | null; messages: ChatMessage[] };
type Diagnostics = {
  roles: number;
  apiKeys: string[];
  local: { claude: boolean; codex: boolean };
  onlineDevices: Array<{ name: string; claudeAvailable: boolean; codexAvailable: boolean; lastSeenAt: string | null }>;
};

export function ChatClient() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const [agentRes, sessionRes] = await Promise.all([
      fetch("/api/agents/available"),
      fetch("/api/chat/sessions"),
    ]);
    const agentBody = await agentRes.json();
    const sessionBody = await sessionRes.json();
    const nextAgents = agentBody.agents ?? [];
    setAgents(nextAgents);
    setDiagnostics(agentBody.diagnostics ?? null);
    setSessions(Array.isArray(sessionBody) ? sessionBody : []);
    setSelectedAgentId((prev) => prev || nextAgents[0]?.id || "");
  }

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null,
    [sessions, selectedSessionId]
  );
  const messages = selectedSession?.messages ?? [];
  const canSend = agents.length > 0 && selectedAgentId && input.trim().length > 0 && !pending;

  function send() {
    if (!canSend) return;
    const message = input.trim();
    setInput("");
    startTransition(async () => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSession?.id,
          agentRoleId: selectedAgentId,
          message,
        }),
      });
      const body = await res.json();
      await refresh();
      if (body.sessionId) setSelectedSessionId(body.sessionId);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 min-h-[calc(100vh-7rem)]">
      <aside className="rounded-xl border bg-card p-4">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">Agent</p>
          {agents.length > 0 ? (
            <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)} className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text">
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name} · {agent.provider} · {agent.mode}</option>
              ))}
            </select>
          ) : (
            <div className="rounded-lg border border-in-progress/30 bg-in-progress/10 p-3 text-xs text-in-progress">
              Dashboard-run needs an API key. Local-run does not need an API key, but it must see a bridge heartbeat.
            </div>
          )}
        </div>

        {agents.length === 0 && (
          <div className="mb-4 rounded-lg border border-border bg-bg-base p-3 text-xs text-text-muted">
            <p className="font-semibold text-text">Local bridge</p>
            <p className="mt-1">Set `BRIDGE_TOKEN` from Settings, then run:</p>
            <code className="mt-2 block rounded bg-card px-2 py-1 text-[10px] text-accent">python hooks/bridge-heartbeat.py</code>
            <p className="mt-2">Claude online: {diagnostics?.local.claude ? "yes" : "no"} · Codex online: {diagnostics?.local.codex ? "yes" : "no"}</p>
            <p>Roles: {diagnostics?.roles ?? 0} · API keys: {diagnostics?.apiKeys.length ?? 0}</p>
            <a href="/settings" className="mt-2 inline-block text-accent">Open Settings</a>
          </div>
        )}

        <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">History</p>
        <div className="flex flex-col gap-1.5">
          {sessions.length === 0 ? (
            <p className="text-xs text-text-muted">No conversations yet.</p>
          ) : sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setSelectedSessionId(session.id)}
              className={`rounded-lg px-3 py-2 text-left text-xs transition-colors ${selectedSession?.id === session.id ? "bg-accent/15 text-accent" : "text-text-muted hover:bg-card-hover hover:text-text"}`}
            >
              {session.title}
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-xl border bg-card flex min-h-[600px] flex-col">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-text-muted">
              {agents.length === 0 ? (
                <div className="max-w-lg rounded-xl border border-border bg-bg-base p-5">
                  <p className="font-semibold text-text">No available agents yet.</p>
                  <p className="mt-2">For local Claude/Codex, add a bridge token in Settings and run the heartbeat script. For dashboard-run ChatGPT/Claude, add the provider API key in Settings.</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                    <code className="rounded bg-card px-2 py-1">python hooks/bridge-heartbeat.py</code>
                    <code className="rounded bg-card px-2 py-1">set BRIDGE_TOKEN=&lt;token&gt;</code>
                  </div>
                </div>
              ) : "Start a conversation with the selected agent."}
            </div>
          ) : messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-accent text-white" : "bg-bg-base text-text border border-border"}`}>
                {message.content}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={agents.length === 0}
              placeholder={agents.length === 0 ? "No available agent" : "Message the selected agent..."}
              className="min-h-12 flex-1 resize-none rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-60"
            />
            <button onClick={send} disabled={!canSend} className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {pending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
