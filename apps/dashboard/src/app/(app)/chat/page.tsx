import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { ChatClient } from "@/components/chat/ChatClient";

export default async function ChatPage({ searchParams }: { searchParams?: Promise<{ sessionId?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <TopBar title="Chat" />
      <PageShell>
        <ChatClient initialSessionId={params?.sessionId} />
      </PageShell>
    </>
  );
}
