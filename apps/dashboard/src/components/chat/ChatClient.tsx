"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type Agent = { id: string; name: string; slug: string; provider: string; mode: string; model?: string; roleType: string };
type ChatMessage = { id: string; role: "user" | "assistant" | "system" | "tool"; content: string; createdAt: string };
type ChatSession = {
  id: string;
  title: string;
  agentRoleId: string | null;
  provider?: string | null;
  model?: string | null;
  agentRole?: { name: string; slug: string; provider: string; roleType: string; mcpProfile?: string | null; generatedPaths?: Record<string, string> | null } | null;
  messages: ChatMessage[];
};
type Diagnostics = {
  roles: number;
  apiKeys: string[];
  local: { claude: boolean; codex: boolean };
  onlineDevices: Array<{ name: string; claudeAvailable: boolean; codexAvailable: boolean; lastSeenAt: string | null }>;
};

export function ChatClient() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
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
    setAgents(agentBody.agents ?? []);
    setDiagnostics(agentBody.diagnostics ?? null);
    setSessions(Array.isArray(sessionBody) ? sessionBody : []);
  }

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null,
    [sessions, selectedSessionId],
  );
  const messages = selectedSession?.messages ?? [];
  const generatedPaths = useMemo(
    () => Object.values(selectedSession?.agentRole?.generatedPaths ?? {}).filter(Boolean),
    [selectedSession],
  );
  const mentionedAgent = useMemo(() => {
    const mention = input.match(/@([a-zA-Z0-9][\w-]*)/)?.[1]?.toLowerCase();
    return mention ? agents.find((agent) => agent.slug.toLowerCase() === mention) : null;
  }, [agents, input]);
  const canSend = agents.length > 0 && Boolean(mentionedAgent) && input.trim().length > 0 && !pending;

  function mention(agent: Agent) {
    setInput((prev) => {
      const trimmed = prev.trimStart();
      if (trimmed.startsWith(`@${agent.slug}`)) return prev;
      return `@${agent.slug} ${trimmed}`.trimEnd();
    });
  }

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
          message,
        }),
      });
      const body = await res.json();
      await refresh();
      if (body.sessionId) setSelectedSessionId(body.sessionId);
    });
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-7rem)] max-w-[1600px] grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
      <aside className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">Active Bots</p>
          {agents.length > 0 ? (
            <div className="flex flex-col gap-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => mention(agent)}
                  className="rounded-lg border border-border bg-bg-base p-3 text-left transition-colors hover:border-accent/60 hover:bg-accent/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-text">{agent.name}</span>
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">{agent.provider}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-text-muted">@{agent.slug}</p>
                  <p className="mt-1 text-[10px] text-text-muted">{agent.mode}{agent.model ? ` - ${agent.model}` : ""}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-in-progress/30 bg-in-progress/10 p-3 text-xs text-in-progress">
              No active bots. Local bots need a bridge heartbeat; dashboard bots need provider API keys.
            </div>
          )}
        </div>

        {agents.length === 0 && (
          <div className="mb-4 rounded-lg border border-border bg-bg-base p-3 text-xs text-text-muted">
            <p className="font-semibold text-text">Local bridge</p>
            <p className="mt-1">Create a bridge token in Settings, then run from repo root:</p>
            <code className="mt-2 block rounded bg-card px-2 py-1 text-[10px] text-accent">.codex/settings.local.json → env.BRIDGE_TOKEN</code>
            <code className="mt-1 block rounded bg-card px-2 py-1 text-[10px] text-accent">powershell -NoProfile -ExecutionPolicy Bypass -File hooks/ensure-gcs-bridge.ps1</code>
            <p className="mt-2">For Codex logging, run Codex through:</p>
            <code className="mt-1 block rounded bg-card px-2 py-1 text-[10px] text-accent">powershell -NoProfile -ExecutionPolicy Bypass -File hooks/codex-gcs.ps1 &quot;prompt&quot;</code>
            <p className="mt-2">Claude online: {diagnostics?.local.claude ? "yes" : "no"} - Codex online: {diagnostics?.local.codex ? "yes" : "no"}</p>
            <p>Roles: {diagnostics?.roles ?? 0} - API keys: {diagnostics?.apiKeys.length ?? 0}</p>
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

      <section className="flex min-h-[600px] flex-col rounded-xl border border-border bg-card">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-text-muted">
              {agents.length === 0 ? (
                <div className="max-w-xl rounded-xl border border-border bg-bg-base p-5">
                  <p className="font-semibold text-text">No active bots yet.</p>
                  <p className="mt-2">For local Claude/Codex, create a bridge token in Settings and run the heartbeat script. For dashboard-run ChatGPT/Claude, add the provider API key in Settings.</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                    <code className="rounded bg-card px-2 py-1">.codex/settings.local.json → env.BRIDGE_TOKEN</code>
                    <code className="rounded bg-card px-2 py-1">powershell -NoProfile -ExecutionPolicy Bypass -File hooks/ensure-gcs-bridge.ps1</code>
                    <code className="rounded bg-card px-2 py-1">powershell -NoProfile -ExecutionPolicy Bypass -File hooks/codex-gcs.ps1 &quot;prompt&quot;</code>
                  </div>
                </div>
              ) : "Mention a bot to start, for example @dev-implementer."}
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
          {mentionedAgent && (
            <p className="mb-2 text-xs text-text-muted">
              Sending to <span className="font-semibold text-accent">{mentionedAgent.name}</span>
            </p>
          )}
          {agents.length > 0 && input.trim().length > 0 && !mentionedAgent && (
            <p className="mb-2 text-xs text-in-progress">Mention one active bot first, for example @{agents[0]?.slug}.</p>
          )}
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
              placeholder={agents.length === 0 ? "No active bot" : "Ask with @bot-name, e.g. @dev-implementer review this task"}
              className="min-h-12 flex-1 resize-none rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-60"
            />
            <button onClick={send} disabled={!canSend} className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {pending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </section>

      <aside className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">Context</p>
        <div className="rounded-lg border border-border bg-bg-base p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Selected Agent</p>
          <p className="mt-1 text-sm font-bold text-text">{selectedSession?.agentRole?.name ?? mentionedAgent?.name ?? "None"}</p>
          <p className="mt-1 font-mono text-[10px] text-accent">
            @{selectedSession?.agentRole?.slug ?? mentionedAgent?.slug ?? "mention-agent"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
              {selectedSession?.provider ?? mentionedAgent?.provider ?? "provider"}
            </span>
            <span className="rounded bg-card px-2 py-0.5 text-[10px] text-text-muted">
              {selectedSession?.model ?? mentionedAgent?.model ?? "local"}
            </span>
          </div>
        </div>

        <p className="mb-3 mt-5 text-xs font-bold uppercase tracking-wide text-text-muted">Attached Files</p>
        <div className="space-y-2">
          {generatedPaths.length > 0 ? generatedPaths.map((file) => (
            <div key={file} className="rounded-lg border border-border bg-bg-base px-3 py-2 font-mono text-[11px] text-text-muted">
              {file}
            </div>
          )) : (
            <div className="rounded-lg border border-dashed border-border bg-bg-base px-3 py-3 text-xs text-text-muted">
              No files attached to this session yet.
            </div>
          )}
        </div>

        <p className="mb-3 mt-5 text-xs font-bold uppercase tracking-wide text-text-muted">MCP Active Tools</p>
        <div className="flex flex-wrap gap-2">
          {(selectedSession?.agentRole?.mcpProfile ? [selectedSession.agentRole.mcpProfile] : diagnostics?.onlineDevices.map((d) => d.name) ?? []).slice(0, 6).map((tool) => (
            <span key={tool} className="rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] text-accent">
              {tool}
            </span>
          ))}
          {!selectedSession?.agentRole?.mcpProfile && (diagnostics?.onlineDevices.length ?? 0) === 0 && (
            <span className="text-xs text-text-muted">No active tools.</span>
          )}
        </div>

        <p className="mb-3 mt-5 text-xs font-bold uppercase tracking-wide text-text-muted">Generated Artifacts</p>
        <div className="space-y-2">
          {generatedPaths.length > 0 ? (
            generatedPaths.map((path) => (
              <div key={path} className="rounded-lg border border-border bg-bg-base px-3 py-2 font-mono text-[11px] text-text-muted">
                {path}
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-bg-base px-3 py-3 text-xs text-text-muted">
              No generated artifacts recorded in DB for this agent/session.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
