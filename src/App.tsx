import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import EditorShell from "./EditorShell";

 type AuthMsg =
  | { type: "AUTH_TOKEN"; token: string }
  | { type: "OPEN_DOC"; docId: string }
  | { type: "SET_MODE"; mode: "edit" | "view" | "comment" };

export default function App() {
  const [ready, setReady] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "view" | "comment">("edit");
  const [authed, setAuthed] = useState(false);

  const urlDocId = useMemo(() => {
    const u = new URL(window.location.href);
    return u.searchParams.get("docId");
  }, []);

  useEffect(() => {
    if (urlDocId) setDocId(urlDocId);

    const onMessage = async (event: MessageEvent) => {
      const data = event.data as AuthMsg;
      if (!data || typeof data !== "object" || !("type" in data)) return;

      if (data.type === "AUTH_TOKEN") {
        const token = data.token;
        const { error } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: token,
        } as any);

        if (error) {
          window.parent?.postMessage({ type: "ERROR", message: error.message }, "*");
          return;
        }

        setAuthed(true);
        window.parent?.postMessage({ type: "AUTH_OK" }, "*");
        return;
      }

      if (data.type === "OPEN_DOC") {
        setDocId(data.docId);
        return;
      }

      if (data.type === "SET_MODE") {
        setMode(data.mode);
        return;
      }
    };

    window.addEventListener("message", onMessage);
    setReady(true);
    window.parent?.postMessage({ type: "READY" }, "*");

    return () => window.removeEventListener("message", onMessage);
  }, [urlDocId]);

  if (!ready) return null;

  if (!docId) {
    return (
      <div className="page">
        <div className="card">
          <h2>Missing docId</h2>
          <p>Pass docId in the URL or via postMessage OPEN_DOC.</p>
        </div>
      </div>
    );
  }

  return (
    <EditorShell
      docId={docId}
      mode={mode}
      authed={authed}
      onNeedAuth={() => window.parent?.postMessage({ type: "NEED_AUTH" }, "*")}
    />
  );
}
