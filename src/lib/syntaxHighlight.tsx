import type { ReactNode } from "react";

const KEYWORDS = new Set([
  "import",
  "export",
  "from",
  "as",
  "default",
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "switch",
  "case",
  "break",
  "continue",
  "class",
  "extends",
  "implements",
  "interface",
  "type",
  "enum",
  "new",
  "this",
  "super",
  "typeof",
  "instanceof",
  "in",
  "of",
  "try",
  "catch",
  "finally",
  "throw",
  "async",
  "await",
  "yield",
  "true",
  "false",
  "null",
  "undefined",
  "void",
  "public",
  "private",
  "protected",
  "readonly",
  "static",
  "get",
  "set",
  "with",
  "package",
  "use",
  "fn",
  "mod",
  "pub",
  "struct",
  "impl",
  "trait",
  "match",
  "mut",
  "ref",
  "crate",
  "self",
  "Self",
  "where",
  "namespace",
  "using",
  "debugger",
  "delete",
  "do",
  "goto",
]);

type TokKind =
  | "comment"
  | "string"
  | "keyword"
  | "number"
  | "punct"
  | "tag"
  | "attr"
  | "type"
  | "func"
  | "plain";

type Tok = { kind: TokKind; text: string };

function tokenize(line: string): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;

  const push = (kind: TokKind, text: string) => {
    if (text) tokens.push({ kind, text });
  };

  while (i < line.length) {
    if (line[i] === "/" && line[i + 1] === "/") {
      push("comment", line.slice(i));
      break;
    }
    if (line[i] === "/" && line[i + 1] === "*") {
      const end = line.indexOf("*/", i + 2);
      if (end < 0) {
        push("comment", line.slice(i));
        break;
      }
      push("comment", line.slice(i, end + 2));
      i = end + 2;
      continue;
    }
    if (line.startsWith("{/*", i) || line.startsWith("<!--", i)) {
      push("comment", line.slice(i));
      break;
    }
    if (line[i] === "#" && (i === 0 || /\s/.test(line[i - 1] ?? " "))) {
      // rust/python attribute or hash comment-ish
      if (line[i + 1] === "[" || line[i + 1] === "!") {
        // keep as punct+plain via normal path
      } else {
        push("comment", line.slice(i));
        break;
      }
    }
    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      const q = line[i];
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "\\") {
          j += 2;
          continue;
        }
        if (line[j] === q) {
          j += 1;
          break;
        }
        j += 1;
      }
      push("string", line.slice(i, j));
      i = j;
      continue;
    }
    // JSX / HTML tag name: </Foo or <Foo
    if (line[i] === "<" && /[A-Za-z/]/.test(line[i + 1] ?? "")) {
      push("punct", "<");
      i += 1;
      if (line[i] === "/") {
        push("punct", "/");
        i += 1;
      }
      let j = i;
      while (j < line.length && /[A-Za-z0-9._$-]/.test(line[j]!)) j += 1;
      if (j > i) {
        push("tag", line.slice(i, j));
        i = j;
      }
      continue;
    }
    if (/[0-9]/.test(line[i]!) && (i === 0 || /[^\w$]/.test(line[i - 1]!))) {
      let j = i;
      while (j < line.length && /[0-9._xXa-fA-F]/.test(line[j]!)) j += 1;
      push("number", line.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(line[i]!)) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_$]/.test(line[j]!)) j += 1;
      const word = line.slice(i, j);
      // look ahead for function call / definition
      let k = j;
      while (k < line.length && /\s/.test(line[k]!)) k += 1;
      const next = line[k];
      let kind: TokKind = "plain";
      if (KEYWORDS.has(word)) kind = "keyword";
      else if (next === "(") kind = "func";
      else if (/^[A-Z]/.test(word) && word.length > 1) kind = "type";
      // attribute-ish: word= before =
      else if (next === "=") kind = "attr";
      push(kind, word);
      i = j;
      continue;
    }
    let j = i + 1;
    while (
      j < line.length &&
      !/[A-Za-z0-9_$'"`<#]/.test(line[j]!) &&
      !(line[j] === "/" && (line[j + 1] === "/" || line[j + 1] === "*"))
    ) {
      j += 1;
    }
    push("punct", line.slice(i, j));
    i = j;
  }

  return tokens;
}

/** GitHub-dark inspired token colors */
const COLOR: Record<TokKind, string> = {
  comment: "#8b949e",
  string: "#a5d6ff",
  keyword: "#ff7b72",
  number: "#79c0ff",
  punct: "#c9d1d9",
  tag: "#7ee787",
  attr: "#79c0ff",
  type: "#ffa657",
  func: "#d2a8ff",
  plain: "#e6edf3",
};

/** Lightweight syntax coloring (no editor dependency). */
export function highlightCodeLine(line: string, keyPrefix: string): ReactNode {
  if (!line) return "\u00a0";
  const tokens = tokenize(line);
  return tokens.map((t, idx) => (
    <span key={`${keyPrefix}-${idx}`} style={{ color: COLOR[t.kind] }}>
      {t.text}
    </span>
  ));
}
