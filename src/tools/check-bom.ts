import * as fs from "fs";
import * as path from "path";

const EMOJI_RE = /^[🪵🧩🪤🧽]+/u;
const BRACKET_START = /^\[.+\]\s*\(/u;
const SOFA_START = /^Диван\s+/u;
const SECTION_RE = /^#+\s*(Цех\s*№[\d\-]+)/u;

// Broad qty pattern: "- N unit?" OR "- unit" at end of line.
// Also matches unit-only lines like "- шт." (missing number → [NOUNIT]).
const ANY_QTY_RE = /[-]\s*(?:[\d.,]+\s*(кг|m³|m²|дм²|m|шт\.?)?|(кг|m³|m²|дм²|m|шт\.?))\s*$/u;

// Narrower pattern used to extract qty+unit values for zero/nounit checks
const QTY_EXTRACT_RE = /[-]\s*([\d.,]*)\s*(кг|m³|m²|дм²|m|шт\.?)?\s*$/u;

const VALID_UNITS = new Set(["кг", "m", "m²", "m³", "шт", "шт.", "дм²"]);

function stripComment(line: string): string {
  let s = line.replace(/<!--.*?-->/g, "");
  const idx = s.indexOf("//");
  if (idx >= 0) s = s.slice(0, idx);
  return s.trim();
}

function isOutputLine(t: string): boolean {
  if (ANY_QTY_RE.test(t)) return false; // has qty → it's a component
  return (
    (EMOJI_RE.test(t) && t.includes("[")) ||
    BRACKET_START.test(t) ||
    SOFA_START.test(t)
  );
}

function isAbo(t: string): boolean {
  return /^(або|Або|АБО)$/.test(t);
}

// A block is "conditional" when its output line has a "// @Attr=Value" tag.
// Conditional blocks are alternatives — they need "або" between them.
// Unconditional blocks (no // @) are produced in parallel — no "або" needed.
function hasConditionalTag(rawLine: string): boolean {
  return /\/\/\s*@/.test(rawLine);
}

interface Fix {
  lineIdx: number;
  content: string;
}

export function runBomCheck(content: string, fileName: string): { content: string; issues: string[] } {
  console.log(`\nBOM: ${fileName}`);
  const lines = content.split("\n");
  const issues: string[] = [];
  const fixes: Fix[] = [];
  const pendingTodos = new Map<number, string[]>(); // lineIdx → todo messages

  let section = "";

  // Per-block state
  let blockOutputLine = -1;
  let blockOutputText = "";
  let blockIsConditional = false;
  let blockHasInputs = false;
  let seenAbo = true; // true at start of section so first block is always ok

  function flushBlock() {
    if (blockOutputLine < 0) return;
    if (!blockHasInputs) {
      const msg = `[EMPTY] ${section}: порожня специфікація "${blockOutputText}"`;
      console.log(`  ${msg}`);
      issues.push(msg);
      fixes.push({ lineIdx: blockOutputLine, content: "<!-- TODO: записати компоненти -->" });
    }
  }

  function resetBlock() {
    blockOutputLine = -1;
    blockOutputText = "";
    blockIsConditional = false;
    blockHasInputs = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = stripComment(raw);

    if (!t) continue;

    // Section header
    const hMatch = SECTION_RE.exec(t);
    if (hMatch) {
      flushBlock();
      resetBlock();
      section = hMatch[1];
      seenAbo = true;
      continue;
    }

    if (!section) continue;

    // "або" separator
    if (isAbo(t)) {
      flushBlock();
      resetBlock();
      seenAbo = true;
      continue;
    }

    // Output line
    if (isOutputLine(t)) {
      const isConditional = hasConditionalTag(raw);

      // Flag missing "або" only when at least one of the two consecutive blocks is conditional
      if (blockOutputLine >= 0 && !seenAbo && (blockIsConditional || isConditional)) {
        const msg = `[BREAK] ${section}: відсутнє "або" перед "${t}"`;
        console.log(`  ${msg}`);
        issues.push(msg);
      }

      flushBlock();
      resetBlock();
      blockOutputLine = i;
      blockOutputText = t;
      blockIsConditional = isConditional;
      seenAbo = false;
      continue;
    }

    // Component / material line with quantity
    if (ANY_QTY_RE.test(t) && blockOutputLine >= 0) {
      blockHasInputs = true;

      const m = QTY_EXTRACT_RE.exec(t);
      if (m) {
        const qtyStr = m[1];
        const unit = m[2];
        const lineTodos: string[] = [];

        if (!qtyStr) {
          const msg = `[NOUNIT] ${section}: відсутня кількість у "${t}"`;
          console.log(`  ${msg}`);
          issues.push(msg);
          lineTodos.push("відсутня кількість");
        } else {
          const qty = parseFloat(qtyStr.replace(",", "."));
          if (qty === 0) {
            const msg = `[ZERO] ${section}: нульова кількість у "${t}"`;
            console.log(`  ${msg}`);
            issues.push(msg);
            lineTodos.push("нульова кількість");
          }
        }

        if (!unit) {
          const msg = `[NOUNIT] ${section}: відсутня одиниця виміру у "${t}"`;
          console.log(`  ${msg}`);
          issues.push(msg);
          lineTodos.push("відсутня одиниця виміру");
        } else if (!VALID_UNITS.has(unit)) {
          const msg = `[NOUNIT] ${section}: невідома одиниця "${unit}" у "${t}"`;
          console.log(`  ${msg}`);
          issues.push(msg);
          lineTodos.push(`невідома одиниця "${unit}"`);
        }

        if (lineTodos.length > 0) {
          pendingTodos.set(i, lineTodos);
        }
      }
    }
  }

  flushBlock();

  // Convert per-line TODO messages to insert-after fixes
  for (const [lineIdx, msgs] of pendingTodos) {
    fixes.push({ lineIdx, content: `<!-- TODO: ${msgs.join("; ")} -->` });
  }

  if (fixes.length === 0) {
    if (issues.length === 0) console.log("  ✅ BOM в порядку.");
    return { content, issues };
  }

  // Apply fixes (insert comments after output lines, descending order)
  fixes.sort((a, b) => b.lineIdx - a.lineIdx);
  const result = [...lines];
  for (const fix of fixes) {
    result.splice(fix.lineIdx + 1, 0, fix.content);
  }
  return { content: result.join("\n"), issues };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: ts-node check-bom.ts <path-to-md-file>");
    process.exit(1);
  }
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }
  const original = fs.readFileSync(absPath, "utf-8");
  const fileName = path.basename(absPath);
  const { content: fixed, issues } = runBomCheck(original, fileName);
  console.log(`\nПомилок: ${issues.length}`);
  if (fixed !== original) {
    fs.writeFileSync(absPath, fixed, "utf-8");
    console.log("✅ Файл оновлено.");
  }
}

if (require.main === module) main();
