"use client";

import { useCallback, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

/** 글자색으로 쓸 만한 것만 추린다. 아무 색이나 고르게 두면 읽기 어려워진다. */
const TEXT_COLORS = [
  { name: "기본", value: "" },
  { name: "빨강", value: "#d92d20" },
  { name: "주황", value: "#e07c00" },
  { name: "초록", value: "#0f7b4f" },
  { name: "파랑", value: "#2a5fe0" },
  { name: "보라", value: "#7c3aed" },
  { name: "회색", value: "#5d6893" },
];

const HIGHLIGHTS = [
  { name: "없음", value: "" },
  { name: "노랑", value: "#fef3c7" },
  { name: "초록", value: "#d1fae5" },
  { name: "파랑", value: "#dbeafe" },
  { name: "분홍", value: "#fce7f3" },
];

export function RichEditor({
  boardId,
  initialHtml,
  onChange,
  onError,
}: {
  boardId: string;
  initialHtml: string;
  onChange: (html: string) => void;
  onError: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    // 서버에서 미리 그리면 하이드레이션이 어긋난다.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer nofollow" } },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ HTMLAttributes: { class: "editor-image" } }),
      TableKit.configure({ table: { resizable: true } }),
      Placeholder.configure({ placeholder: "내용을 입력하세요." }),
    ],
    content: initialHtml || "",
    editorProps: {
      attributes: {
        class: "prose-board min-h-[280px] px-4 py-3.5 outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      setUploading(true);
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("boardId", boardId);
        fd.set("kind", "image");
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          onError(body.error ?? "그림을 올리지 못했습니다.");
          return;
        }
        editor.chain().focus().setImage({ src: body.attachment.url, alt: file.name }).run();
      } catch {
        onError("그림을 올리지 못했습니다.");
      } finally {
        setUploading(false);
      }
    },
    [boardId, editor, onError],
  );

  if (!editor) {
    return (
      <div className="rounded-lg border border-ink-300 px-4 py-8 text-center text-[13px] text-ink-400">
        편집기를 준비하는 중…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ink-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      <Toolbar
        editor={editor}
        uploading={uploading}
        onPickImage={() => fileRef.current?.click()}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void insertImage(f);
        }}
      />

      {/* 붙여넣기·끌어놓기로도 그림이 들어가게 한다. */}
      <div
        onPaste={(e) => {
          const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/"));
          if (f) {
            e.preventDefault();
            void insertImage(f);
          }
        }}
        onDrop={(e) => {
          const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
          if (f) {
            e.preventDefault();
            void insertImage(f);
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({
  editor,
  uploading,
  onPickImage,
}: {
  editor: Editor;
  uploading: boolean;
  onPickImage: () => void;
}) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("링크 주소", prev ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-ink-200 bg-ink-50 px-2 py-1.5">
      <Btn title="굵게" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={15} />
      </Btn>
      <Btn title="기울임" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={15} />
      </Btn>
      <Btn title="밑줄" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon size={15} />
      </Btn>
      <Btn title="취소선" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={15} />
      </Btn>

      <Sep />

      <Swatches
        title="글자색"
        options={TEXT_COLORS}
        current={(editor.getAttributes("textStyle").color as string) ?? ""}
        onPick={(v) => (v ? editor.chain().focus().setColor(v).run() : editor.chain().focus().unsetColor().run())}
      />
      <Swatches
        title="형광펜"
        options={HIGHLIGHTS}
        current={(editor.getAttributes("highlight").color as string) ?? ""}
        onPick={(v) =>
          v
            ? editor.chain().focus().setHighlight({ color: v }).run()
            : editor.chain().focus().unsetHighlight().run()
        }
      />

      <Sep />

      <select
        value={
          editor.isActive("heading", { level: 2 })
            ? "2"
            : editor.isActive("heading", { level: 3 })
              ? "3"
              : "p"
        }
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: Number(v) as 2 | 3 }).run();
        }}
        className="rounded-md border border-ink-300 bg-white px-1.5 py-1 text-[12px] text-ink-700 outline-none focus:border-brand-500"
        title="문단 종류"
      >
        <option value="p">본문</option>
        <option value="2">제목</option>
        <option value="3">소제목</option>
      </select>

      <Sep />

      <Btn title="글머리 기호" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={15} />
      </Btn>
      <Btn title="번호 매기기" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={15} />
      </Btn>

      <Sep />

      <Btn title="왼쪽 정렬" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft size={15} />
      </Btn>
      <Btn title="가운데 정렬" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter size={15} />
      </Btn>
      <Btn title="오른쪽 정렬" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight size={15} />
      </Btn>

      <Sep />

      <Btn title="인용" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={15} />
      </Btn>
      <Btn title="코드" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code size={15} />
      </Btn>
      <Btn title="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus size={15} />
      </Btn>
      <Btn title="링크" active={editor.isActive("link")} onClick={setLink}>
        <LinkIcon size={15} />
      </Btn>
      <Btn
        title="표 넣기"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon size={15} />
      </Btn>
      <Btn title={uploading ? "올리는 중…" : "그림 넣기"} disabled={uploading} onClick={onPickImage}>
        <ImageIcon size={15} />
      </Btn>

      <Sep />

      <Btn title="실행 취소" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={15} />
      </Btn>
      <Btn title="다시 실행" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={15} />
      </Btn>

      {uploading && <span className="ml-1 text-[12px] text-ink-400">그림 올리는 중…</span>}
    </div>
  );
}

function Btn({
  children,
  title,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-md transition-colors disabled:opacity-30 ${
        active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-200"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-4 w-px bg-ink-200" />;
}

function Swatches({
  title,
  options,
  current,
  onPick,
}: {
  title: string;
  options: { name: string; value: string }[];
  current: string;
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        type="button"
        title={title}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] text-ink-600 transition-colors hover:bg-ink-200"
      >
        {title}
        <span
          className="h-3 w-3 rounded-sm border border-ink-300"
          style={{ background: current || "transparent" }}
        />
      </button>
      {open && (
        <>
          <button
            aria-label="닫기"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <span className="absolute left-0 top-8 z-20 flex w-max gap-1 rounded-lg border border-ink-200 bg-white p-1.5 shadow-lg">
            {options.map((o) => (
              <button
                key={o.name}
                type="button"
                title={o.name}
                onClick={() => {
                  onPick(o.value);
                  setOpen(false);
                }}
                className="h-6 w-6 rounded-md border border-ink-200 transition-transform hover:scale-110"
                style={{
                  background: o.value || "#ffffff",
                  backgroundImage: o.value
                    ? undefined
                    : "linear-gradient(45deg, transparent 45%, #d7dbe9 45%, #d7dbe9 55%, transparent 55%)",
                }}
              />
            ))}
          </span>
        </>
      )}
    </span>
  );
}
