import * as fs from "fs";
import * as path from "path";

interface BomBlock {
  output: string;
  inputs: string[];
  rawInputLines: string[];
  outputLineIdx: number; // index in fileLines
  lastInputLineIdx: number; // index of last input line in fileLines (-1 if none)
}

interface WorkshopSection {
  header: string;
  boms: BomBlock[];
}

interface ChainStep {
  workshop: string; // substring to match in section header
  output: string; // exact product string (no quantity)
  requiredInputs: string[]; // exact product strings that must appear as inputs
}

interface Chain {
  name: string;
  steps: ChainStep[];
}

// ─── Chain definitions (exact strings from the document) ────────────────────

const CHAINS: Chain[] = [
  {
    name: "Ланцюг Каркасу (Д.Леон-Люкс Колеса)",
    steps: [
      {
        workshop: "Цех №1",
        output: "🪵[Каркас - нарізана деревина] (Д.Леон-Люкс Колеса)",
        requiredInputs: [],
      },
      {
        workshop: "Цех №2-2",
        output: "🧩[Каркас - нарізані деталі] (Д.Леон-Люкс Колеса, %Дно Каркасу%)",
        requiredInputs: [],
      },
      {
        workshop: "Цех №4-2",
        output: "🪤[Каркас - напівфабрикат] (Д.Леон-Люкс Колеса, %Дно Каркасу%, %Колір Матеріалу%)",
        requiredInputs: [
          "🪵[Каркас - нарізана деревина] (Д.Леон-Люкс Колеса)",
          "🧩[Каркас - нарізані деталі] (Д.Леон-Люкс Колеса, %Дно Каркасу%)",
        ],
      },
      {
        workshop: "Цех №6",
        output: "🪤🧽[Каркас + Поролон - напівфабрикат 2] (Угол Леон-Люкс 200 Колеса, %Диван Пружинний Блок%, %Дно Каркасу%, %Диван Розмір Бильця%, %Колір Матеріалу%)",
        requiredInputs: [
          "🪤[Каркас - напівфабрикат] (Д.Леон-Люкс Колеса, %Дно Каркасу%, %Колір Матеріалу%)",
        ],
      },
      {
        workshop: "Цех №9 ",
        output: "Диван Угол Леон-Люкс 200 Колеса",
        requiredInputs: [
          "🪤🧽[Каркас + Поролон - напівфабрикат 2] (Угол Леон-Люкс 200 Колеса, %Диван Пружинний Блок%, %Дно Каркасу%, %Диван Розмір Бильця%, %Колір Матеріалу%)",
        ],
      },
    ],
  },
  {
    name: "Ланцюг Каркасу (143П)",
    steps: [
      {
        workshop: "Цех №1",
        output: "🪵[Каркас - нарізана деревина] (143П)",
        requiredInputs: [],
      },
      {
        workshop: "Цех №2-2",
        output: "🧩[Каркас - нарізані деталі] (143П, %Дно Каркасу%)",
        requiredInputs: [],
      },
      {
        workshop: "Цех №4-2",
        output: "🪤[Каркас - напівфабрикат] (143П, %Дно Каркасу%, %Колір Матеріалу%)",
        requiredInputs: [
          "🪵[Каркас - нарізана деревина] (143П)",
          "🧩[Каркас - нарізані деталі] (143П, %Дно Каркасу%)",
        ],
      },
      {
        workshop: "Цех №6",
        output: "🪤🧽[Каркас + Поролон - напівфабрикат 2] (Угол Леон-Люкс 200 Колеса, %Диван Пружинний Блок%, %Дно Каркасу%, %Диван Розмір Бильця%, %Колір Матеріалу%)",
        requiredInputs: [
          "🪤[Каркас - напівфабрикат] (143П, %Дно Каркасу%, %Колір Матеріалу%)",
        ],
      },
    ],
  },
  {
    name: "Ланцюг Бильця",
    steps: [
      {
        workshop: "Цех №1",
        output: "🪵[Бильце - нарізана деревина] (Модель, %Диван Розмір Бильця%)",
        requiredInputs: [],
      },
      {
        workshop: "Цех №2-1",
        output: "🧩[Бильце - нарізані деталі] (Б.Флізелін 101, %Диван Розмір Бильця%)",
        requiredInputs: [],
      },
      {
        workshop: "Цех №4-1",
        output: "🪤[Бильце - напівфабрикат] (Б.Флізелін 101, %Диван Розмір Бильця%)",
        requiredInputs: [
          "🪵[Бильце - нарізана деревина] (Модель, %Диван Розмір Бильця%)",
          "🧩[Бильце - нарізані деталі] (Б.Флізелін 101, %Диван Розмір Бильця%)",
        ],
      },
      {
        workshop: "Цех №6",
        output: "🪤🧽[Каркас + Поролон - напівфабрикат 2] (Угол Леон-Люкс 200 Колеса, %Диван Пружинний Блок%, %Дно Каркасу%, %Диван Розмір Бильця%, %Колір Матеріалу%)",
        requiredInputs: [
          "🪤[Бильце - напівфабрикат] (Б.Флізелін 101, %Диван Розмір Бильця%)",
        ],
      },
    ],
  },
  {
    name: "Ланцюг Планка",
    steps: [
      {
        workshop: "Цех №2-3",
        output: "🧩[Планка - нарізані деталі] (Планка 263)",
        requiredInputs: [],
      },
      {
        workshop: "Цех №4-3",
        output: "🪤[Планка - напівфабрикат] (Планка 263)",
        requiredInputs: ["🧩[Планка - нарізані деталі] (Планка 263)"],
      },
      {
        workshop: "Цех №9 ",
        output: "Диван Угол Леон-Люкс 200 Колеса",
        requiredInputs: ["🪤[Планка - напівфабрикат] (Планка 263)"],
      },
    ],
  },
  {
    name: "Ланцюг Ламінат (Д.Леон-Люкс Колеса)",
    steps: [
      {
        workshop: "Цех №3-1",
        output: "🧩[Ламінат - нарізані деталі] (Д.Леон-Люкс Колеса, %Колір Матеріалу%)",
        requiredInputs: [],
      },
      {
        workshop: "Цех №4-2",
        output: "🪤[Каркас - напівфабрикат] (Д.Леон-Люкс Колеса, %Дно Каркасу%, %Колір Матеріалу%)",
        requiredInputs: [
          "🧩[Ламінат - нарізані деталі] (Д.Леон-Люкс Колеса, %Колір Матеріалу%)",
        ],
      },
    ],
  },
  {
    name: "Ланцюг Ламінат (143П)",
    steps: [
      {
        workshop: "Цех №3-1",
        output: "🧩[Ламінат - нарізані деталі] (143П, %Колір Матеріалу%)",
        requiredInputs: [],
      },
      {
        workshop: "Цех №4-2",
        output: "🪤[Каркас - напівфабрикат] (143П, %Дно Каркасу%, %Колір Матеріалу%)",
        requiredInputs: [
          "🧩[Ламінат - нарізані деталі] (143П, %Колір Матеріалу%)",
        ],
      },
    ],
  },
  {
    name: "Ланцюг Накладка",
    steps: [
      {
        workshop: "Цех №3-2",
        output: "🪤[Накладка] (Д.Леон-Люкс, %Колір Матеріалу%)",
        requiredInputs: [],
      },
      {
        workshop: "Цех №9 ",
        output: "Диван Угол Леон-Люкс 200 Колеса",
        requiredInputs: ["🪤[Накладка] (Д.Леон-Люкс, %Колір Матеріалу%)"],
      },
    ],
  },
  {
    name: "Ланцюг Чохол",
    steps: [
      {
        workshop: "Цех №7",
        output: "🧩[Чохол - нарізані матеріали] (Угол Леон-Люкс 200 Колеса, %Тканина%, %Диван Розмір Бильця%)",
        requiredInputs: [],
      },
      {
        workshop: "Цех №8",
        output: "🪤[Чохол - напівфабрикат] (Угол Леон-Люкс 200 Колеса, %Тканина%, %Диван Розмір Бильця%)",
        requiredInputs: [
          "🧩[Чохол - нарізані матеріали] (Угол Леон-Люкс 200 Колеса, %Тканина%, %Диван Розмір Бильця%)",
        ],
      },
      {
        workshop: "Цех №9 ",
        output: "Диван Угол Леон-Люкс 200 Колеса",
        requiredInputs: [
          "🪤[Чохол - напівфабрикат] (Угол Леон-Люкс 200 Колеса, %Тканина%, %Диван Розмір Бильця%)",
        ],
      },
    ],
  },
  {
    name: "Ланцюг Подушка",
    steps: [
      {
        workshop: "Цех №5-1",
        output: "[Наволочка] (Д.Леон-Люкс)",
        requiredInputs: [],
      },
      {
        workshop: "Цех №9-1",
        output: "[Подушка] (Д.Леон-Люкс,",
        requiredInputs: ["[Наволочка] (Д.Леон-Люкс)"],
      },
      {
        workshop: "Цех №9 ",
        output: "Диван Угол Леон-Люкс 200 Колеса",
        requiredInputs: ["[Подушка] (Д.Леон-Люкс,"],
      },
    ],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const EMOJI_PREFIX = /^[🪵🧩🪤🧽]/u;
// also match lines like "[Подушка] (...)" or "Диван Угол Леон-Люкс (...)"
const BRACKET_PREFIX = /^\[.+\]\s*\(/u;
const SOFA_PREFIX = /^Диван\s+/u;
// matches "- 2 шт." or "-2шт." at end of line — used for stripping qty
const QTY_SUFFIX = /-\s*\d*\s*шт\.?\s*$/;
// matches "- шт." anywhere in line (allows trailing garbage) — used for detection
const QTY_RE = /-\s*\d*\s*шт/;
// matches Цех №9-1, Цех №9, etc. — used to disambiguate sections
const SECTION_HEADER = /^#+\s*(Цех\s*№[\d\-]+)/u;

function stripLineComment(line: string): string {
  let s = line;
  // Strip <!-- ... --> HTML comments
  s = s.replace(/<!--.*?-->/g, "");
  // Strip // inline comments
  const slashIdx = s.indexOf("//");
  if (slashIdx >= 0) s = s.slice(0, slashIdx);
  return s.trim();
}

function hasQty(line: string): boolean {
  return QTY_RE.test(stripLineComment(line));
}

function stripQty(line: string): string {
  return stripLineComment(line).replace(QTY_SUFFIX, "").trim();
}

function isProductLine(line: string): boolean {
  const t = stripLineComment(line);
  return (
    (EMOJI_PREFIX.test(t) && t.includes("[")) ||
    BRACKET_PREFIX.test(t) ||
    SOFA_PREFIX.test(t)
  );
}

// ─── Parser ─────────────────────────────────────────────────────────────────

function parseDocument(
  fileLines: string[]
): Map<string, { header: string; boms: BomBlock[] }> {
  const sections = new Map<string, { header: string; boms: BomBlock[] }>();

  let currentKey: string | null = null;
  let currentHeader = "";
  let i = 0;

  // current bom tracking
  let currentOutput = "";
  let currentOutputIdx = -1;
  let currentInputs: string[] = [];
  let currentRawInputLines: string[] = [];
  let currentLastInputIdx = -1;

  function flushBom() {
    if (currentKey && currentOutput) {
      const sec = sections.get(currentKey)!;
      sec.boms.push({
        output: currentOutput,
        inputs: currentInputs,
        rawInputLines: currentRawInputLines,
        outputLineIdx: currentOutputIdx,
        lastInputLineIdx: currentLastInputIdx,
      });
    }
    currentOutput = "";
    currentOutputIdx = -1;
    currentInputs = [];
    currentRawInputLines = [];
    currentLastInputIdx = -1;
  }

  for (i = 0; i < fileLines.length; i++) {
    const raw = fileLines[i];
    const trimmed = raw.trim();

    // New section?
    const hMatch = SECTION_HEADER.exec(trimmed);
    if (hMatch) {
      flushBom();
      currentKey = hMatch[1].trim(); // e.g. "Цех №4-1"
      currentHeader = trimmed;
      if (!sections.has(currentKey)) {
        sections.set(currentKey, { header: currentHeader, boms: [] });
      }
      continue;
    }

    if (!currentKey) continue;

    if (isProductLine(trimmed)) {
      if (hasQty(trimmed)) {
        // It's an input line
        if (currentOutput) {
          const stripped = stripQty(trimmed);
          currentInputs.push(stripped);
          currentRawInputLines.push(raw);
          currentLastInputIdx = i;
        }
      } else {
        // It's an output line — start new BOM block
        flushBom();
        currentOutput = stripLineComment(trimmed);
        currentOutputIdx = i;
      }
    }
  }
  flushBom();

  return sections;
}

// ─── Normalize product string (strip attributes, keep name + productId) ─────

/**
 * Normalizes a product string to just "[name] (productId" for fuzzy matching.
 * This makes the chain checker robust to attribute additions/renames.
 * e.g. "🪵[Каркас - нарізана деревина] (Д.Леон-Люкс Колеса, %Attr%)" →
 *      "🪵[Каркас - нарізана деревина] (Д.Леон-Люкс Колеса"
 */
function normalizeProduct(s: string): string {
  const parenOpen = s.indexOf("(");
  if (parenOpen < 0) return s.trim();
  const inner = s.slice(parenOpen + 1);
  const sepIdx = inner.search(/[,%]/);
  const productId =
    sepIdx >= 0 ? inner.slice(0, sepIdx).trim() : inner.replace(/\).*/, "").trim();
  return s.slice(0, parenOpen + 1) + productId;
}

// ─── Find BOM block ──────────────────────────────────────────────────────────

function findBom(
  sections: Map<string, { header: string; boms: BomBlock[] }>,
  workshopKeyword: string,
  outputContains: string
): BomBlock | null {
  // workshopKeyword like "Цех №4-1" or "Цех №9 "
  const key = workshopKeyword.trim();
  const sec = sections.get(key);
  if (!sec) return null;

  const normRequired = normalizeProduct(outputContains);
  for (const bom of sec.boms) {
    if (normalizeProduct(bom.output).includes(normRequired)) return bom;
  }
  return null;
}

// ─── Zero-consumption detection ─────────────────────────────────────────────

/**
 * Returns true if the BOM output's section has ONLY zero-quantity material lines
 * (e.g. "Дерево - 0 m³") and NO positive-quantity material lines.
 * This means the product exists in the document but has no actual consumption.
 */
function hasZeroConsumption(
  bom: BomBlock,
  fileLines: string[]
): boolean {
  let foundZero = false;
  // Scan lines after the output, before the next product/section
  for (let i = bom.outputLineIdx + 1; i < fileLines.length; i++) {
    const t = fileLines[i].trim();
    if (!t) continue;
    if (t.startsWith("#")) break;  // new section
    if (isProductLine(t)) break;   // next BOM block

    // Positive quantity: "- 1.5 m³" etc. (non-zero digit)
    if (/[-]\s*[1-9][\d.,]*\s*(m³|m²|m|кг|шт)[.]?\b/u.test(t)) return false;
    // Zero quantity: "- 0 m³" etc.
    if (/[-]\s*0+([.,]0*)?\s*(m³|m²|m|кг|шт)[.]?\b/u.test(t)) foundZero = true;
  }
  return foundZero;
}

// Returns indices of the output line + all non-empty content lines (materials, Ціна) of a BOM
function getBomContentLines(bom: BomBlock, fileLines: string[]): number[] {
  const result: number[] = [bom.outputLineIdx];
  for (let i = bom.outputLineIdx + 1; i < fileLines.length; i++) {
    const t = fileLines[i].trim();
    if (!t) continue;
    if (t.startsWith("#")) break;
    if (isProductLine(t)) break;
    result.push(i);
  }
  return result;
}

// Returns true if a product (by normalized string) appears as a commented-out line anywhere in the file
function isCommentedOutInFile(fileLines: string[], normProduct: string): boolean {
  return fileLines.some((line) => {
    if (!line.includes("<!--")) return false;
    const content = line.replace(/<!--/g, "").replace(/-->/g, "");
    return normalizeProduct(content).includes(normProduct);
  });
}

// ─── Collect all known chain outputs ────────────────────────────────────────

function buildKnownOutputs(): Set<string> {
  const known = new Set<string>();
  for (const chain of CHAINS) {
    for (const step of chain.steps) {
      known.add(step.output);
    }
  }
  return known;
}

// ─── Orphan detection ────────────────────────────────────────────────────────

/**
 * Returns the model/product identifier from an output line, e.g.
 * "🪵[Бильце] (Б.Верадо, %Attr%)" → "Б.Верадо"
 * "🪵[Бильце]"                     → "" (no id — template leftover)
 * "🪤[Накладка] (%Attr%)"          → "" (only attribute, no id)
 */
function getProductId(output: string): string {
  const parenOpen = output.indexOf("(");
  if (parenOpen < 0) return "";
  const inner = output.slice(parenOpen + 1);
  const sepIdx = inner.search(/[,%]/);
  const content = sepIdx >= 0 ? inner.slice(0, sepIdx).trim() : inner.replace(/\).*/, "").trim();
  if (content.startsWith("%")) return "";
  return content;
}

/**
 * Returns line indices of the full BOM block: output line + all content lines
 * (materials AND input product lines), stopping before the next output or section.
 */
function getBomAllLineIndices(bom: BomBlock, fileLines: string[]): number[] {
  const result: number[] = [bom.outputLineIdx];
  for (let i = bom.outputLineIdx + 1; i < fileLines.length; i++) {
    const t = fileLines[i].trim();
    if (!t) continue;
    if (t.startsWith("#")) break;
    if (/^(або|Або|АБО)$/.test(t)) break;
    if (isProductLine(t) && !hasQty(t)) break; // next output line
    result.push(i);
  }
  return result;
}

/**
 * Find emoji-prefixed outputs (🪤/🧩/🪵) that are never consumed as inputs
 * in any subsequent workshop. These are "dead-end" semi-finished products.
 *
 * Outputs WITHOUT a model name in parentheses are template leftovers —
 * auto-fixed by commenting out the whole BOM block ([FIX]).
 * Outputs WITH a model name are real breaks needing human attention ([BREAK]),
 * and a TODO comment is inserted after the output line in the document.
 */
function detectOrphans(
  sections: Map<string, { header: string; boms: BomBlock[] }>,
  fileLines: string[]
): { issues: string[]; fixes: Fix[] } {
  const issues: string[] = [];
  const fixes: Fix[] = [];

  const produced: Array<{ section: string; norm: string; raw: string; bom: BomBlock }> = [];
  const consumedNorms: string[] = [];

  for (const [key, sec] of sections) {
    for (const bom of sec.boms) {
      if (EMOJI_PREFIX.test(bom.output)) {
        produced.push({ section: key, norm: normalizeProduct(bom.output), raw: bom.output, bom });
      }
      for (const inp of bom.inputs) {
        consumedNorms.push(normalizeProduct(inp));
      }
    }
  }

  const seen = new Set<string>();
  const commentedLines = new Set<number>(); // avoid double-commenting same line

  for (const out of produced) {
    const dedupeKey = `${out.section}::${out.norm}`;
    if (seen.has(dedupeKey)) continue;

    const consumed = consumedNorms.some(
      (c) => c.includes(out.norm) || out.norm.includes(c)
    );
    if (!consumed) {
      seen.add(dedupeKey);

      const productId = getProductId(out.raw);

      if (!productId) {
        // No model name → template leftover, auto-comment-out entire BOM block
        for (const lineIdx of getBomAllLineIndices(out.bom, fileLines)) {
          if (!commentedLines.has(lineIdx)) {
            commentedLines.add(lineIdx);
            const orig = fileLines[lineIdx].trim();
            // Don't double-wrap lines already commented out
            const wrapped = orig.startsWith("<!--") ? orig : `<!-- ${orig} -->`;
            fixes.push({ lineIdx, content: wrapped, type: "replace" });
          }
        }
        const msg = `[FIX] ${out.section}: видалено шаблонний рядок без назви моделі: "${out.raw}"`;
        console.log(`  ${msg}`);
        issues.push(msg);
      } else {
        // Named orphan → human must fix, insert TODO comment in document
        // Skip if TODO already present (idempotent re-runs)
        const alreadyHasTodo = fileLines
          .slice(out.bom.outputLineIdx + 1, out.bom.outputLineIdx + 5)
          .some((l) => l.includes("<!-- TODO: [BREAK]"));
        if (!commentedLines.has(out.bom.outputLineIdx) && !alreadyHasTodo) {
          fixes.push({
            lineIdx: out.bom.outputLineIdx,
            content: `<!-- TODO: [BREAK] цей напівфабрикат виробляється але ніде не споживається -->`,
            type: "insert-after",
          });
        }
        const msg = `[BREAK] ${out.section}: напівфабрикат виробляється але ніде не споживається: "${out.raw}"`;
        console.log(`  ${msg}`);
        issues.push(msg);
      }
    }
  }

  return { issues, fixes };
}

// ─── Main verification ───────────────────────────────────────────────────────

interface Fix {
  lineIdx: number;
  content: string;
  type: "insert-after" | "replace";
}

function verify(
  fileLines: string[],
  sections: Map<string, { header: string; boms: BomBlock[] }>
): { fixes: Fix[]; issues: string[] } {
  const fixes: Fix[] = [];
  const issues: string[] = [];
  const knownOutputs = buildKnownOutputs();
  const issueSet = new Set<string>(); // deduplicate fixes
  const zeroSourceScheduled = new Set<number>(); // outputLineIdx of sources already scheduled for commenting

  for (const chain of CHAINS) {
    for (let si = 0; si < chain.steps.length; si++) {
      const step = chain.steps[si];
      if (step.requiredInputs.length === 0) continue;

      const bom = findBom(sections, step.workshop, step.output);
      if (!bom) {
        console.warn(
          `  [WARN] BOM not found: ${step.workshop} → "${step.output}"`
        );
        continue;
      }

      for (const required of step.requiredInputs) {
        const normRequired = normalizeProduct(required);

        // Check active inputs (normalize to ignore attribute changes)
        const activePresent = bom.inputs.some((inp) =>
          normalizeProduct(inp).includes(normRequired)
        );
        if (activePresent) continue;

        // Check commented-out inputs — already acknowledged on a previous run
        const searchStart = bom.outputLineIdx + 1;
        const commentedPresent = fileLines
          .slice(searchStart, Math.min(fileLines.length, searchStart + 30))
          .some((line) => {
            if (!line.includes("<!--")) return false;
            const content = line.replace(/<!--/g, "").replace(/-->/g, "");
            return normalizeProduct(content).includes(normRequired);
          });
        if (commentedPresent) continue;

        const fixKey = `${bom.outputLineIdx}::${required}`;
        if (issueSet.has(fixKey)) continue;
        issueSet.add(fixKey);

        const insertAfter =
          bom.lastInputLineIdx >= 0 ? bom.lastInputLineIdx : bom.outputLineIdx;

        // Find source BOM and check zero consumption
        let sourceHasZero = false;
        let sourceBomToComment: BomBlock | null = null;

        for (let prevSi = 0; prevSi < si; prevSi++) {
          const prevStep = chain.steps[prevSi];
          const normPrevOut = normalizeProduct(prevStep.output);
          if (!normPrevOut.includes(normalizeProduct(required))) continue;

          const sourceBom = findBom(sections, prevStep.workshop, prevStep.output);
          if (sourceBom && hasZeroConsumption(sourceBom, fileLines)) {
            sourceHasZero = true;
            sourceBomToComment = sourceBom;
          } else if (!sourceBom && isCommentedOutInFile(fileLines, normPrevOut)) {
            // Source was already commented out by a previous run
            sourceHasZero = true;
          }
          break;
        }

        if (sourceHasZero) {
          // Comment out the source BOM lines (output + materials) if not already done
          if (sourceBomToComment && !zeroSourceScheduled.has(sourceBomToComment.outputLineIdx)) {
            zeroSourceScheduled.add(sourceBomToComment.outputLineIdx);
            const contentLines = getBomContentLines(sourceBomToComment, fileLines);
            for (const lineIdx of contentLines) {
              const orig = fileLines[lineIdx].trim();
              const suffix = lineIdx === sourceBomToComment.outputLineIdx ? " - уточнити списання" : "";
              fixes.push({ lineIdx, content: `<!-- ${orig}${suffix} -->`, type: "replace" });
            }
            console.log(
              `  [ZERO] ${chain.name}: закоментовано BOM з нульовим списанням "${sourceBomToComment.output}"`
            );
            issues.push(`[ZERO] ${chain.name}: закоментовано BOM з нульовим списанням "${sourceBomToComment.output}"`);
          }
          // Insert commented reference in the consumer workshop
          console.log(
            `  [ZERO] ${chain.name} @ ${step.workshop}: нульове списання "${required}" — закоментовано`
          );
          issues.push(`[ZERO] ${chain.name} @ ${step.workshop}: нульове списання "${required}"`);
          fixes.push({
            lineIdx: insertAfter,
            content: `<!-- ${required} - 1 шт. уточнити списання -->`,
            type: "insert-after",
          });
        } else {
          console.log(
            `  [BREAK] ${chain.name} @ ${step.workshop}: відсутній вхід "${required}"`
          );
          issues.push(`[BREAK] ${chain.name} @ ${step.workshop}: відсутній вхід "${required}"`);
          fixes.push({
            lineIdx: insertAfter,
            content: `${required} - 1 шт. <!-- Тут забули перенести товар -->`,
            type: "insert-after",
          });
        }
      }
    }
  }

  // Check for inputs not declared in any chain output (appears from nowhere)
  for (const [key, sec] of sections) {
    for (const bom of sec.boms) {
      for (let ii = 0; ii < bom.inputs.length; ii++) {
        const inp = bom.inputs[ii];
        const normInp = normalizeProduct(inp);
        const inChain = [...knownOutputs].some((out) =>
          normInp.includes(normalizeProduct(out))
        );
        if (!inChain) continue; // not related to any chain → skip

        // It's referenced in chains but does the output actually exist?
        const producedSomewhere = [...knownOutputs].some((out) =>
          normInp.includes(normalizeProduct(out))
        );
        if (producedSomewhere) continue;

        const rawLine = bom.rawInputLines[ii];
        const rawIdx = fileLines.indexOf(rawLine, bom.outputLineIdx);
        if (rawIdx < 0) continue;

        const warnKey = `warn::${rawIdx}`;
        if (issueSet.has(warnKey)) continue;
        issueSet.add(warnKey);

        console.log(
          `  [WARN] ${key}: вхід "${inp}" не зустрічався раніше в жодному ланцюгу`
        );
        issues.push(`[WARN] ${key}: вхід "${inp}" не зустрічався раніше в жодному ланцюгу`);
        fixes.push({
          lineIdx: rawIdx - 1,
          content: `<!-- !!! Раніше ви не зазначали про цей товар -->`,
          type: "insert-after",
        });
      }
    }
  }

  return { fixes, issues };
}

// ─── Apply fixes ─────────────────────────────────────────────────────────────

function applyFixes(fileLines: string[], fixes: Fix[]): string[] {
  if (fixes.length === 0) return fileLines;

  // Sort descending so higher-index operations don't shift lower-index ones
  fixes.sort((a, b) => b.lineIdx - a.lineIdx);

  const result = [...fileLines];
  for (const fix of fixes) {
    if (fix.type === "replace") {
      result[fix.lineIdx] = fix.content;
    } else {
      result.splice(fix.lineIdx + 1, 0, fix.content);
    }
  }
  return result;
}

// ─── Library export ──────────────────────────────────────────────────────────

/**
 * Run chain checks on in-memory content.
 * Returns the fixed content and list of issues found.
 */
export function runChainCheck(content: string, fileName: string): { content: string; issues: string[] } {
  console.log(`\nЛанцюги: ${fileName}`);
  const fileLines = content.split("\n");
  const sections = parseDocument(fileLines);
  console.log(`  Секцій знайдено: ${sections.size}`);

  const { fixes: verifyFixes, issues: verifyIssues } = verify(fileLines, sections);
  const { issues: orphanIssues, fixes: orphanFixes } = detectOrphans(sections, fileLines);

  const allFixes = [...verifyFixes, ...orphanFixes];
  const allIssues = [...verifyIssues, ...orphanIssues];

  if (allFixes.length === 0 && allIssues.length === 0) {
    console.log("  ✅ Всі ланцюги цілі.");
    return { content, issues: [] };
  }

  if (allFixes.length > 0) console.log(`  Виправлень: ${allFixes.length}`);
  return { content: applyFixes(fileLines, allFixes).join("\n"), issues: allIssues };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: ts-node check-chain.ts <path-to-md-file>");
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const original = fs.readFileSync(absPath, "utf-8");
  const fileName = path.basename(absPath);
  const { content: fixed } = runChainCheck(original, fileName);

  if (fixed === original) return;

  const bakPath = absPath + ".bak";
  fs.writeFileSync(bakPath, original, "utf-8");
  console.log(`Оригінал збережено: ${path.basename(bakPath)}`);
  fs.writeFileSync(absPath, fixed, "utf-8");
  console.log(`✅ Файл оновлено з коментарями про розриви.`);
}

if (require.main === module) main();
