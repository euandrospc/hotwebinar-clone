import type { CSSProperties, ReactNode } from "react";
import { parseTitleFormat, titleFormatStyles, readRichTitle } from "@/lib/offer-title-format";

export function OfferTitle({ title, variant }: { title: string; variant?: string }) {
  if (!title.trim()) return null;
  const rich = readRichTitle(variant);
  if (rich?.mode === "plain") return <h2 className="col-span-full min-w-0 whitespace-pre-wrap break-words text-base font-semibold">{title}</h2>;
  if (rich) return <div className="col-span-full min-w-0 whitespace-pre-wrap break-words rounded-lg p-3 text-lg leading-snug" style={{ backgroundColor: rich.background }}>
    {rich.doc.content.map((paragraph, index) => <p key={index} style={{ textAlign: paragraph.attrs?.textAlign ?? "left" }}>
      {paragraph.content?.length ? paragraph.content.map((node, i) => {
        if (node.type === "hardBreak") return <br key={i} />;
        let content: ReactNode = node.text;
        for (const mark of node.marks ?? []) {
          if (mark.type === "bold") content = <strong>{content}</strong>;
          if (mark.type === "italic") content = <em>{content}</em>;
          if (mark.type === "underline") content = <u>{content}</u>;
          if (mark.type === "highlight") content = <mark style={{ backgroundColor: mark.attrs?.color ?? "#fef9c3", color: "inherit", borderRadius: "3px" }}>{content}</mark>;
          if (mark.type === "strike") content = <s>{content}</s>;
          if (mark.type === "textStyle") {
            const attrs = mark.attrs;
            const style: CSSProperties = {
              color: attrs?.color ?? undefined, backgroundColor: attrs?.backgroundColor ?? undefined,
              fontFamily: attrs?.fontFamily ?? undefined, fontSize: attrs?.fontSize ?? undefined
            };
            content = <span style={style}>{content}</span>;
          }
        }
        return <span key={i}>{content}</span>;
      }) : <br />}
    </p>)}
  </div>;
  return <h2 className="col-span-full min-w-0 whitespace-pre-wrap break-words rounded-md p-2 leading-tight" style={titleFormatStyles(parseTitleFormat(variant))}>{title}</h2>;
}
