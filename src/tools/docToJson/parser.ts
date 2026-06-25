import { AttributeVal, BomEntry, ComponentEntry, OperationEntry } from './types';

const ATTR_NAMES = ['Модель', 'Тканина', 'Наповнювач'] as const;

interface WorkshopInfo {
  fullName: string;        // "Цех №1 Дерева (нарізка)"
  operationPrefix: string; // "Операція (Цех №1)"
}

interface ParsedProduct {
  templateName: string;    // "🪵[Каркас - нарізана деревина]" or "Диван"
  isBracketed: boolean;
  attributes: AttributeVal[];
  variantDisplayName: string;
  qty: number;
}

interface ParsedComponent {
  templateName: string;
  attributes: AttributeVal[];
  qty: number;
  uom: string;
  isService: boolean;
}

// Splits a string by top-level commas (ignores commas inside nested parentheses)
function splitTopLevel(s: string): string[] {
  let depth = 0;
  let current = '';
  const parts: string[] = [];
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Extracts attribute values from a "(val1, val2)" string with possible nested parens
function parseAttrString(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return [];
  const inner = trimmed.slice(1, -1);
  return splitTopLevel(inner);
}

function valuesToAttributes(values: string[]): AttributeVal[] {
  return values.map((value, i) => ({
    attributeName: ATTR_NAMES[i] ?? `Атрибут${i + 1}`,
    value,
  }));
}

// Finds the FIRST complete outer parenthesized group in s (respects nested parens)
function extractFirstOuterParen(s: string): string {
  const start = s.indexOf('(');
  if (start === -1) return '';
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return '';
}

// Splits a full product line into: emoji+template, attrString, qty, uom
// Correctly handles nested parens: "[Поролон] (ST-2535 (2000x1600x20)) - 2.4 кг"
//   → prefix="[Поролон]", attrStr="(ST-2535 (2000x1600x20))", qty=2.4, uom="кг"
function splitLineParts(line: string): { prefix: string; attrStr: string; qty: number | null; uom: string } | null {
  // Strip qty+uom from the end: " - qty uom"
  const qtyMatch = line.match(/\s+-\s+([\d,.]+)\s+([\S]+)\s*$/);
  let qty: number | null = null;
  let uom = '';
  let body = line;

  if (qtyMatch) {
    qty = parseFloat(qtyMatch[1].replace(',', '.'));
    uom = qtyMatch[2].trim().replace(/\.$/, '');
    body = line.slice(0, line.length - qtyMatch[0].length);
  }

  // body is now: "emoji[Name] (attrs)", "emoji[Name]", or "Name (attrs)"
  const bracketOpen = body.indexOf('[');
  const bracketClose = body.lastIndexOf(']');

  if (bracketOpen !== -1 && bracketClose !== -1) {
    // Has brackets — prefix is everything through ']' (includes emoji)
    const prefix = body.slice(0, bracketClose + 1).trim();
    const remainder = body.slice(bracketClose + 1).trim();
    // The attr string is the FIRST outer paren group after ']'
    const attrStr = extractFirstOuterParen(remainder);
    return { prefix, attrStr, qty, uom };
  } else {
    // No brackets — split at first '('
    const parenIdx = body.indexOf('(');
    if (parenIdx !== -1) {
      const prefix = body.slice(0, parenIdx).trim();
      const attrStr = extractFirstOuterParen(body.slice(parenIdx));
      return { prefix, attrStr, qty, uom };
    }
    // No parens either — just a plain name with optional qty
    return { prefix: body.trim(), attrStr: '', qty, uom };
  }
}

// Returns the full template name including emoji and brackets
function buildTemplateName(emoji: string, bracketName: string, isBracketed: boolean): string {
  if (isBracketed) return `${emoji}[${bracketName}]`;
  return bracketName;
}

function buildVariantDisplayName(templateName: string, attrValues: string[]): string {
  if (attrValues.length === 0) return templateName;
  return `${templateName} (${attrValues.join(', ')})`;
}

// Try to parse a line as a product (main BOM output)
// Returns null if the line doesn't look like a product at all
function tryParseProduct(line: string, isFirstInSection: boolean): ParsedProduct | null {
  const trimmed = line.trim();
  if (!trimmed || isSkipLine(trimmed)) return null;

  const parts = splitLineParts(trimmed);
  if (!parts) return null;

  const { prefix, attrStr, qty, uom } = parts;

  // Check for (Послуга) prefix — service, treat as component not product
  if (trimmed.startsWith('(Послуга)')) return null;

  // Bracketed product: emoji[Name]
  const bracketMatch = prefix.match(/^([\p{Emoji}\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}🪤🧩🪵🧽]*)\[([^\]]+)\]$/u);
  if (bracketMatch) {
    const emoji = bracketMatch[1].trim();
    const bracketName = bracketMatch[2].trim();
    const attrValues = attrStr ? parseAttrString(attrStr) : [];
    const templateName = buildTemplateName(emoji, bracketName, true);
    const attributes = valuesToAttributes(attrValues);
    const variantDisplayName = buildVariantDisplayName(templateName, attrValues);

    // If it has qty but we already have a product, treat as component (caller checks)
    if (qty !== null && !isFirstInSection) return null;

    return {
      templateName,
      isBracketed: true,
      attributes,
      variantDisplayName,
      qty: qty ?? 1,
    };
  }

  // Plain product: Name (attrs) — no qty OR qty only if first in section
  if (attrStr && prefix && (qty === null || isFirstInSection)) {
    // Make sure prefix doesn't look like a component (no dashes at start, etc.)
    if (/^[А-ЯҐЄІЇA-Zа-яґєіїa-z0-9\s-]+$/u.test(prefix)) {
      const attrValues = parseAttrString(attrStr);
      const attributes = valuesToAttributes(attrValues);
      const variantDisplayName = buildVariantDisplayName(prefix, attrValues);
      return {
        templateName: prefix,
        isBracketed: false,
        attributes,
        variantDisplayName,
        qty: qty ?? 1,
      };
    }
  }

  return null;
}

// Try to parse a line as a component
function tryParseComponent(line: string): ParsedComponent | null {
  const trimmed = line.trim();
  if (!trimmed || isSkipLine(trimmed)) return null;

  // (Послуга) Name - qty uom
  const serviceMatch = trimmed.match(/^\(Послуга\)\s+(.+?)\s+-\s+([\d,.]+)\s+([\S]+)\s*$/);
  if (serviceMatch) {
    return {
      templateName: serviceMatch[1].trim(),
      attributes: [],
      qty: parseFloat(serviceMatch[2].replace(',', '.')),
      uom: serviceMatch[3].trim().replace(/\.$/, ''),
      isService: true,
    };
  }

  const parts = splitLineParts(trimmed);
  if (!parts || parts.qty === null) return null;

  const { prefix, attrStr, qty, uom } = parts;
  if (qty <= 0) return null;

  // Bracketed component: emoji[Name] (attrs) - qty uom
  const bracketMatch = prefix.match(/^([\p{Emoji}\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}🪤🧩🪵🧽]*)\[([^\]]+)\]$/u);
  if (bracketMatch) {
    const emoji = bracketMatch[1].trim();
    const bracketName = bracketMatch[2].trim();
    const attrValues = attrStr ? parseAttrString(attrStr) : [];
    const templateName = buildTemplateName(emoji, bracketName, true);
    return {
      templateName,
      attributes: valuesToAttributes(attrValues),
      qty,
      uom,
      isService: false,
    };
  }

  // Plain component: Name - qty uom (no parens in prefix)
  if (prefix && !attrStr) {
    // Ensure prefix looks like a product name (not a stray line)
    if (prefix.length > 1) {
      return {
        templateName: prefix,
        attributes: [],
        qty,
        uom,
        isService: false,
      };
    }
  }

  // Plain component with attributes: [Тканина] (Рене 4) - 17.50 m already handled by bracketMatch
  // Or Name (attrs) - qty uom for component
  if (attrStr && prefix) {
    const attrValues = parseAttrString(attrStr);
    return {
      templateName: prefix,
      attributes: valuesToAttributes(attrValues),
      qty,
      uom,
      isService: false,
    };
  }

  return null;
}

// Lines that should always be skipped
function isSkipLine(line: string): boolean {
  const t = line.trim();
  return (
    !t ||
    t.startsWith('//') ||
    t.startsWith('<<') ||
    t.startsWith('>>') ||
    t === 'або' ||
    t === 'Або' ||
    t === '---' ||
    t.startsWith('Ціна') ||
    t.startsWith('#') ||
    t.startsWith('[') && !t.includes(']') // malformed bracket
  );
}

function parsePrice(line: string): number {
  const m = line.match(/Ціна\s+([\d,.]+)/);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
}

function parseWorkshopHeader(line: string): WorkshopInfo | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('#')) return null;

  // Standard: # Цех №1 Name - Code “OperationPrefix”
  // Two-step: first extract workshop number/name/code, then pull operation from last quoted group
  const baseMatch = trimmed.match(/^#+\s*Цех\s+№([\w-]+)\s+(.+?)\s+-\s+(\S+)/);
  if (baseMatch) {
    const number = baseMatch[1].trim();
    const name = baseMatch[2].trim();
    // Remainder after “- CODE”: find the quoted operation name
    // Quotes may be ASCII “ (U+0022), U+201C, or U+201D
    const remainder = trimmed.slice(baseMatch[0].length).trim();
    // Quotes: ASCII “ (U+0022), LEFT “ (U+201C), RIGHT “ (U+201D)
    // Use new RegExp to guarantee correct Unicode escapes regardless of source file encoding
    const Q = '[\\u201C\\u201D\\u0022]';
    const opMatch = remainder.match(new RegExp(`^${Q}(.+?)${Q}\\s*$`));
    if (opMatch) {
      return {
        fullName: `Цех №${number} ${name}`,
        operationPrefix: opMatch[1].trim(),
      };
    }
    // Fallback: operation prefix not found — use code
    return {
      fullName: `Цех №${number} ${name}`,
      operationPrefix: baseMatch[3].trim(),
    };
  }

  // Special: # ВТК (no code/operation format)
  const vtk = trimmed.match(/^#+\s*(ВТК)\s*$/);
  if (vtk) {
    return {
      fullName: 'ВТК',
      operationPrefix: 'ВТК',
    };
  }

  return null;
}

// Main parsing function — returns array of BomEntry
export function parseDoc(content: string): BomEntry[] {
  const lines = content.split('\n');
  const boms: BomEntry[] = [];

  let currentWorkshop: WorkshopInfo | null = null;
  let currentProduct: ParsedProduct | null = null;
  let currentComponents: ParsedComponent[] = [];
  let currentOpIndex = 0;    // which operation index we're currently filling
  let inHeader = true;        // skip preamble before first workshop
  let isFirstInSection = true; // true after header/або/---
  let isNewWorkshop = false;   // true when a new # Цех header was just seen

  // Built-up operations for the CURRENT bom (may span multiple workshops)
  let currentOperations: OperationEntry[] = [];

  // Start index in boms[] for BOMs in the current workshop price group.
  // Resets on the FIRST product of each new workshop (not on "або" variants).
  let workshopBomStart = 0;

  function flushBom() {
    if (!currentProduct || !currentWorkshop) return;
    if (currentOperations.length === 0) return;

    const components: ComponentEntry[] = currentComponents.map(c => ({
      templateName: c.templateName,
      attributes: c.attributes,
      qty: c.qty,
      uom: c.uom,
      operationIndex: (c as any)._opIndex ?? 0,
      isService: c.isService || undefined,
    }));

    boms.push({
      product: {
        templateName: currentProduct.templateName,
        attributes: currentProduct.attributes,
        variantDisplayName: currentProduct.variantDisplayName,
        qty: currentProduct.qty,
      },
      operations: [...currentOperations],
      components,
    });

    currentProduct = null;
    currentComponents = [];
    currentOperations = [];
    currentOpIndex = 0;
    isFirstInSection = true;
  }

  function flushVariant() {
    flushBom();
  }

  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();

    // Workshop header
    if (trimmed.startsWith('#')) {
      const wh = parseWorkshopHeader(trimmed);
      if (wh) {
        // New workshop — if we transition to a new BOM workshop (not just extending),
        // mark the start of this workshop's BOMs for price back-propagation.
        // Defer flush: wait to see if first content is a product (new BOM) or
        // a component (extends current BOM, e.g. Цех №10, ВТК).
        currentWorkshop = wh;
        isFirstInSection = true;
        isNewWorkshop = true;
        inHeader = false;
        continue;
      }
      // Non-workshop # heading (e.g. "# АТРИБУТИ") — skip
      continue;
    }

    if (inHeader) continue;
    if (!currentWorkshop) continue;

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('<<') || trimmed.startsWith('>>')) continue;

    // Price line — apply to last operation of current BOM AND all previously
    // flushed BOMs in this workshop section (для "або" variants sharing one price)
    if (trimmed.startsWith('Ціна')) {
      const price = parsePrice(trimmed);
      if (currentOperations.length > 0) {
        currentOperations[currentOperations.length - 1].priceRate = price;
      }
      for (let bi = workshopBomStart; bi < boms.length; bi++) {
        const ops = boms[bi].operations;
        if (ops.length > 0) ops[ops.length - 1].priceRate = price;
      }
      continue;
    }

    // "або" separator — flush current BOM, start new variant in same workshop
    if (trimmed === 'або' || trimmed === 'Або') {
      flushVariant();
      isFirstInSection = true;
      continue;
    }

    // "---" separator — flush, new section in same workshop
    if (trimmed === '---') {
      flushVariant();
      isFirstInSection = true;
      continue;
    }

    // If isFirstInSection, try to decide: is this line a main product or a component?
    // NOTE: (Послуга) lines are NOT handled early — they fall through to isFirstInSection
    // so that ВТК-style workshops get their own operation added first.
    if (isFirstInSection) {
      const asProd = tryParseProduct(trimmed, true);
      if (asProd) {
        // This starts a new BOM: flush any accumulated state
        flushBom();
        if (isNewWorkshop) {
          workshopBomStart = boms.length; // new workshop → reset price group window
          isNewWorkshop = false;
        }
        currentProduct = asProd;
        currentOpIndex = 0;
        // Add the first operation for this workshop
        currentOperations.push({
          name: `${currentWorkshop.operationPrefix} ${asProd.variantDisplayName}`,
          workcenterName: currentWorkshop.fullName,
          priceRate: 0,
        });
        isFirstInSection = false;
        continue;
      }

      // Not a product → this workshop EXTENDS the previous BOM (e.g. Цех №10, ВТК)
      if (currentProduct !== null) {
        // Add a new operation for this workshop
        currentOpIndex = currentOperations.length;
        currentOperations.push({
          name: `${currentWorkshop.operationPrefix} ${currentProduct.variantDisplayName}`,
          workcenterName: currentWorkshop.fullName,
          priceRate: 0,
        });
        isFirstInSection = false;
        // Fall through to component parsing below
      }
    }

    // Try as component
    const comp = tryParseComponent(trimmed);
    if (comp) {
      (comp as any)._opIndex = currentOpIndex;
      currentComponents.push(comp);
      continue;
    }
  }

  // Flush last accumulated BOM
  if (currentProduct) {
    const components: ComponentEntry[] = currentComponents.map(c => ({
      templateName: c.templateName,
      attributes: c.attributes,
      qty: c.qty,
      uom: c.uom,
      operationIndex: (c as any)._opIndex ?? 0,
      isService: c.isService || undefined,
    }));
    boms.push({
      product: {
        templateName: currentProduct.templateName,
        attributes: currentProduct.attributes,
        variantDisplayName: currentProduct.variantDisplayName,
        qty: currentProduct.qty,
      },
      operations: currentOperations,
      components,
    });
  }

  return boms;
}
