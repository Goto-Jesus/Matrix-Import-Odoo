import * as fs from 'fs';
import * as path from 'path';

export interface CheckError {
  line: number;
  severity: 'error' | 'warning';
  message: string;
  original: string;
}

export interface CheckResult {
  errors: CheckError[];
  warnings: CheckError[];
  valid: boolean;
}

// Вилучити список відомих назв продуктів з right_names_odoo_base.md
function loadKnownProducts(basePath: string): Set<string> {
  const known = new Set<string>();
  if (!fs.existsSync(basePath)) return known;

  const content = fs.readFileSync(basePath, 'utf-8');
  const re = /Товар:\s*"?([^"\n\r]+)"?/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const name = m[1].trim().replace(/^\[|\]$/g, '');
    known.add(name.toLowerCase());
  }
  return known;
}

const KNOWN_UOMS = new Set(['шт', 'шт.', 'м', 'm', 'м²', 'm²', 'm2', 'м2', 'м³', 'm³', 'm3', 'м3', 'кг', 'kg', 'г', 'g', 'метр']);

function normalizeUom(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').replace(/\.$/, '');
}

function isKnownUom(uomStr: string): boolean {
  const s = normalizeUom(uomStr);
  return KNOWN_UOMS.has(s) || s.includes('²') || s.includes('³');
}

// Перевірити що emoji стоїть перед дужкою, а не всередині
function checkEmojiPosition(line: string): boolean {
  const EMOJIS = ['🪵', '🧩', '🪤🧽', '🪤'];
  for (const emoji of EMOJIS) {
    if (line.includes(`[`) && line.includes(emoji)) {
      const bracketIdx = line.indexOf('[');
      const emojiIdx = line.indexOf(emoji);
      if (emojiIdx > bracketIdx) return false; // emoji всередині або після дужки
    }
  }
  return true;
}

// Перевірити пробіл після крапки в атрибутах
function checkAttrDotSpaces(line: string): boolean {
  const attrMatch = line.match(/\(([^)]+)\)/g);
  if (!attrMatch) return true;
  for (const attr of attrMatch) {
    if (/\.\s+[А-ЯҐЄІЇа-яґєії]/.test(attr)) return false;
  }
  return true;
}

// Перевірити кількість: qty > 0
function checkQty(qtyStr: string): boolean {
  const qty = parseFloat(qtyStr.replace(',', '.'));
  return qty > 0;
}

export function checkDocument(filePath: string, referenceBasePath?: string): CheckResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const errors: CheckError[] = [];
  const warnings: CheckError[] = [];

  const knownProducts = referenceBasePath ? loadKnownProducts(referenceBasePath) : new Set<string>();

  let inWorkshop = false;
  let hasWorkshops = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;

    // Workshop header
    if (trimmed.startsWith('#') && trimmed.includes('Цех')) {
      const m = trimmed.match(/^#+\s*Цех\s+№([\w-]+)\s+(.+?)\s+-\s+(\S+)\s+["“](.+?)["”]\s*$/);
      if (!m) {
        errors.push({
          line: lineNum,
          severity: 'error',
          message: `Некоректний заголовок цеху. Очікується: # Цех №N Назва - КОД "Операція (Цех №N)"`,
          original: trimmed,
        });
      }
      inWorkshop = true;
      hasWorkshops = true;
      continue;
    }

    if (!inWorkshop) continue;
    if (trimmed.startsWith('//') || trimmed.startsWith('<<') || trimmed === 'або' || trimmed === 'Або' || trimmed === '---') continue;

    // Check emoji position
    if (!checkEmojiPosition(line)) {
      errors.push({
        line: lineNum,
        severity: 'error',
        message: `Emoji має стояти ПЕРЕД дужкою: 🪵[Назва], не [Назва - 🪵 слово]`,
        original: trimmed,
      });
    }

    // Check dot spaces in attributes
    if (!checkAttrDotSpaces(line)) {
      errors.push({
        line: lineNum,
        severity: 'error',
        message: `Пробіл після крапки в атрибуті. Правильно: (Б.Нео), не (Б. Нео)`,
        original: trimmed,
      });
    }

    // Check "100 ДСП" with space
    if (/\(.*100\s+ДСП.*\)/.test(line)) {
      errors.push({
        line: lineNum,
        severity: 'error',
        message: `Пробіл між "100" і "ДСП". Правильно: (100ДСП Механізм)`,
        original: trimmed,
      });
    }

    // Check known material names
    if (/\bКрошка\b/i.test(trimmed)) {
      errors.push({
        line: lineNum,
        severity: 'error',
        message: `Неправильна назва: "Крошка ППУ" → "Крихта ППУ"`,
        original: trimmed,
      });
    }
    if (/\bХолофайдер\b/i.test(trimmed)) {
      errors.push({
        line: lineNum,
        severity: 'error',
        message: `Неправильна назва: "Холофайдер" → "Холофайбер"`,
        original: trimmed,
      });
    }
    if (/\bдеровина\b/i.test(trimmed)) {
      errors.push({
        line: lineNum,
        severity: 'error',
        message: `Друкарська помилка: "деровина" → "деревина"`,
        original: trimmed,
      });
    }

    // Check UOM in component lines
    const compQtyMatch = line.match(/-\s*([\d,.]+)\s*([^\s]+)\s*$/);
    if (compQtyMatch) {
      const qtyStr = compQtyMatch[1];
      const uomStr = compQtyMatch[2];
      if (!checkQty(qtyStr)) {
        warnings.push({
          line: lineNum,
          severity: 'warning',
          message: `Кількість = 0 або від'ємна: "${qtyStr}"`,
          original: trimmed,
        });
      }
      if (!isKnownUom(uomStr)) {
        warnings.push({
          line: lineNum,
          severity: 'warning',
          message: `Невідома одиниця виміру: "${uomStr}". Відомі: шт, m, m², m³, кг, г`,
          original: trimmed,
        });
      }
    }

    // Check product names against known list (warning only — product might be new)
    if (knownProducts.size > 0) {
      const bracketMatch = trimmed.match(/\[([^\]]+)\]/);
      if (bracketMatch) {
        const productName = bracketMatch[1].trim().toLowerCase();
        if (!knownProducts.has(productName)) {
          warnings.push({
            line: lineNum,
            severity: 'warning',
            message: `Товар "${bracketMatch[1].trim()}" не знайдено в right_names_odoo_base.md`,
            original: trimmed,
          });
        }
      }
    }
  }

  if (!hasWorkshops) {
    errors.push({
      line: 0,
      severity: 'error',
      message: `Файл не містить жодного заголовку цеху (# Цех №N ...)`,
      original: '',
    });
  }

  return {
    errors,
    warnings,
    valid: errors.length === 0,
  };
}

export function formatCheckReport(result: CheckResult, filePath: string): string {
  const lines: string[] = [];
  const fileName = path.basename(filePath);

  lines.push(`# Звіт валідації: ${fileName}`);
  lines.push('');

  if (result.valid && result.warnings.length === 0) {
    lines.push('✅ Помилок не знайдено. Файл готовий до імпорту.');
    return lines.join('\n');
  }

  if (result.errors.length > 0) {
    lines.push(`## ❌ Помилки (${result.errors.length})`);
    lines.push('');
    for (const e of result.errors) {
      lines.push(`- **Рядок ${e.line}:** ${e.message}`);
      if (e.original) lines.push(`  > \`${e.original}\``);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push(`## ⚠️ Попередження (${result.warnings.length})`);
    lines.push('');
    for (const w of result.warnings) {
      lines.push(`- **Рядок ${w.line}:** ${w.message}`);
      if (w.original) lines.push(`  > \`${w.original}\``);
    }
  }

  return lines.join('\n');
}
