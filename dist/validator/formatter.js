"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDocumentContent = formatDocumentContent;
exports.formatDocument = formatDocument;
exports.writeFormattedDocument = writeFormattedDocument;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Авто-виправлення типових помилок форматування сирих документів.
// Не змінює смислову структуру — тільки текстові артефакти.
// Emoji-символи що мають стояти ПЕРЕД дужкою, не всередині
const EMOJI_PREFIXES = ["🪵", "🧩", "🪤🧽", "🪤"];
// Виправлення назв матеріалів (lowercase → правильна назва)
const MATERIAL_FIXES = {
    деровина: "деревина",
    компонети: "компоненти",
    "крошка ппу": "Крихта ППУ",
    холофайдер: "Холлофайбер", // product template name in Odoo
    карказ: "Каркас",
    cинтепон: "Синтепон", // латинська C замість кириличної С
};
// UOM нормалізація: неправильні форми → канонічна форма
const UOM_NORMALIZE = {
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
function fixLineWhitespace(line) {
    const trimmed = line.trimStart();
    if (!trimmed ||
        trimmed.startsWith("//") ||
        trimmed.startsWith("<<") ||
        trimmed.startsWith("#"))
        return line;
    const collapsed = trimmed.replace(/[ \t]{2,}/g, " ").trimEnd();
    // 2–4 spaces: instruction body ("Значення", "Впливає", "}" or "[X] = ...").
    // Not Word-dump padding inside workshops.
    if (/^[ \t]{2,4}(Значення|Впливає|\}|\[.*=)/.test(line)) {
        const indent = line.match(/^[ \t]+/)?.[0] ?? "";
        return indent + collapsed;
    }
    return collapsed;
}
// Зчитати які атрибути є ✅ (активними) з секції АТРИБУТИ документу
function parseActiveAttrs(content) {
    const active = new Set();
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
function fixEmojiPosition(line) {
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
// Same mapping as right_names_odoo_base.md (Цех №1–8 manufactured templates).
// More specific rules first. Raw [ДСП]/[Наволочка]/[Подушка] have no suffix → skip.
function emojiForBracketName(name) {
    const n = name.toLowerCase().replace(/\s+/g, " ").trim();
    if (/напівфабрикат\s*2/.test(n) || /\+\s*поролон/.test(n))
        return "🪤🧽";
    if (/нарізана\s+дерев/.test(n))
        return "🪵";
    if (/-\s*лист$/.test(n))
        return "🧩";
    if (/нарізан[іиа]\s+(деталі|матеріали|компонент)/.test(n))
        return "🧩";
    if (/напівфабрикат/.test(n))
        return "🪤";
    return "";
}
function hasEmojiBeforeBracket(line) {
    const t = line.trimStart();
    const bracketIdx = t.indexOf("[");
    if (bracketIdx < 0)
        return false;
    return /[🪵🧩🪤🧽]/.test(t.slice(0, bracketIdx));
}
function fixMissingEmoji(line) {
    const trimmed = line.trimStart();
    if (!trimmed ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("//") ||
        trimmed.startsWith("<<") ||
        trimmed.startsWith("<!--")) {
        return line;
    }
    if (hasEmojiBeforeBracket(line))
        return line;
    return line.replace(/\[([^\[\]]+)\]/, (match, inner) => {
        const emoji = emojiForBracketName(inner);
        return emoji ? `${emoji}[${inner}]` : match;
    });
}
function fixAttributeSpaces(line) {
    // "(Б. Нео)" → "(Б.Нео)"
    return line.replace(/\(([^)]+)\)/g, (match, inner) => {
        const fixed = inner.replace(/\.\s+/g, ".");
        return `(${fixed})`;
    });
}
function fixAttributeCapitalization(line) {
    return line.replace(/\(([^)]+)\)/g, (_match, inner) => {
        // Capitalize first letter of each standalone Cyrillic word (2+ chars, not mid-word)
        // Negative lookbehind prevents capitalizing suffixes like "ех" in "Цех" or "ерадо" in "Верадо"
        const fixed = inner.replace(/(?<![А-ЯҐЄІЇЁа-яґєіїё])[а-яґєіїє]{2,}/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
        return `(${fixed})`;
    });
}
function fixAttributeSpacing100dsp(line) {
    return line.replace(/\(([^)]*)\)/g, (match, inner) => {
        const fixed = inner.replace(/100\s+ДСП/g, "100ДСП");
        return `(${fixed})`;
    });
}
function fixMaterialNames(line) {
    let result = line;
    for (const [wrong, correct] of Object.entries(MATERIAL_FIXES)) {
        const re = new RegExp(wrong, "gi");
        result = result.replace(re, correct);
    }
    return result;
}
function fixTrailingSpacesInBrackets(line) {
    return line.replace(/\[\s*([^\]]+?)\s*\]/g, (match, inner) => `[${inner.trim()}]`);
}
function fixMissingSpaceBeforeDash(line) {
    return line.replace(/\[([^\]]*[^\s\-])-\s/g, (match, p1) => `[${p1} - `);
}
function fixPriceTypo(line) {
    return line.replace(/Цшна\b/gi, "Ціна");
}
function fixWorkshopHeaders(line) {
    if (/^Цех\s+№/.test(line.trim())) {
        return "# " + line.trimStart();
    }
    return line;
}
// "[Ніжка] h30 - qty" → "[Ніжка] (h30) - qty" — attribute value must be in parens
function fixMissingAttrParens(line) {
    return line.replace(/(\[[^\]]+\])\s+([^(\s-][^\s-]*)\s+-\s*([\d])/, "$1 ($2) - $3");
}
// "(Д.Верадо )" → "(Д.Верадо)" — trailing/leading пробіли всередині круглих дужок
function fixTrailingSpacesInParens(line) {
    return line.replace(/\(\s*([^)]+?)\s*\)/g, (_m, inner) => `(${inner.trim()})`);
}
// "(Д.Верадо - 1 шт." → "(Д.Верадо) - 1 шт."  — відсутня закриваюча дужка
function fixUnclosedParen(line) {
    const open = (line.match(/\(/g) || []).length;
    const close = (line.match(/\)/g) || []).length;
    if (open <= close)
        return line;
    return line.replace(/(\([^)]+?)\s*(-\s*[\d,.]+)/, "$1) $2");
}
// ") -qty uom" або ")-qty uom" → ") - qty uom"
// Безпечно: тільки після ] або ), щоб не зачіпати "9-1", "ST-2535", "Нео-3"
function fixDashBeforeQty(line) {
    return line.replace(/([\]\)])\s*-(\d[\d,.]*\s*[а-яА-ЯҐЄІЇa-zA-Z²³])/g, "$1 - $2");
}
// Нормалізація одиниць виміру: "1.60 kg" → "1.60 кг", "0.042 m³" → "0.042 m³"
function fixUom(line) {
    return line.replace(/(-\s*)([\d,.]+)\s*([а-яА-ЯҐЄІЇa-zA-Z][а-яА-ЯҐЄІЇa-zA-Z0-9]*\.?)\s*$/, (_match, dash, qty, uom) => {
        const raw = uom.replace(/\.$/, "");
        const normalized = UOM_NORMALIZE[raw.toLowerCase()] ?? UOM_NORMALIZE[raw] ?? uom;
        return `${dash}${qty} ${normalized}`;
    });
}
// "Поролон (ST-2535) (2000x1600x20) - 1.60 кг" → "[Поролон] (ST-2535 (2000x1600x20)) - 1.60 кг"
function fixPorolonFormat(line) {
    return line.replace(/^(\s*)Поролон\s+\(([^)]+)\)\s+\(([^)]+)\)/, (_m, indent, code, dims) => `${indent}[Поролон] (${code} (${dims}))`);
}
// "Войлок 1.60 - 2 m" → "[Войлок] (1.60) - 2 m"
function fixVoylokFormat(line) {
    return line.replace(/^(\s*)Войлок\s+([\d.]+)\s*-/, (_m, indent, size) => `${indent}[Войлок] (${size}) -`);
}
// "ДСП - qty" → "[ДСП] - qty",  "ДВП - qty" → "[ДВП] (Звичайний) - qty"
// "ДВП qtyuom" (no dash) → "[ДВП] (Звичайний) - qtyuom"
function fixBareProducts(line) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("//"))
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
function fixDefaultUomForSheetMaterials(line) {
    const trimmed = line.trim();
    if (!/^\[ДСП\]|^\[ДВП\]/.test(trimmed))
        return line;
    // only fires when line ends with just a number (no UOM after it)
    return line.replace(/([\]\)])\s*-\s*([\d,.]+)\s*$/, (_, bracket, qty) => `${bracket} - ${qty} m²`);
}
// "Соединитель 83 эконом-2 шт." → "Соединитель 83 эконом - 2 шт."
// function fixConnectorFormat(line: string): string {
//   // "Соединитель 83 эконом- 2 шт" or "Соединитель 83 эконом-2 шт." → "Соединитель 83 эконом - 2 шт."
//   return line.replace(
//     /^(\s*)Соединитель\s+(.+?)-(\d+)\s*шт\.?\s*$/,
//     "$1[Соединитель] ($2) - $3 шт.",
//   );
// }
// "Зацеп краб 10-шт" → "Зацеп краб - 10 шт."  (qty-uom stuck together without space)
function fixQtyDashUom(line) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("//") ||
        !trimmed)
        return line;
    return line.replace(/^(\s*)(.+?)\s+(\d+(?:[.,]\d+)?)-(шт\.?)\s*$/, "$1$2 - $3 шт.");
}
// "Фанера - 0.83 m² m²" → "Фанера - 0.83 m²"  (UOM normalised later by fixUom)
function fixMissingDashForBareMaterial(line) {
    return line.replace(/^(\s*)(Фанера)\s+([\d,.]+)/, "$1$2 - $3");
}
// "Планка 198 - 1шт." → "🧩[Планка - нарізані деталі] (Планка 198) - 1 шт."
function fixPlankaBareComponent(line) {
    return line.replace(/^(\s*)Планка\s+(\S+)\s+-\s*([\d,.]+)\s*шт\.?\s*$/, "$1🧩[Планка - нарізані деталі] (Планка $2) - $3 шт.");
}
// "Ціна 7грн" → "Ціна 7 грн"
function fixPriceFormat(line) {
    return line.replace(/^(\s*Ціна\s+[\d.]+)(грн)\s*$/i, "$1 $2");
}
// Document-level: copy attribute from "🧩[X - нарізані ...] (Attr)" to adjacent "🪤[X - напівфабрикат]"
function fixMissingNapivfabrykatAttr(lines, changes) {
    const result = [...lines];
    for (let i = 0; i < result.length; i++) {
        const m = result[i].match(/^(.*🪤\[([^\]]+?)\s*-\s*напівфабрикат\])\s*$/);
        if (!m)
            continue;
        const prefix = m[1];
        const key = m[2].trim().toLowerCase();
        for (let j = i + 1; j < result.length && j < i + 20; j++) {
            const next = result[j].trim();
            if (next.startsWith("#") && next.includes("№"))
                break;
            const cm = next.match(/🧩\[([^\]]+?)\s*-\s*нарізані[^\]]*\]\s*\(([^)]+)\)/);
            if (cm && cm[1].trim().toLowerCase() === key) {
                result[i] = `${prefix} (${cm[2]})`;
                changes.push(`Рядок ${i + 1}: додано атрибут напівфабрикату "(${cm[2]})"`);
                break;
            }
        }
    }
    return result;
}
// Document-level: insert "Ціна 0 грн" before next workshop header when price is missing
function insertMissingPrices(lines, changes) {
    const result = [];
    let inWorkshop = false;
    let workshopHasPrice = false;
    let workshopHasContent = false;
    let workshopLabel = "";
    const closeWorkshop = () => {
        if (inWorkshop && !workshopHasPrice && workshopHasContent) {
            result.push("Ціна 0 грн <!-- ? -->");
            result.push("");
            changes.push(`Цех "${workshopLabel}": додано відсутню "Ціна 0 грн <!-- ? -->"`);
        }
    };
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        const isHeader = trimmed.startsWith("#") && trimmed.includes("№");
        if (isHeader) {
            closeWorkshop();
            workshopLabel = trimmed.match(/^#+\s*(Цех\s+№[\w-]+)/)?.[1] ?? trimmed;
            workshopHasPrice = false;
            workshopHasContent = false;
            inWorkshop = true;
        }
        else if (inWorkshop && trimmed) {
            workshopHasContent = true;
        }
        if (inWorkshop && /^ціна\s+[\d.]+\s*грн/i.test(trimmed)) {
            workshopHasPrice = true;
        }
        result.push(lines[i]);
    }
    if (inWorkshop && !workshopHasPrice && workshopHasContent) {
        result.push("Ціна 0 грн <!-- ? -->");
        changes.push(`Цех "${workshopLabel}": додано відсутню "Ціна 0 грн <!-- ? -->"`);
    }
    return result;
}
// "[Ламінат] (712x220)" → "🧩[Ламінат - лист] (712x220)", Cyrillicx→ Latin x in sizes
function fixLaminateName(line) {
    return line.replace(/\[Ламінат\](\s*)(\([^)]+\))/g, (_m, space, parens) => `🧩[Ламінат - лист]${space || " "}${parens.replace(/х/g, "x")}`);
}
// "[Тканина] (Рене 4) - N m" → "[Тканина] (%Тканина%) - N m"  (тільки якщо Тканина ✅)
function fixTkanynaPlaceholder(line, activeAttrs) {
    if (!activeAttrs.has("Тканина"))
        return line;
    // Не чіпати якщо вже є % (placeholder)
    return line.replace(/(\[Тканина\]\s*)\(([^%][^)]*)\)/, (_m, prefix) => `${prefix}(%Тканина%)`);
}
// "[ДВП дно] (Двп Белое\Двп)" → "[ДВП дно] (%Дно Каркасу%)"  (тільки якщо Дно Каркасу ✅)
function fixDnoKarkasuPlaceholder(line, activeAttrs) {
    if (!activeAttrs.has("Дно Каркасу"))
        return line;
    if (line.includes("%Дно Каркасу%"))
        return line;
    // Явне значення (ДВП Черновое / ДВП Білий) — не замінювати на placeholder
    if (/\[ДВП дно\]\s*\(ДВП (Черновое|Білий)\)/i.test(line))
        return line;
    return line.replace(/(\[ДВП дно\])\s*\([^)]+\)/, "$1 (%Дно Каркасу%)");
}
function fixDnoExplicitComment(line, activeAttrs) {
    if (!activeAttrs.has("Дно Каркасу"))
        return line;
    // Прибрати <!-- ДВП ... --> підказку, якщо вже є явне значення (Черновое/Білий)
    if (!/\[ДВП дно\]\s*\(ДВП (Черновое|Білий)\)/i.test(line))
        return line;
    return line.replace(/\s*<!--\s*ДВП[^>]*-->/g, "").trimEnd();
}
// Document-level: до кожного "[ДВП дно] (%Дно Каркасу%)" рядка додати inline підказку
function insertDnoKarkasuComment(lines, changes, activeAttrs) {
    if (!activeAttrs.has("Дно Каркасу"))
        return lines;
    const result = [...lines];
    for (let i = 0; i < result.length; i++) {
        if (/\[ДВП дно\].*%Дно Каркасу%/.test(result[i]) &&
            !result[i].includes("<!-- ДВП")) {
            result[i] = result[i].trimEnd() + " <!-- ДВП Білий або ДВП Черновое -->";
            changes.push(`Рядок ${i + 1}: додано inline коментар-підказку для %Дно Каркасу%`);
        }
    }
    return result;
}
// Виправити написання в // @ тегах до Odoo-стандарту
function fixAttrTagSpelling(line) {
    if (!line.includes("// @"))
        return line;
    return (line
        // "Пружинний" (два н) → "Пружинний" (один н) в назві атрибута
        .replace(/\/\/\s*@Диван Пружинний Блок=/g, "// @Диван Пружинний Блок=")
        // "Посилений" (один н) → "Посиленний" (два н) у значенні атрибута
        .replace(/(\/\/\s*@Диван Пружинний Блок=Посилений)\b/g, "// @Диван Пружинний Блок=Посилений"));
}
function formatDocumentContent(original) {
    const originalLines = original.split("\n");
    const changes = [];
    const activeAttrs = parseActiveAttrs(original);
    const fixedLines = originalLines.map((line, i) => {
        const lineNum = i + 1;
        let fixed = line;
        const apply = (fn, msg) => {
            const prev = fixed;
            fixed = fn(fixed);
            if (fixed !== prev)
                changes.push(`Рядок ${lineNum}: ${msg}`);
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
        apply(fixDefaultUomForSheetMaterials, "додано відсутню одиницю виміру m² для ДСП/ДВП");
        apply(fixMissingDashForBareMaterial, "додано пропущений дефіс перед кількістю");
        apply(fixPlankaBareComponent, "Планка NNN - qty → 🧩[Планка - нарізані деталі] (Планка NNN)");
        // apply(
        //   fixConnectorFormat,
        //   "Соединитель: → [Соединитель] (атрибут) - qty шт.",
        // );
        apply(fixQtyDashUom, "qty-шт → - qty шт.");
        apply(fixPorolonFormat, "Поролон: два парени → [Поролон] (код (розмір))");
        apply(fixVoylokFormat, "Войлок: додано дужки та квадратні дужки");
        apply(fixLaminateName, "[Ламінат] (розмір) → 🧩[Ламінат - лист] (розмір)");
        apply(fixMaterialNames, "назву матеріалу виправлено");
        apply(fixMissingEmoji, "додано відсутній emoji-префікс");
        apply(fixPriceTypo, '"Цшна" → "Ціна"');
        apply(fixPriceFormat, '"Ціна Nгрн" → "Ціна N грн"');
        apply(fixWorkshopHeaders, 'заголовок цеху отримав "# " префікс');
        apply(fixUom, "одиницю виміру нормалізовано");
        apply((l) => fixTkanynaPlaceholder(l, activeAttrs), "[Тканина] (назва) → [Тканина] (%Тканина%)");
        apply((l) => fixDnoKarkasuPlaceholder(l, activeAttrs), "[ДВП дно] (назва) → [ДВП дно] (%Дно Каркасу%)");
        apply((l) => fixDnoExplicitComment(l, activeAttrs), "[ДВП дно] (ДВП ...) — видалено зайвий коментар-підказку");
        apply(fixAttrTagSpelling, "написання в // @ тегу виправлено до Odoo-стандарту");
        return fixed;
    });
    // Document-level passes (require multi-line context)
    let processedLines = fixMissingNapivfabrykatAttr(fixedLines, changes);
    processedLines = fixAttrMarkersOnProducts(processedLines, changes, activeAttrs);
    processedLines = insertDnoKarkasuComment(processedLines, changes, activeAttrs);
    processedLines = removeDuplicateAboBlocks(processedLines, changes);
    processedLines = insertMissingPrices(processedLines, changes);
    processedLines = mergeDanglingQty(processedLines, changes);
    processedLines = compressWorkshopBlanks(processedLines, changes);
    let content = processedLines.join("\n");
    if (original.endsWith("\n") && !content.endsWith("\n"))
        content += "\n";
    return {
        content,
        changes,
    };
}
const QTY_ONLY_RE = /^-\s*([\d.,]*)\s*(шт\.?|кг|m³|m²|m|г)?\s*$/iu;
function looksLikeProductLine(line) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("//") || t.startsWith("<<")) {
        return false;
    }
    if (!t.includes("[") && !/^(Диван|Ліжко)\b/.test(t))
        return false;
    return !/-\s*[\d.,]+\s*\S+\s*$/.test(t);
}
function mergeDanglingQty(lines, changes) {
    const result = [];
    let i = 0;
    while (i < lines.length) {
        const cur = lines[i];
        if (!looksLikeProductLine(cur)) {
            result.push(cur);
            i++;
            continue;
        }
        let j = i + 1;
        while (j < lines.length && !lines[j].trim())
            j++;
        const qtyMatch = j < lines.length ? QTY_ONLY_RE.exec(lines[j].trim()) : null;
        if (!qtyMatch) {
            result.push(cur);
            i++;
            continue;
        }
        const qty = qtyMatch[1] || "0";
        let unit = qtyMatch[2] ?? "шт.";
        if (/^шт/i.test(unit))
            unit = "шт.";
        result.push(`${cur.trimEnd()} - ${qty} ${unit}`);
        changes.push(`Рядок ${i + 1}: кількість з окремого рядка приєднано («- ${qty} ${unit}»)`);
        i = j + 1;
    }
    return result;
}
// Сканує рядки після fromIdx (до заголовку або "або") і повертає маркер наповнювача подушок
function scanForFillingMarker(lines, fromIdx) {
    for (let j = fromIdx + 1; j < lines.length && j < fromIdx + 12; j++) {
        const t = lines[j].trim();
        if (t.startsWith("#") || /^або$/i.test(t))
            break;
        if (/^Холлофайбер\s+-/.test(t))
            return "Холлофайбер";
        if (/^Крихта ППУ\s+-/.test(t))
            return "ППУ Крихта";
    }
    return "";
}
// Сканує і повертає "ДВП Білий" або "ДВП Черновое" за наявністю [ДВП] (Білий) у блоці.
// Якщо блок містить [ДВП дно] (%Дно Каркасу%) — значення невідоме, маркер не ставимо.
function scanForDnoMarker(lines, fromIdx) {
    let hasBilyi = false;
    let hasZvychainy = false;
    for (let j = fromIdx + 1; j < lines.length && j < fromIdx + 12; j++) {
        const t = lines[j].trim();
        if (t.startsWith("#") || /^або$/i.test(t))
            break;
        // Явне значення у [ДВП дно] — пріоритет над компонентами
        if (/^\[ДВП дно\]\s*\(ДВП Білий\)/i.test(t))
            return "ДВП Білий";
        if (/^\[ДВП дно\]\s*\(ДВП Черновое\)/i.test(t))
            return "ДВП Черновое";
        if (/^\[ДВП дно\].*%Дно Каркасу%/.test(t))
            return ""; // placeholder — значення невизначено
        // Запасний варіант: виявлення через компоненти [ДВП]
        if (/^\[ДВП\]\s*\(Білий\)/.test(t))
            hasBilyi = true;
        if (/^\[ДВП\]\s*\(Звичайний\)/.test(t))
            hasZvychainy = true;
    }
    if (hasBilyi)
        return "ДВП Білий";
    if (hasZvychainy)
        return "ДВП Черновое";
    return "";
}
// Сканує і визначає тип пружинного блоку за кількістю [Войлок]
function scanForSpringMarker(lines, fromIdx) {
    for (let j = fromIdx + 1; j < lines.length && j < fromIdx + 12; j++) {
        const t = lines[j].trim();
        if (t.startsWith("#") || /^або$/i.test(t))
            break;
        const m = t.match(/^\[Войлок\].*-\s*([\d.,]+)\s*m/);
        if (m) {
            return parseFloat(m[1].replace(",", ".")) >= 3
                ? "Посилений Блок"
                : "Звичайний Блок";
        }
    }
    return "";
}
// Document-level: додає // @Attr=Value маркери до рядків продуктів у цехах 2-2, 5, 9-1.
// Маркер ставиться на рядок продукту (який містить %Атрибут%), а не на компонент.
function fixAttrMarkersOnProducts(lines, changes, activeAttrs) {
    const result = [...lines];
    for (let i = 0; i < result.length; i++) {
        const line = result[i];
        if (!line.includes("%"))
            continue;
        // Цех 9-1: %Диван Наповнювач Подушек%
        if (activeAttrs.has("Диван Наповнювач Подушек") &&
            line.includes("%Диван Наповнювач Подушек%") &&
            !line.includes("// @Диван Наповнювач Подушек=")) {
            const marker = scanForFillingMarker(result, i);
            if (marker) {
                result[i] = line.trimEnd() + ` // @Диван Наповнювач Подушек=${marker}`;
                changes.push(`Рядок ${i + 1}: додано маркер // @Диван Наповнювач Подушек=${marker}`);
            }
        }
        // Цех 2-2: %Дно Каркасу%
        if (activeAttrs.has("Дно Каркасу") && line.includes("%Дно Каркасу%")) {
            const hasMarker = line.includes("// %Дно Каркасу%=");
            const marker = scanForDnoMarker(result, i);
            if (!hasMarker && marker) {
                result[i] = line.trimEnd() + ` // %Дно Каркасу%=${marker}`;
                changes.push(`Рядок ${i + 1}: додано маркер // %Дно Каркасу%=${marker}`);
            }
            else if (hasMarker && !marker) {
                // Блок вже має [ДВП дно] (%Дно Каркасу%) — значення визначиться при імпорті, маркер зайвий
                result[i] = line.replace(/\s*\/\/\s*%Дно Каркасу%=[^\n]*/, "").trimEnd();
                changes.push(`Рядок ${i + 1}: видалено застарілий маркер %Дно Каркасу%`);
            }
        }
        // Цех 5: %Диван Пружинний Блок%
        if (activeAttrs.has("Диван Пружинний Блок") &&
            line.includes("%Диван Пружинний Блок%") &&
            !line.includes("// @Диван Пружинний Блок=")) {
            const marker = scanForSpringMarker(result, i);
            if (marker) {
                result[i] = line.trimEnd() + ` // @Диван Пружинний Блок=${marker}`;
                changes.push(`Рядок ${i + 1}: додано маркер // @Диван Пружинний Блок=${marker}`);
            }
        }
    }
    return result;
}
// `\b` is ASCII-only — never use it after Cyrillic (Цех/Ціна/Диван).
const WORKSHOP_HEADER_RE = /^#+\s*(?:Цех|ВТК)(?=\s|№|$)/i;
const BARE_WORKSHOP_RE = /^Цех\s*№/i;
const ANY_QTY_END_RE = /[-]\s*(?:[\d.,]+\s*(кг|m³|m²|дм²|m|шт\.?)?|(кг|m³|m²|дм²|m|шт\.?))\s*$/u;
const EMOJI_START_RE = /^[🪵🧩🪤🧽]+/u;
function classifyWorkshopLine(line) {
    const t = line.trim().replace(/\s*<!--[^>]*-->\s*$/, "");
    if (!t)
        return "blank";
    if (WORKSHOP_HEADER_RE.test(t) || BARE_WORKSHOP_RE.test(t))
        return "header";
    if (/^Ціна(\s|$)/i.test(t))
        return "price";
    if (/^(або)$/i.test(t))
        return "abo";
    if (/^<!--/.test(t))
        return "comment";
    if (ANY_QTY_END_RE.test(t))
        return "content";
    if ((EMOJI_START_RE.test(t) && t.includes("[")) ||
        /^\[.+\]\s*\(/u.test(t) ||
        /^(Диван|Ліжко)(?=\s|$)/.test(t)) {
        return "output";
    }
    return "content";
}
function needsWorkshopBlank(prev, cur) {
    if (cur === "header" || prev === "header")
        return true;
    if (cur === "price" || prev === "price")
        return true;
    if (cur === "abo" || prev === "abo")
        return true;
    if (cur === "comment" || prev === "comment")
        return true;
    return cur === "output";
}
function normalizeBlockForComparison(blockLines) {
    return blockLines
        .map(l => l.trim()
        .replace(/\s*\/\/\s*[@%][^\n]*/g, "")
        .replace(/\s*<!--.*?-->/g, ""))
        .filter(l => l !== "" && !/^Ціна\s/i.test(l))
        .join("\n");
}
function removeDuplicateAboBlocks(lines, changes) {
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const t = lines[i].trim();
        // Non-workshop lines pass through
        if (!WORKSHOP_HEADER_RE.test(t) && !(t.startsWith("#") && t.includes("№"))) {
            out.push(lines[i]);
            i++;
            continue;
        }
        // Workshop header — emit and gather body until next workshop header
        out.push(lines[i]);
        i++;
        const bodyStart = i;
        while (i < lines.length) {
            const lt = lines[i].trim();
            if ((WORKSHOP_HEADER_RE.test(lt) || (lt.startsWith("#") && lt.includes("№"))) &&
                i !== bodyStart)
                break;
            i++;
        }
        const workshopLines = lines.slice(bodyStart, i);
        // Split into Або blocks
        const blocks = [];
        const separatorLines = [];
        let current = [];
        for (const wl of workshopLines) {
            if (/^(або)$/i.test(wl.trim())) {
                blocks.push(current);
                separatorLines.push(wl);
                current = [];
            }
            else {
                current.push(wl);
            }
        }
        blocks.push(current);
        // Mark duplicate consecutive blocks for removal
        const keepBlock = new Array(blocks.length).fill(true);
        for (let b = 1; b < blocks.length; b++) {
            let prevKept = -1;
            for (let k = b - 1; k >= 0; k--) {
                if (keepBlock[k]) {
                    prevKept = k;
                    break;
                }
            }
            if (prevKept < 0)
                continue;
            const normPrev = normalizeBlockForComparison(blocks[prevKept]);
            const normCur = normalizeBlockForComparison(blocks[b]);
            if (normPrev === normCur && normCur !== "") {
                keepBlock[b] = false;
                changes.push(`Цех: видалено дублікат варіанту "Або" (ідентичний попередньому)`);
            }
        }
        // Reconstruct workshop body
        let firstKept = true;
        for (let b = 0; b < blocks.length; b++) {
            if (!keepBlock[b])
                continue;
            if (!firstKept)
                out.push(separatorLines[b - 1]);
            out.push(...blocks[b]);
            firstKept = false;
        }
    }
    return out;
}
function compressWorkshopBlanks(lines, changes) {
    const start = lines.findIndex((line) => {
        const t = line.trim();
        return WORKSHOP_HEADER_RE.test(t) || BARE_WORKSHOP_RE.test(t);
    });
    if (start < 0)
        return lines;
    const kept = [];
    let dropped = 0;
    for (let i = start; i < lines.length; i++) {
        const kind = classifyWorkshopLine(lines[i]);
        if (kind === "blank") {
            dropped++;
            continue;
        }
        kept.push({ kind, line: lines[i] });
    }
    const body = [];
    for (let i = 0; i < kept.length; i++) {
        if (i > 0 && needsWorkshopBlank(kept[i - 1].kind, kept[i].kind)) {
            body.push("");
        }
        body.push(kept[i].line);
    }
    const before = lines.slice(start).join("\n");
    const after = body.join("\n");
    if (before === after)
        return lines;
    const reinserted = body.filter((line) => !line.trim()).length;
    const net = dropped - reinserted;
    changes.push(`Цехи: прибрано порожні рядки всередині специфікацій (${net} порожніх стиснуто)`);
    return [...lines.slice(0, start), ...body];
}
function formatDocument(inputPath) {
    return formatDocumentContent(fs.readFileSync(inputPath, "utf-8"));
}
function writeFormattedDocument(inputPath, outputDir) {
    const result = formatDocument(inputPath);
    const fileName = path.basename(inputPath);
    const outPath = path.join(outputDir, fileName);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outPath, result.content, "utf-8");
    return result;
}
