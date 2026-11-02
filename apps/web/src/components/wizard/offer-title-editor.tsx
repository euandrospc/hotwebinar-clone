"use client";

import { useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "@/components/tiptap-ui-primitive/toolbar";
import { MarkButton } from "@/components/tiptap-ui/mark-button";
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button";
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button";
import { ColorHighlightPopover } from "@/components/tiptap-ui/color-highlight-popover";
import { Button as TiptapButton } from "@/components/tiptap-ui-primitive/button";
import Highlight from "@tiptap/extension-highlight";
import "@/styles/_variables.scss";
import "@/styles/_keyframe-animations.scss";
import "./offer-title-editor.scss";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/tiptap-ui-primitive/popover";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import CharacterCount from "@tiptap/extension-character-count";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseTitleFormat, readRichTitle } from "@/lib/offer-title-format";

type Props = { value: string; format?: string; onChange: (text: string) => void; onFormat: (format: string) => void };
const fonts = ["inherit", "Arial, sans-serif", "Georgia, serif", "Verdana, sans-serif", "monospace"];
const fontNames = ["Fonte do app", "Arial", "Georgia", "Verdana", "Monoespaçada"];
const emojis = ["🔥", "🚀", "🎉", "🎁", "⭐", "💥", "✅", "❤️", "⏰", "👉"];

function initialContent(value: string, format?: string) {
  const saved = readRichTitle(format);
  if (saved) return saved.doc;
  const old = parseTitleFormat(format);
  return { type: "doc", content: [{ type: "paragraph", attrs: { textAlign: old.align }, content: value ? [{
    type: "text", text: value, marks: [
      ...(old.bold ? [{ type: "bold" }] : []),
      ...(old.italic ? [{ type: "italic" }] : []),
      ...(old.underline ? [{ type: "underline" }] : []),
      { type: "textStyle", attrs: { fontSize: `${old.fontSize}px`, fontFamily: old.fontFamily, color: old.color === "inherit" ? null : old.color } }
    ]
  }] : [] }] };
}

export function OfferTitleEditor(props: Props) {
  const callbacks = useRef(props);
  callbacks.current = props;
  const saved = readRichTitle(props.format);
  const [mode, setMode] = useState<"plain" | "rich">(saved?.mode ?? "plain");
  const [background, setBackground] = useState(saved?.background ?? parseTitleFormat(props.format).background);
  const backgroundRef = useRef(background);
  backgroundRef.current = background;
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [, refresh] = useState(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false, bulletList: false, orderedList: false, listItem: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, link: false }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["paragraph"] }),
      CharacterCount.configure({ limit: 120 })
    ],
    content: initialContent(props.value, props.format),
    editorProps: { attributes: { role: "textbox", "aria-label": "Título da oferta formatado", class: "outline-none [&_p]:min-h-6" } },
    onUpdate: ({ editor }) => {
      callbacks.current.onChange(editor.getText({ blockSeparator: "\n" }));
      callbacks.current.onFormat(JSON.stringify({ mode: "rich", background: backgroundRef.current, doc: editor.getJSON() }));
    },
    onSelectionUpdate: () => refresh(n => n + 1),
    onTransaction: () => refresh(n => n + 1)
  });
  function persist(nextMode: "plain" | "rich", nextBackground = background) {
    props.onFormat(JSON.stringify({ mode: nextMode, background: nextBackground, doc: editor?.getJSON() ?? initialContent(props.value) }));
  }
  function changeMode(next: "plain" | "rich") {
    if (next === "rich" && mode === "plain") editor?.commands.setContent(initialContent(props.value, props.format), { emitUpdate: false });
    setMode(next);
    persist(next);
  }
  return <div className="offer-rich-editor overflow-hidden rounded-xl border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <span className="text-xs font-medium text-muted-foreground">Título da oferta</span>
      <div className="flex rounded-lg bg-muted p-1" role="group" aria-label="Modo de edição">
        {(["plain", "rich"] as const).map(next => <button key={next} type="button" aria-pressed={mode === next} onClick={() => changeMode(next)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium", mode === next ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{next === "plain" ? "Texto simples" : "Texto formatado"}</button>)}
      </div>
    </div>
    {mode === "plain" ? <textarea id="offerTitle" aria-label="Título da oferta" className="block min-h-36 w-full resize-y bg-transparent p-5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset" rows={3} maxLength={120} value={props.value} onChange={e => { props.onChange(e.target.value); props.onFormat(JSON.stringify({ mode: "plain", background, doc: initialContent(e.target.value) })); }} /> :
      <>
        <Toolbar aria-label="Formatação do título" className="offer-title-toolbar">
          <ToolbarGroup>
            <UndoRedoButton editor={editor} action="undo" aria-label="Desfazer" />
            <UndoRedoButton editor={editor} action="redo" aria-label="Refazer" />
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            <select aria-label="Fonte do título" className="offer-font-select" value={editor?.getAttributes("textStyle").fontFamily ?? "inherit"} onChange={e => editor?.chain().focus().setFontFamily(e.target.value).run()}>{fonts.map((font, i) => <option key={font} value={font}>{fontNames[i]}</option>)}</select>
            <input type="number" aria-label="Tamanho do título" min={12} max={72} className="offer-font-size" value={parseInt(editor?.getAttributes("textStyle").fontSize ?? "20")} onChange={e => { const n = Number(e.target.value); if (n >= 12 && n <= 72) editor?.chain().focus().setFontSize(`${n}px`).run(); }} />
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            <MarkButton editor={editor} type="bold" aria-label="Negrito" />
            <MarkButton editor={editor} type="italic" aria-label="Itálico" />
            <MarkButton editor={editor} type="underline" aria-label="Sublinhado" />
            <MarkButton editor={editor} type="strike" aria-label="Tachado" />
            <ColorHighlightPopover editor={editor} useColorValue aria-label="Marca-texto" />
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            <Popover>
              <PopoverTrigger asChild>
                <TiptapButton tooltip="Cor do texto" aria-label="Cor do título"><span className="offer-color-icon">A</span></TiptapButton>
              </PopoverTrigger>
              <PopoverContent className="offer-color-palette" aria-label="Escolher cor do texto">
                <p>Cor do texto</p>
                <div className="offer-color-swatches">
                  {["#ffffff", "#94a3b8", "#111827", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"].map(color => <button type="button" key={color} aria-label={`Cor ${color}`} style={{ backgroundColor: color }} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().setColor(color).run()} />)}
                </div>
                <label>Cor personalizada<input aria-label="Cor personalizada do título" type="color" defaultValue="#ef4444" onChange={e => editor?.chain().focus().setColor(e.target.value).run()} /></label>
                <TiptapButton onClick={() => editor?.chain().focus().unsetColor().run()}>Restaurar cor do tema</TiptapButton>
              </PopoverContent>
            </Popover>
            <TextAlignButton editor={editor} align="left" aria-label="Alinhar à esquerda" />
            <TextAlignButton editor={editor} align="center" aria-label="Centralizar" />
            <TextAlignButton editor={editor} align="right" aria-label="Alinhar à direita" />
            <TiptapButton tooltip="Inserir emoji" aria-label="Inserir emoji" onClick={() => setEmojiOpen(!emojiOpen)}>😀</TiptapButton>
          </ToolbarGroup>
        </Toolbar>
        {emojiOpen && <div className="flex flex-wrap gap-1 border-b px-3 py-2">{emojis.map(emoji => <Button key={emoji} type="button" variant="ghost" size="icon" aria-label={`Inserir ${emoji}`} onMouseDown={e => e.preventDefault()} onClick={() => { editor?.chain().focus().insertContent(emoji).run(); setEmojiOpen(false); }}>{emoji}</Button>)}</div>}
        <div className="offer-title-paper">
          <p className="offer-title-paper-label">Selecione um trecho para formatar</p>
          <div style={{ backgroundColor: background }} className="offer-title-document"><EditorContent editor={editor} /></div>
        </div>
      </>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/10 px-4 py-2 text-xs text-muted-foreground">
      {mode === "rich" ? <div className="flex items-center gap-2"><label className="flex items-center gap-2">Fundo do bloco<input type="color" aria-label="Fundo do título" className="h-5 w-6 cursor-pointer" value={background === "transparent" ? "#ffffff" : background} onChange={e => { setBackground(e.target.value); persist("rich", e.target.value); }} /></label><button type="button" className="underline underline-offset-2" onClick={() => { setBackground("transparent"); persist("rich", "transparent"); }}>Sem fundo</button></div> : <span>Texto sem formatação</span>}
      <span className="tabular-nums">{props.value.length}/120</span>
    </div>
  </div>;
}
