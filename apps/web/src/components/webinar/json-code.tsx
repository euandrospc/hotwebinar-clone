import { highlight } from "sugar-high";

// sugar-high tags JSON keys as plain strings; recolor a string run that is followed by ":" as a key.
const KEY_RUN = /((?:<span class="sh__token--string" style="color:var\(--sh-string\)">[^<]*<\/span>)+)(?=<span class="sh__token--sign" style="color:var\(--sh-sign\)">:<\/span>)/g;

export function JsonCode({ code, className = "" }: { code: string; className?: string }) {
  // sugar-high escapes the source text, so the stored payload cannot inject markup.
  const html = highlight(code).replace(KEY_RUN, (run) => run.replaceAll("--sh-string", "--sh-property"));
  return (
    <pre
      className={`overflow-auto rounded-[10px] border border-[#1E241F] bg-[#070807] font-mono text-[11px] leading-[1.5] text-[#C9D1CA] [--sh-class:#A6F0C6] [--sh-identifier:#C9D1CA] [--sh-keyword:#A6F0C6] [--sh-property:#C9D1CA] [--sh-sign:#6E776F] [--sh-string:#2BE07A] ${className}`}
    >
      <code className="block" dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}
