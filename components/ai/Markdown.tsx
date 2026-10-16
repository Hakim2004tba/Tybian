import { Fragment, type ReactNode } from "react";

/**
 * The small slice of Markdown a study assistant actually emits.
 *
 * WHY NOT A LIBRARY. react-markdown plus remark is around 40 kB on a
 * bundle that is currently 102 kB shared, to render headings, bold,
 * lists and code. This handles what the model sends and nothing else.
 *
 * WHY NOT dangerouslySetInnerHTML. The text comes from a language model
 * which is in turn repeating whatever a student typed. Turning that into
 * HTML is an injection waiting to happen, and sanitising it correctly is
 * harder than not producing HTML in the first place. Everything below
 * builds React elements, so a `<script>` in the reply is text that says
 * "script", not a script.
 *
 * Unrecognised syntax degrades to plain text rather than disappearing —
 * a student must never lose part of an answer to a parser that did not
 * understand it.
 */

/** `**bold**`, `*italic*`, `` `code` ``, and [links](url). */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  /*
    One pass, one regex, alternatives ordered longest-first so `**`
    cannot be consumed by the `*` branch. Anything that does not match
    is emitted verbatim.
  */
  const pattern = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;

  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${n++}`;

    if (token.startsWith("**")) {
      out.push(<strong key={key} className="font-semibold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      out.push(
        <code key={key} className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[12px]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const split = token.indexOf("](");
      const label = token.slice(1, split);
      const href = token.slice(split + 2, -1);
      /* Only http(s). A `javascript:` href in a model's reply is the
         one thing here that could still execute something. */
      const safe = /^https?:\/\//i.test(href) ? href : null;
      out.push(
        safe ? (
          <a key={key} href={safe} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {label}
          </a>
        ) : (
          <Fragment key={key}>{label}</Fragment>
        )
      );
    } else {
      out.push(<em key={key} className="italic">{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];

  let listItems: { ordered: boolean; content: string }[] = [];
  let codeLines: string[] | null = null;
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const ordered = listItems[0].ordered;
    const items = listItems.map((item, i) => (
      <li key={i} className="ms-4 list-outside">
        {inline(item.content, `l${key}-${i}`)}
      </li>
    ));
    blocks.push(
      ordered ? (
        <ol key={`b${key++}`} className="my-1.5 list-decimal space-y-1">{items}</ol>
      ) : (
        <ul key={`b${key++}`} className="my-1.5 list-disc space-y-1">{items}</ul>
      )
    );
    listItems = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    /* Fenced code. Collected verbatim — inline rules must not run
       inside it, or a formula with asterisks becomes italics. */
    if (line.trim().startsWith("```")) {
      if (codeLines === null) {
        flushList();
        codeLines = [];
      } else {
        blocks.push(
          <pre
            key={`b${key++}`}
            dir="ltr"
            className="my-2 overflow-x-auto rounded-md bg-black/[0.06] p-2.5 font-mono text-[12px] leading-relaxed"
          >
            {codeLines.join("\n")}
          </pre>
        );
        codeLines = null;
      }
      continue;
    }
    if (codeLines !== null) {
      codeLines.push(raw);
      continue;
    }

    if (line.trim() === "") {
      flushList();
      continue;
    }

    /* A horizontal rule, which the model uses to separate sections. */
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushList();
      blocks.push(<hr key={`b${key++}`} className="my-3 border-border-light" />);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (heading) {
      flushList();
      const depth = heading[1].length;
      blocks.push(
        <p
          key={`b${key++}`}
          className={
            "mt-2.5 font-semibold text-text-primary-light " +
            (depth <= 2 ? "text-[14.5px]" : "text-[13.5px]")
          }
        >
          {inline(heading[2], `h${key}`)}
        </p>
      );
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      if (listItems.length && listItems[0].ordered) flushList();
      listItems.push({ ordered: false, content: bullet[1] });
      continue;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (listItems.length && !listItems[0].ordered) flushList();
      listItems.push({ ordered: true, content: numbered[1] });
      continue;
    }

    flushList();
    blocks.push(
      <p key={`b${key++}`} className="whitespace-pre-wrap">
        {inline(line, `p${key}`)}
      </p>
    );
  }

  flushList();
  /* An unterminated fence — the stream was cut mid-block. Show what
     arrived rather than dropping it. */
  if (codeLines?.length) {
    blocks.push(
      <pre key={`b${key++}`} dir="ltr" className="my-2 overflow-x-auto rounded-md bg-black/[0.06] p-2.5 font-mono text-[12px]">
        {codeLines.join("\n")}
      </pre>
    );
  }

  return <div className="space-y-1">{blocks}</div>;
}
