import * as fs from "fs";
import * as path from "path";

// Авто-виправлення типових помилок форматування сирих документів.
// Не змінює смислову структуру — тільки текстові артефакти.

// Emoji-символи що мають стояти ПЕРЕД дужкою, не всередині
const EMOJI_PREFIXES = ["🪵", "🧩", "🪤🧽", "🪤"];

// Виправлення назв матеріалів (lowercase → правильна назва)
const MATERIAL_FIXES: Record<string, string> = {
  деровина: "деревина",
  компонети: "компоненти",
  "крошка ппу": "Крихта ППУ",
  холофайдер: "Холофайбер", // product template name in Odoo
  карказ: "Каркас",
  cинтепон: "Синтепон", // латинська C замість кириличної С
};

// UOM нормалізація: неправильні форми → канонічна форма
const UOM_NORMALIZE: Record<string, string> = {
  kg: "кг",
  кg: "кг", // мікс кирилиці+латиниці
  кг: "кг", // вже правильно, для уніфікації пробілу
  g: "г",
  м: "m",
  метр: "m",
  м2: "m²",
  m2: "m²",
  м3: "m³",
  m3: "m³",
  шт: "шт.",
};

// Прибрати зайві пробіли: leading whitespace + consecutive spaces → single space
function fixLineWhitespace(line: string): string {
  const trimmed = line.trimStart();
  if (
    !trimmed ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("<<") ||
    trimmed.startsWith("#")
  )
    return line;
  return trimmed.replace(/[ \t]{2,}/g, " ").trimEnd();
}

// Зчитати які атрибути є ✅ (активними) з секції АТРИБУТИ документу
function parseActiveAttrs(content: string): Set<string> {
  const active = new Set<string>();
  const re = /"([^"]+)"[,\s]*✅/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    let name = m[1].trim();
    // Нормалізувати до Odoo-написання (один н в "Пружинний")
    name = name.replace("Пружинний", "Пружинний");
    active.add(name);
  }
  return active;
}

function fixEmojiPosition(line: string): string {
  for (const emoji of EMOJI_PREFIXES) {
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
  // "(Б. Нео)" → "(Б.Нео)"
  return line.replace(/\(([^)]+)\)/g, (match, inner) => {
    const fixed = inner.replace(/\.\s+/g, ".");
    return `(${fixed})`;
  });
}

function fixAttributeCapitalization(line: string): string {
  return line.replace(/\(([^)]+)\)/g, (_match, inner) => {
    // Capitalize first letter of each standalone Cyrillic word (2+ chars, not mid-word)
    // Negative lookbehind prevents capitalizing suffixes like "ех" in "Цех" or "ерадо" in "Верадо"
    const fixed = inner.replace(
      /(?<![А-ЯҐЄІЇЁа-яґєіїё])[а-яґєіїє]{2,}/g,
      (word: string) => word.charAt(0).toUpperCase() + word.slice(1),
    );
    return `(${fixed})`;
  });
}

function fixAttributeSpacing100dsp(line: string): string {
  return line.replace(/\(([^)]*)\)/g, (match, inner) => {
    const fixed = inner.replace(/100\s+ДСП/g, "100ДСП");
    return `(${fixed})`;
  });
}

function fixMaterialNames(line: string): string {
  let result = line;
  for (const [wrong, correct] of Object.entries(MATERIAL_FIXES)) {
    const re = new RegExp(wrong, "gi");
    result = result.replace(re, correct);
  }
  return result;
}

function fixTrailingSpacesInBrackets(line: string): string {
  return line.replace(
    /\[\s*([^\]]+?)\s*\]/g,
    (match, inner) => `[${inner.trim()}]`,
  );
}

function fixMissingSpaceBeforeDash(line: string): string {
  return line.replace(/\[([^\]]*[^\s\-])-\s/g, (match, p1) => `[${p1} - `);
}

function fixPriceTypo(line: string): string {
  return line.replace(/Цшна\b/gi, "Ціна");
}

function fixWorkshopHeaders(line: string): string {
  if (/^Цех\s+№/.test(line.trim())) {
    return "# " + line.trimStart();
  }
  return line;
}

// "[Ніжка] h30 - qty" → "[Ніжка] (h30) - qty" — attribute value must be in parens
function fixMissingAttrParens(line: string): string {
  return line.replace(
    /(\[[^\]]+\])\s+([^(\s-][^\s-]*)\s+-\s*([\d])/,
    "$1 ($2) - $3",
  );
}

// "(Д.Верадо )" → "(Д.Верадо)" — trailing/leading пробіли всередині круглих дужок
function fixTrailingSpacesInParens(line: string): string {
  return line.replace(
    /\(\s*([^)]+?)\s*\)/g,
    (_m, inner) => `(${inner.trim()})`,
  );
}

// "(Д.Верадо - 1.00 шт." → "(Д.Верадо) - 1.00 шт."  — відсутня закриваюча дужка
function fixUnclosedParen(line: string): string {
  const open = (line.match(/\(/g) || []).length;
  const close = (line.match(/\)/g) || []).length;
  if (open <= close) return line;
  return line.replace(/(\([^)]+?)\s*(-\s*[\d,.]+)/, "$1) $2");
}

// ") -qty uom" або ")-qty uom" → ") - qty uom"
// Безпечно: тільки після ] або ), щоб не зачіпати "9-1", "ST-2535", "Нео-3"
function fixDashBeforeQty(line: string): string {
  return line.replace(
    /([\]\)])\s*-(\d[\d,.]*\s*[а-яА-ЯҐЄІЇa-zA-Z²³])/g,
    "$1 - $2",
  );
}

// Нормалізація одиниць виміру: "1.60 kg" → "1.60 кг", "0.042м3" → "0.042 m³"
function fixUom(line: string): string {
  return line.replace(
    /(-\s*)([\d,.]+)\s*([а-яА-ЯҐЄІЇa-zA-Z][а-яА-ЯҐЄІЇa-zA-Z0-9]*\.?)\s*$/,
    (_match, dash, qty, uom) => {
      const raw = uom.replace(/\.$/, "");
      const normalized =
        UOM_NORMALIZE[raw.toLowerCase()] ?? UOM_NORMALIZE[raw] ?? uom;
      return `${dash}${qty} ${normalized}`;
    },
  );
}

// "Поролон (ST-2535) (2000x1600x20) - 1.60 кг" → "[Поролон] (ST-2535 (2000x1600x20)) - 1.60 кг"
function fixPorolonFormat(line: string): string {
  return line.replace(
    /^(\s*)Поролон\s+\(([^)]+)\)\s+\(([^)]+)\)/,
    (_m, indent, code, dims) => `${indent}[Поролон] (${code} (${dims}))`,
  );
}

// "Войлок 1.60 - 2.00 m" → "[Войлок] (1.60) - 2.00 m"
function fixVoylokFormat(line: string): string {
  return line.replace(
    /^(\s*)Войлок\s+([\d.]+)\s*-/,
    (_m, indent, size) => `${indent}[Войлок] (${size}) -`,
  );
}

// "ДСП - qty" → "[ДСП] - qty",  "ДВП - qty" → "[ДВП] (Звичайний) - qty"
// "ДВП qtyuom" (no dash) → "[ДВП] (Звичайний) - qtyuom"
function fixBareProducts(line: string): string {
  const trimmed = line.trim();
  if (
    trimmed.startsWith("[") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("//")
  )
    return line;
  // ДСП with dash
  line = line.replace(/^(\s*)ДСП(\s+-)/, "$1[ДСП]$2");
  // ДСП without dash (qty directly follows)
  line = line.replace(/^(\s*)ДСП\s+([\d,.])/, "$1[ДСП] - $2");
  // ДВП with dash
  line = line.replace(/^(\s*)ДВП(\s+-)/, "$1[ДВП] (Звичайний)$2");
  // ДВП without dash (qty directly follows)
  line = line.replace(/^(\s*)ДВП\s+([\d,.])/, "$1[ДВП] (Звичайний) - $2");
  return line;
}

// [ДСП]/[ДВП](...) без одиниці виміру в кінці → додати m²
function fixDefaultUomForSheetMaterials(line: string): string {
  const trimmed = line.trim();
  if (!/^\[ДСП\]|^\[ДВП\]/.test(trimmed)) return line;
  // only fires when line ends with just a number (no UOM after it)
  return line.replace(
    /([\]\)])\s*-\s*([\d,.]+)\s*$/,
    (_, bracket, qty) => `${bracket} - ${qty} m²`,
  );
}

// "[Соединитель] (83 эконом)-2 шт." → "[Соединитель] (83 эконом) - 2 шт."
function fixConnectorFormat(line: string): string {
  // "[Соединитель] (83 эконом)- 2 шт" or "[Соединитель] (83 эконом)-2 шт." → "[Соединитель] (83 эконом) - 2 шт."
  return line.replace(
    /^(\s*)Соединитель\s+(.+?)-(\d+)\s*шт\.?\s*$/,
    "$1[Соединитель] ($2) - $3 шт.",
  );
}

// "Зацеп краб 10-шт" → "Зацеп краб - 10 шт."  (qty-uom stuck together without space)
function fixQtyDashUom(line: string): string {
  const trimmed = line.trim();
  if (
    trimmed.startsWith("[") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("//") ||
    !trimmed
  )
    return line;
  return line.replace(
    /^(\s*)(.+?)\s+(\d+(?:[.,]\d+)?)-(шт\.?)\s*$/,
    "$1$2 - $3 шт.",
  );
}

// "Фанера 0.83м2" → "Фанера - 0.83м2"  (UOM normalised later by fixUom)
function fixMissingDashForBareMaterial(line: string): string {
  return line.replace(/^(\s*)(Фанера)\s+([\d,.]+)/, "$1$2 - $3");
}

// "Планка 198 - 1шт." → "🧩[Планка - нарізані деталі] (Планка 198) - 1 шт."
function fixPlankaBareComponent(line: string): string {
  return line.replace(
    /^(\s*)Планка\s+(\S+)\s+-\s*([\d,.]+)\s*шт\.?\s*$/,
    "$1🧩[Планка - нарізані деталі] (Планка $2) - $3 шт.",
  );
}

// "Ціна 7грн" → "Ціна 7 грн"
function fixPriceFormat(line: string): string {
  return line.replace(/^(\s*Ціна\s+[\d.]+)(грн)\s*$/i, "$1 $2");
}

// Document-level: copy attribute from "🧩[X - нарізані ...] (Attr)" to adjacent "🪤[X - напівфабрикат]"
function fixMissingNapivfabrykatAttr(
  lines: string[],
  changes: string[],
): string[] {
  const result = [...lines];
  for (let i = 0; i < result.length; i++) {
    const m = result[i].match(/^(.*🪤\[([^\]]+?)\s*-\s*напівфабрикат\])\s*$/);
    if (!m) continue;
    const prefix = m[1];
    const key = m[2].trim().toLowerCase();
    for (let j = i + 1; j < result.length && j < i + 20; j++) {
      const next = result[j].trim();
      if (next.startsWith("#") && next.includes("№")) break;
      const cm = next.match(
        /🧩\[([^\]]+?)\s*-\s*нарізані[^\]]*\]\s*\(([^)]+)\)/,
      );
      if (cm && cm[1].trim().toLowerCase() === key) {
        result[i] = `${prefix} (${cm[2]})`;
        changes.push(
          `Рядок ${i + 1}: додано атрибут напівфабрикату "(${cm[2]})"`,
        );
        break;
      }
    }
  }
  return result;
}

// Document-level: insert "Ціна 0 грн" before next workshop header when price is missing
function insertMissingPrices(lines: string[], changes: string[]): string[] {
  const result: string[] = [];
  let inWorkshop = false;
  let workshopHasPrice = false;
  let workshopLabel = "";

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const isHeader = trimmed.startsWith("#") && trimmed.includes("№");

    if (isHeader) {
      if (inWorkshop && !workshopHasPrice) {
        result.push("Ціна 0 грн");
        result.push("");
        changes.push(`Цех "${workshopLabel}": додано відсутню "Ціна 0 грн"`);
      }
      workshopLabel = trimmed.match(/^#+\s*(Цех\s+№[\w-]+)/)?.[1] ?? trimmed;
      workshopHasPrice = false;
      inWorkshop = true;
    }

    if (inWorkshop && /^ціна\s+[\d.]+\s*грн/i.test(trimmed)) {
      workshopHasPrice = true;
    }

    result.push(lines[i]);
  }

  if (inWorkshop && !workshopHasPrice) {
    result.push("Ціна 0 грн");
    changes.push(`Цех "${workshopLabel}": додано відсутню "Ціна 0 грн"`);
  }

  return result;
}

// "[Ламінат] (712x220)" → "🧩[Ламінат - лист] (712x220)", Cyrillic х → Latin x in sizes
function fixLaminateName(line: string): string {
  return line.replace(
    /\[Ламінат\](\s*)(\([^)]+\))/g,
    (_m, space, parens) =>
      `🧩[Ламінат - лист]${space || " "}${parens.replace(/х/g, "x")}`,
  );
}

// "[Тканина] (Рене 4) - N m" → "[Тканина] (%Тканина%) - N m"  (тільки якщо Тканина ✅)
function fixTkanynaPlaceholder(line: string, activeAttrs: Set<string>): string {
  if (!activeAttrs.has("Тканина")) return line;
  // Не чіпати якщо вже є % (placeholder)
  return line.replace(
    /(\[Тканина\]\s*)\(([^%][^)]*)\)/,
    (_m, prefix) => `${prefix}(%Тканина%)`,
  );
}

// Додати // @Діван Наповнювач Подушек=... до рядків з Холофайбером і Крихтою ППУ (якщо атрибут ✅)
function fixFillingTag(line: string, activeAttrs: Set<string>): string {
  if (!activeAttrs.has("Диван Наповнювач Подушек")) return line;
  if (line.includes("// @")) return line; // вже є тег
  const t = line.trim();
  if (/^Холофайбер\s+-/.test(t)) {
    return line.trimEnd() + " // @Диван Наповнювач Подушек=Холофайдер";
  }
  if (/^Крихта ППУ\s+-/.test(t)) {
    return line.trimEnd() + " // @Диван Наповнювач Подушек=ППУ Крихта";
  }
  return line;
}

// Виправити написання в // @ тегах до Odoo-стандарту
function fixAttrTagSpelling(line: string): string {
  if (!line.includes("// @")) return line;
  return (
    line
      // "Пружинний" (два н) → "Пружинний" (один н) в назві атрибута
      .replace(/\/\/\s*@Диван Пружинний Блок=/g, "// @Диван Пружинний Блок=")
      // "Посилений" (один н) → "Посиленний" (два н) у значенні атрибута
      .replace(
        /(\/\/\s*@Диван Пружинний Блок=Посилений)\b/g,
        "// @Диван Пружинний Блок=Посиленний",
      )
  );
}

export interface FormatterResult {
  content: string;
  changes: string[];
}

export function formatDocument(inputPath: string): FormatterResult {
  const original = fs.readFileSync(inputPath, "utf-8");
  const originalLines = original.split("\n");
  const changes: string[] = [];

  const activeAttrs = parseActiveAttrs(original);

  const fixedLines = originalLines.map((line, i) => {
    const lineNum = i + 1;
    let fixed = line;

    const apply = (fn: (l: string) => string, msg: string) => {
      const prev = fixed;
      fixed = fn(fixed);
      if (fixed !== prev) changes.push(`Рядок ${lineNum}: ${msg}`);
    };

    apply(fixLineWhitespace, "зайві пробіли прибрано");
    apply(fixEmojiPosition, "emoji перенесено перед дужку");
    apply(fixTrailingSpacesInBrackets, "пробіли в квадратних дужках видалено");
    apply(fixTrailingSpacesInParens, "пробіли в круглих дужках видалено");
    apply(fixUnclosedParen, "додано відсутню закриваючу дужку");
    apply(fixMissingAttrParens, "[Назва] атрибут → [Назва] (атрибут)");
    apply(fixMissingSpaceBeforeDash, "додано пробіл перед тире в назві");
    apply(fixDashBeforeQty, "пробіл після дефіса перед числом додано");
    apply(fixAttributeSpaces, "пробіл після крапки в атрибуті прибрано");
    apply(fixAttributeCapitalization, "капіталізація в атрибуті виправлена");
    apply(fixAttributeSpacing100dsp, '"100 ДСП" → "100ДСП"');
    apply(fixBareProducts, "ДСП/ДВП → [ДСП]/[ДВП] (Звичайний)");
    apply(
      fixDefaultUomForSheetMaterials,
      "додано відсутню одиницю виміру m² для ДСП/ДВП",
    );
    apply(
      fixMissingDashForBareMaterial,
      "додано пропущений дефіс перед кількістю",
    );
    apply(
      fixPlankaBareComponent,
      "Планка NNN - qty → 🧩[Планка - нарізані деталі] (Планка NNN)",
    );
    apply(
      fixConnectorFormat,
      "Соединитель: → [Соединитель] (атрибут) - qty шт.",
    );
    apply(fixQtyDashUom, "qty-шт → - qty шт.");
    apply(fixPorolonFormat, "Поролон: два парени → [Поролон] (код (розмір))");
    apply(fixVoylokFormat, "Войлок: додано дужки та квадратні дужки");
    apply(fixLaminateName, "[Ламінат] (розмір) → 🧩[Ламінат - лист] (розмір)");
    apply(fixMaterialNames, "назву матеріалу виправлено");
    apply(fixPriceTypo, '"Цшна" → "Ціна"');
    apply(fixPriceFormat, '"Ціна Nгрн" → "Ціна N грн"');
    apply(fixWorkshopHeaders, 'заголовок цеху отримав "# " префікс');
    apply(fixUom, "одиницю виміру нормалізовано");
    apply(
      (l) => fixTkanynaPlaceholder(l, activeAttrs),
      "[Тканина] (назва) → [Тканина] (%Тканина%)",
    );
    apply(
      (l) => fixFillingTag(l, activeAttrs),
      "додано // @Диван Наповнювач Подушек=... тег",
    );
    apply(
      fixAttrTagSpelling,
      "написання в // @ тегу виправлено до Odoo-стандарту",
    );

    return fixed;
  });

  // Document-level passes (require multi-line context)
  let processedLines = fixMissingNapivfabrykatAttr(fixedLines, changes);
  processedLines = insertMissingPrices(processedLines, changes);

  return {
    content: processedLines.join("\n"),
    changes,
  };
}

export function writeFormattedDocument(
  inputPath: string,
  outputDir: string,
): FormatterResult {
  const result = formatDocument(inputPath);
  const fileName = path.basename(inputPath);
  const outPath = path.join(outputDir, fileName);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outPath, result.content, "utf-8");
  return result;
}
