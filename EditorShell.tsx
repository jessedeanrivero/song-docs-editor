import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import DocEditor from "./DocEditor";

type Props = {
  docId: string;
  mode: "edit" | "view" | "comment";
  authed: boolean;
  onNeedAuth: () => void;
};

export default function EditorShell({
  docId,
  mode,
  authed,
  onNeedAuth
}: Props) {
  const [title, setTitle] = useState("Untitled");
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editable, setEditable] = useState(mode === "edit");
  const saveTimer = useRef<number | null>(null);

  useEffect(() => setEditable(mode === "edit"), [mode]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        onNeedAuth();
      }

      const { data: docRow, error: docErr } = await supabase
        .from("docs")
        .select("title")
        .eq("id", docId)
        .single();

      if (docErr) {
        window.parent?.postMessage(
          { type: "ERROR", message: docErr.message },
          "*"
        );
        setLoading(false);
        return;
      }

      const { data: contentRow, error: contentErr } = await supabase
        .from("doc_content")
        .select("content_json, updated_at")
        .eq("doc_id", docId)
        .maybeSingle();

      if (cancelled) return;

      setTitle(docRow?.title || "Untitled");
      setContent(contentRow?.content_json || null);
      setLoading(false);

      window.parent?.postMessage(
        {
          type: "DOC_LOADED",
          title: docRow?.title || "Untitled",
          lastSavedAt: contentRow?.updated_at || null
        },
        "*"
      );
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [docId, authed, onNeedAuth]);

  const save = async (nextJson: any) => {
    if (!editable) return;

    window.parent?.postMessage({ type: "DOC_DIRTY" }, "*");

    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    saveTimer.current = window.setTimeout(async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id || null;

      const { error } = await supabase.from("doc_content").upsert(
        {
          doc_id: docId,
          content_json: nextJson,
          updated_by: userId
        },
        { onConflict: "doc_id" }
      );

      if (error) {
        window.parent?.postMessage(
          { type: "ERROR", message: error.message },
          "*"
        );
        return;
      }

      const nowIso = new Date().toISOString();
      window.parent?.postMessage(
        { type: "DOC_SAVED", lastSavedAt: nowIso },
        "*"
      );
    }, 900);
  };

  const rename = async (nextTitle: string) => {
    setTitle(nextTitle);
    const { error } = await supabase
      .from("docs")
      .update({ title: nextTitle })
      .eq("id", docId);

    if (error) {
      window.parent?.postMessage(
        { type: "ERROR", message: error.message },
        "*"
      );
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="card">Loading…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar">
        <input
          className="titleInput"
          value={title}
          onChange={(e) => rename(e.target.value)}
          disabled={!editable}
        />
        <div className="modePill">{mode.toUpperCase()}</div>
      </div>

      <DocEditor
        initialContent={content}
        editable={editable}
        onChangeJson={(json) => save(json)}
      />
    </div>
  );
}
