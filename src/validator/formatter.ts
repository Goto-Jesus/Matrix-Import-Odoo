import * as fs from 'fs';
import * as path from 'path';

// Авто-виправлення типових помилок форматування сирих документів.
// Не змінює смислову структуру — тільки текстові артефакти.

// Emoji-символи що мають стояти ПЕРЕД дужкою, не всередині
const EMOJI_PREFIXES = ['🪵', '🧩', '🪤🧽', '🪤'];

// Відомі виправлення назв матеріалів (lowercase → правильна назва)
const MATERIAL_FIXES: Record<string, string> = {
  'деровина': 'деревина',
  'компонети': 'компоненти',
  'крошка ппу': 'Крихта ППУ',
  'холофайдер': 'Холофайбер',
  'карказ': 'Каркас',
};

// Виправлення слів що мають бути з великої (в кінці значення атрибуту)
const CAPITALIZE_WORDS = ['механізм', 'колеса', 'бильця', 'бильце'];

function fixEmojiPosition(line: string): string {
  // Перемістити emoji з середини назви на початок
  // Наприклад: "[Каркас - 🪵 нарізана деровина]" → "🪵[Каркас - нарізана деревина]"
  for (const emoji of EMOJI_PREFIXES) {
    // Emoji всередині дужок (зі або без пробілів): [Назва - 🪵 слово] або [Каркас-🧩нарізані]
    const insideRe = new RegExp(`\\[([^\\[\\]]*?)${emoji}\\s*([^\\[\\]]*)\\]`);
    if (insideRe.test(line)) {
      line = line.replace(insideRe, (_match, before, after) => {
        const name = `${before.trim()} ${after.trim()}`.trim();
        return `${emoji}[${name}]`;
      });
    }
  }
  return line;
}

function fixAttributeSpaces(line: string): string {
  // "(Б. Нео)" → "(Б.Нео)", "(Д. Нео-3)" → "(Д.Нео-3)"
  return line.replace(/\(([^)]+)\)/g, (match, inner) => {
    const fixed = inner.replace(/\.\s+/g, '.');
    return `(${fixed})`;
  });
}

function fixAttributeCapitalization(line: string): string {
  // Остання частина значення атрибуту має бути з великої: "механізм" → "Механізм"
  return line.replace(/\(([^)]+)\)/g, (match, inner) => {
    let fixed = inner;
    for (const word of CAPITALIZE_WORDS) {
      const wordRe = new RegExp(`\\b${word}\\b`, 'gi');
      fixed = fixed.replace(wordRe, word.charAt(0).toUpperCase() + word.slice(1));
    }
    return `(${fixed})`;
  });
}

function fixAttributeSpacing100dsp(line: string): string {
  // "(100 ДСП Механізм)" → "(100ДСП Механізм)"
  return line.replace(/\(([^)]*)\)/g, (match, inner) => {
    const fixed = inner.replace(/100\s+ДСП/g, '100ДСП');
    return `(${fixed})`;
  });
}

function fixMaterialNames(line: string): string {
  let result = line;
  for (const [wrong, correct] of Object.entries(MATERIAL_FIXES)) {
    // Не використовуємо \b бо воно не матчить кирилицю; замість цього — case-insensitive пошук
    const re = new RegExp(wrong, 'gi');
    result = result.replace(re, correct);
  }
  return result;
}

function fixTrailingSpacesInBrackets(line: string): string {
  // "[Ламінат - нарізані деталі ]" → "[Ламінат - нарізані деталі]"
  return line.replace(/\[\s*([^\]]+?)\s*\]/g, (match, inner) => `[${inner.trim()}]`);
}

function fixMissingSpaceBeforeDash(line: string): string {
  // "[Планка- нарізані]" → "[Планка - нарізані]"
  return line.replace(/\[([^\]]*[^\s\-])-\s/g, (match, p1) => `[${p1} - `);
}

function fixPriceTypo(line: string): string {
  // "Цшна" → "Ціна" (поширена опечатка)
  return line.replace(/Цшна\b/gi, 'Ціна');
}

function fixWorkshopHeaders(line: string): string {
  // "Цех №N Назва - КОД "Операція"" → "# Цех №N Назва - КОД "Операція""
  // Тільки якщо рядок починається з "Цех №" без "#"
  if (/^Цех\s+№/.test(line.trim())) {
    return '# ' + line.trimStart();
  }
  return line;
}

export interface FormatterResult {
  content: string;
  changes: string[];
}

export function formatDocument(inputPath: string): FormatterResult {
  const original = fs.readFileSync(inputPath, 'utf-8');
  const originalLines = original.split('\n');
  const changes: string[] = [];

  const fixedLines = originalLines.map((line, i) => {
    const lineNum = i + 1;
    let fixed = line;

    const prev = fixed;
    fixed = fixEmojiPosition(fixed);
    if (fixed !== prev) changes.push(`Рядок ${lineNum}: emoji перенесено перед дужку`);

    const prev2 = fixed;
    fixed = fixTrailingSpacesInBrackets(fixed);
    if (fixed !== prev2) changes.push(`Рядок ${lineNum}: пробіли в дужках видалено`);

    const prev3 = fixed;
    fixed = fixMissingSpaceBeforeDash(fixed);
    if (fixed !== prev3) changes.push(`Рядок ${lineNum}: додано пробіл перед тире в назві`);

    const prev4 = fixed;
    fixed = fixAttributeSpaces(fixed);
    if (fixed !== prev4) changes.push(`Рядок ${lineNum}: пробіл після крапки в атрибуті прибрано`);

    const prev5 = fixed;
    fixed = fixAttributeCapitalization(fixed);
    if (fixed !== prev5) changes.push(`Рядок ${lineNum}: капіталізація в атрибуті виправлена`);

    const prev6 = fixed;
    fixed = fixAttributeSpacing100dsp(fixed);
    if (fixed !== prev6) changes.push(`Рядок ${lineNum}: "100 ДСП" → "100ДСП"`);

    const prev7 = fixed;
    fixed = fixMaterialNames(fixed);
    if (fixed !== prev7) changes.push(`Рядок ${lineNum}: назву матеріалу виправлено`);

    const prev8 = fixed;
    fixed = fixPriceTypo(fixed);
    if (fixed !== prev8) changes.push(`Рядок ${lineNum}: "Цшна" → "Ціна"`);

    const prev9 = fixed;
    fixed = fixWorkshopHeaders(fixed);
    if (fixed !== prev9) changes.push(`Рядок ${lineNum}: заголовок цеху отримав "# " префікс`);

    return fixed;
  });

  return {
    content: fixedLines.join('\n'),
    changes,
  };
}

export function writeFormattedDocument(inputPath: string, outputDir: string): FormatterResult {
  const result = formatDocument(inputPath);
  const fileName = path.basename(inputPath);
  const outPath = path.join(outputDir, fileName);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outPath, result.content, 'utf-8');
  return result;
}
