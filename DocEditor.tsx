import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

type Props = {
  initialContent: any;
  editable: boolean;
  onChangeJson: (json: any) => void;
};

export default function DocEditor({
  initialContent,
  editable,
  onChangeJson
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write lyrics, notes, or a song map…"
      })
    ],
    content:
      initialContent || {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Verse 1" }]
          },
          { type: "paragraph", content: [{ type: "text", text: "" }] }
        ]
      },
    editable,
    editorProps: {
      attributes: {
        class: "editor"
      }
    },
    onUpdate({ editor }) {
      onChangeJson(editor.getJSON());
    }
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;

  const insertSection = (label: string) => {
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: label }]
        },
        { type: "paragraph", content: [{ type: "text", text: "" }] }
      ])
      .run();
  };

  return (
    <div className="editorWrap">
      <div className="toolbar">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editable}
        >
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editable}
        >
          Italic
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={!editable}
        >
          List
        </button>

        <div className="divider" />

        <button onClick={() => insertSection("Verse")} disabled={!editable}>
          Verse
        </button>
        <button onClick={() => insertSection("Chorus")} disabled={!editable}>
          Chorus
        </button>
        <button onClick={() => insertSection("Bridge")} disabled={!editable}>
          Bridge
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
