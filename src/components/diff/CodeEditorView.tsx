import { highlightCodeLine } from "../../lib/syntaxHighlight";

const FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

type Props = {
  text: string;
  /** Accessible label */
  label?: string;
  emptyMessage?: string;
  className?: string;
};

/**
 * Read-only code editor surface: gutter + syntax colors (GitKraken-like).
 */
export function CodeEditorView({
  text,
  label = "Código",
  emptyMessage = "Conteúdo indisponível.",
  className = "",
}: Props) {
  if (!text) {
    return (
      <div className="p-6 text-[12px] text-[#6b7280]">{emptyMessage}</div>
    );
  }

  const lines = text.replace(/\r\n/g, "\n").split("\n");

  return (
    <div
      className={`min-h-0 flex-1 overflow-auto bg-[#0d1117] ${className}`}
      aria-label={label}
    >
      <div className="min-w-max font-mono text-[12px]" style={{ fontFamily: FONT }}>
        {lines.map((line, i) => (
          <div
            key={i}
            className="flex hover:bg-[#161b22]/80"
            style={{ minHeight: 20, lineHeight: "20px" }}
          >
            <span
              className="sticky left-0 w-12 shrink-0 select-none border-r border-[#21262d] bg-[#0d1117] px-2 text-right text-[11px] text-[#484f58]"
            >
              {i + 1}
            </span>
            <pre
              className="m-0 flex-1 whitespace-pre px-3"
              style={{ fontFamily: FONT, lineHeight: "20px" }}
            >
              {highlightCodeLine(line, `ed-${i}`)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Single highlighted line for diff rows (keeps add/del background from parent). */
export function CodeLine({
  text,
  lineKey,
}: {
  text: string;
  lineKey: string;
}) {
  return (
    <span className="min-w-0 flex-1 whitespace-pre-wrap break-all" style={{ fontFamily: FONT }}>
      {highlightCodeLine(text, lineKey) || "\u00a0"}
    </span>
  );
}
