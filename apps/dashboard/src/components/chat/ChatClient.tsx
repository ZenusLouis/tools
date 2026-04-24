"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type Agent = { id: string; name: string; provider: string; mode: string; model?: string; roleType: string };
type ChatMessage = { id: string; role: "user" | "assistant" | "system" | "tool"; content: string; createdAt: string };
type ChatSession = { id: string; title: string; agentRoleId: string | null; messages: ChatMessage[] };

export function ChatClient() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
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
              Add an API key or connect a local bridge to start chatting.
            </div>
          )}
        </div>

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
            <div className="flex h-full items-center justify-center text-sm text-text-muted">
              {agents.length === 0 ? "No available agents." : "Start a conversation with the selected agent."}
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

