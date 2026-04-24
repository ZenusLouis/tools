import { TopBar } from "@/components/layout/TopBar";
import { PageShell } from "@/components/layout/PageShell";
import { ChatClient } from "@/components/chat/ChatClient";

export default function ChatPage() {
  return (
    <>
      <TopBar title="Chat" />
      <PageShell>
        <ChatClient />
      </PageShell>
    </>
  );
}

