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
exports.runAttributeCheck = runAttributeCheck;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ─── Document section header ──────────────────────────────────────────────
const SECTION_HEADER_RE = /^#+\s*(Цех\s*№[\d\-]+)/u;
// ─── Step 1: Parse attribute rules from document ──────────────────────────
function parseAttributeRules(content) {
    const attrs = [];
    // 1a. Parse СПИСОК АТРИБУТІВ section for order and active status
    const listMatch = content.match(/# СПИСОК АТРИБУТІВ[^\n]*\n([\s\S]*?)(?=\n##|\n#[^#])/);
    if (!listMatch)
        throw new Error('Не знайдено "# СПИСОК АТРИБУТІВ" у файлі');
    const listBlock = listMatch[1];
    const itemRe = /"([^"]+)",?\s*(✅|❌)/gu;
    let m;
    let order = 0;
    while ((m = itemRe.exec(listBlock)) !== null) {
        order++;
        attrs.push({
            paramName: `%${m[1]}%`,
            order,
            active: m[2] === "✅",
            workshops: [],
        });
    }
    // 1b. Parse "Інструкції" section for workshop effects
    const instrMatch = content.match(/## Інструкції[^\n]*\n([\s\S]*?)(?=\n# |\n## |$)/);
    if (!instrMatch)
        throw new Error('Не знайдено "## Інструкції" у файлі');
    const instrBlock = instrMatch[1];
    // Match each numbered entry: "1. %Attr%:" ... "Впливає на цехи: (list)"
    const entryRe = /^\d+\.\s+%([^%]+)%/gmu;
    const workshopRe = /Впливає на цехи:\s*\(([^)]+)\)/u;
    // Split by numbered entries
    const entries = instrBlock.split(/(?=^\d+\.\s+%)/mu).filter((e) => e.trim());
    for (const entry of entries) {
        const nameMatch = /^\d+\.\s+%([^%]+)%/u.exec(entry);
        if (!nameMatch)
            continue;
        const paramName = `%${nameMatch[1]}%`;
        const wMatch = workshopRe.exec(entry);
        const workshops = wMatch ? wMatch[1].split(",").map((w) => w.trim()) : [];
        const attr = attrs.find((a) => a.paramName === paramName);
        if (attr)
            attr.workshops = workshops;
    }
    return attrs;
}
// ─── Step 2: Parse product line params ────────────────────────────────────
const EMOJI_RE = /^[🪵🧩🪤🧽]+/u;
const BRACKET_PREFIX_RE = /^\[.+\]\s*\(/u;
const SOFA_PREFIX_RE = /^Диван\s+/u;
function isProductLine(line) {
    const t = line.trim();
    return ((EMOJI_RE.test(t) && t.includes("[")) ||
        BRACKET_PREFIX_RE.test(t) ||
        SOFA_PREFIX_RE.test(t));
}
function stripLineComment(line) {
    const idx = line.indexOf("//");
    return idx >= 0 ? line.slice(0, idx).trim() : line.trim();
}
/**
 * Find the first `(` after the `]`, then find its matching `)`.
 * Returns [start, end] indices of the paren content (exclusive).
 */
function findParamBounds(line) {
    const nameEnd = line.lastIndexOf("]");
    if (nameEnd < 0) {
        // Sofa final product: "Диван Угол Леон-Люкс 200 Колеса (%Тканина%, ...)"
        const open = line.indexOf("(");
        if (open < 0)
            return null;
        let depth = 1;
        let i = open + 1;
        while (i < line.length && depth > 0) {
            if (line[i] === "(")
                depth++;
            if (line[i] === ")")
                depth--;
            i++;
        }
        return { open, close: i - 1 };
    }
    const open = line.indexOf("(", nameEnd);
    if (open < 0)
        return null;
    let depth = 1;
    let i = open + 1;
    while (i < line.length && depth > 0) {
        if (line[i] === "(")
            depth++;
        if (line[i] === ")")
            depth--;
        i++;
    }
    return { open, close: i - 1 };
}
function parseParams(line) {
    const clean = stripLineComment(line);
    const bounds = findParamBounds(clean);
    if (!bounds)
        return null;
    const inner = clean.slice(bounds.open + 1, bounds.close);
    const tokens = inner.split(",").map((t) => t.trim());
    // If first token is already an %attr%, there's no plain productId
    const firstIsAttr = (tokens[0] ?? "").startsWith("%");
    const productId = firstIsAttr ? "" : (tokens[0] ?? "");
    const attrStart = firstIsAttr ? 0 : 1;
    const attributes = tokens.slice(attrStart).filter((t) => t.startsWith("%"));
    return { productId, attributes };
}
/**
 * Rebuild the line with new params content, preserving prefix, suffix, and comments.
 */
function rebuildLine(originalLine, newParamsContent) {
    const commentIdx = originalLine.indexOf("//");
    const lineBeforeComment = commentIdx >= 0
        ? originalLine.slice(0, commentIdx).trim()
        : originalLine.trim();
    const comment = commentIdx >= 0 ? " " + originalLine.slice(commentIdx).trim() : "";
    const bounds = findParamBounds(lineBeforeComment);
    if (!bounds)
        return originalLine;
    const rebuilt = lineBeforeComment.slice(0, bounds.open + 1) +
        newParamsContent +
        lineBeforeComment.slice(bounds.close);
    return rebuilt + comment;
}
// ─── Step 3: Workshop number extraction ───────────────────────────────────
function extractWorkshopNum(header) {
    const m = /Цех\s*№([\d\-]+)/u.exec(header);
    return m ? m[1] : null;
}
// ─── Step 4: Compute required attributes for a product output ─────────────
function requiredAttrsFor(workshopNum, outputLine, allAttrs) {
    const required = [];
    for (const attr of allAttrs) {
        if (attr.workshops.includes(workshopNum)) {
            required.push(attr);
        }
    }
    // Special: Ламінат in Цех №3-1 always has %Колір Ламінату% regardless of global active status
    if (workshopNum === "3-1" && outputLine.includes("[Ламінат")) {
        const nakl = allAttrs.find((a) => a.paramName === "%Колір Ламінату%");
        if (nakl && !required.some((r) => r.paramName === "%Колір Ламінату%")) {
            required.push(nakl);
        }
    }
    // Raw frame wood (нарізана деревина) doesn't vary by armrest size
    if (outputLine.includes("[Каркас - нарізана деревина]")) {
        const idx = required.findIndex((a) => a.paramName === "%Диван Розмір Бильця%");
        if (idx >= 0)
            required.splice(idx, 1);
    }
    // Sort by global order
    required.sort((a, b) => a.order - b.order);
    return required;
}
function buildBaseKey(line) {
    const clean = stripLineComment(line.trim());
    const bounds = findParamBounds(clean);
    if (!bounds)
        return clean;
    const inner = clean.slice(bounds.open + 1, bounds.close);
    // Base key = everything up to first ',' or '%' in the inner params
    const firstSep = inner.search(/[,%]/);
    const productId = firstSep >= 0 ? inner.slice(0, firstSep).trim() : inner.trim();
    // prefix = everything before the opening '('
    const prefix = clean.slice(0, bounds.open);
    return `${prefix}(${productId}`;
}
function verify(fileLines, allAttrs) {
    const outputChanges = [];
    const renames = [];
    const issues = [];
    let currentWorkshop = null;
    let bomStarted = false; // true once we've seen an output line in current section
    for (let i = 0; i < fileLines.length; i++) {
        const raw = fileLines[i];
        const trimmed = raw.trim();
        // New section?
        const hMatch = SECTION_HEADER_RE.exec(trimmed);
        if (hMatch) {
            currentWorkshop = extractWorkshopNum(hMatch[1]);
            bomStarted = false;
            continue;
        }
        if (!currentWorkshop)
            continue;
        if (!isProductLine(trimmed))
            continue;
        // Is it an input line (has "- N шт." or "- шт." or "- N кг" etc.)?
        const cleanLine = stripLineComment(trimmed);
        const hasQty = /[-]\s*[\d.,]*\s*(?:шт|кг|m|m²|m³)|[-]\s*[\d.,]+\s*$/u.test(cleanLine);
        if (hasQty)
            continue; // skip inputs — handled via cascading
        // It's an output line
        bomStarted = true;
        const parsed = parseParams(cleanLine);
        if (!parsed)
            continue;
        // Determine required attributes (both active and inactive that affect this workshop)
        const required = requiredAttrsFor(currentWorkshop, cleanLine, allAttrs);
        // Цех №9 (final assembly): only active attrs, skip inactive
        // All other workshops (incl. 9-1): active → %Name%, inactive → ❌
        const isWorkshop9 = currentWorkshop === "9";
        const reqTokens = isWorkshop9
            ? required.filter((a) => a.active).map((a) => a.paramName)
            : required.map((a) => a.active ? a.paramName : a.paramName.replace(/%$/, "❌%"));
        // Build new params
        const newParamsContent = parsed.productId
            ? [parsed.productId, ...reqTokens].join(", ")
            : reqTokens.join(", ");
        // Build old params content
        const bounds = findParamBounds(cleanLine);
        if (!bounds)
            continue;
        const oldParamsContent = cleanLine.slice(bounds.open + 1, bounds.close);
        // Compare (normalize spaces)
        const oldNorm = oldParamsContent.replace(/\s+/g, " ").trim();
        const newNorm = newParamsContent.replace(/\s+/g, " ").trim();
        if (oldNorm === newNorm)
            continue;
        // Record output change
        const newLine = rebuildLine(raw, newParamsContent);
        outputChanges.push({ lineIdx: i, oldLine: raw, newLine });
        console.log(`  [FIX] ${currentWorkshop}: "${oldParamsContent}" → "${newParamsContent}"`);
        issues.push(`[FIX] Цех №${currentWorkshop}: "${oldParamsContent}" → "${newParamsContent}"`);
        // Build rename info for cascading inputs
        renames.push({
            baseKey: buildBaseKey(cleanLine),
            oldParams: oldParamsContent,
            newParams: newParamsContent,
        });
    }
    return { outputChanges, renames, issues };
}
// ─── Step 6: Cascade input updates ────────────────────────────────────────
function cascadeInputUpdates(fileLines, renames, alreadyChanged) {
    const inputChanges = [];
    const issues = [];
    for (let i = 0; i < fileLines.length; i++) {
        if (alreadyChanged.has(i))
            continue;
        const raw = fileLines[i];
        const trimmed = raw.trim();
        if (!isProductLine(trimmed))
            continue;
        if (!trimmed.includes("%")) {
            // Could be a zero-attribute input that needs updating after output rename
            // Check if any rename baseKey matches this line
        }
        const cleanLine = stripLineComment(trimmed);
        const hasQty = /[-]\s*[\d.,]*\s*(?:шт|кг|m|m²|m³)|[-]\s*[\d.,]+\s*$/u.test(cleanLine);
        if (!hasQty)
            continue; // only inputs
        for (const rename of renames) {
            // Check if this input line's base matches the renamed product
            if (!cleanLine.startsWith(rename.baseKey))
                continue;
            // Verify old params match
            const bounds = findParamBounds(cleanLine);
            if (!bounds)
                continue;
            const currentParams = cleanLine.slice(bounds.open + 1, bounds.close);
            const currentNorm = currentParams.replace(/\s+/g, " ").trim();
            const oldNorm = rename.oldParams.replace(/\s+/g, " ").trim();
            if (currentNorm !== oldNorm)
                continue;
            const newLine = rebuildLine(raw, rename.newParams);
            if (newLine === raw)
                continue;
            console.log(`  [CASCADE] рядок ${i + 1}: "${currentParams}" → "${rename.newParams}"`);
            issues.push(`[CASCADE] рядок ${i + 1}: "${currentParams}" → "${rename.newParams}"`);
            inputChanges.push({ lineIdx: i, oldLine: raw, newLine });
            break;
        }
    }
    return { changes: inputChanges, issues };
}
// ─── Apply all changes ────────────────────────────────────────────────────
function applyChanges(fileLines, changes) {
    const result = [...fileLines];
    for (const c of changes) {
        result[c.lineIdx] = c.newLine;
    }
    return result;
}
// ─── Library export ───────────────────────────────────────────────────────
/**
 * Run attribute checks on in-memory content.
 * Returns the fixed content and list of issues found.
 */
function runAttributeCheck(content, fileName) {
    console.log(`\nАтрибути: ${fileName}`);
    const fileLines = content.split("\n");
    const allAttrs = parseAttributeRules(content);
    for (const a of allAttrs) {
        console.log(`  ${a.order}. ${a.paramName} [${a.active ? "✅" : "❌"}] → цехи: ${a.workshops.join(", ") || "—"}`);
    }
    const { outputChanges, renames, issues: attrIssues, } = verify(fileLines, allAttrs);
    const changedOutputIdxs = new Set(outputChanges.map((c) => c.lineIdx));
    let workingLines = applyChanges(fileLines, outputChanges);
    const { changes: inputChanges, issues: cascadeIssues } = cascadeInputUpdates(workingLines, renames, changedOutputIdxs);
    workingLines = applyChanges(workingLines, inputChanges);
    const totalChanges = outputChanges.length + inputChanges.length;
    if (totalChanges === 0) {
        console.log("  ✅ Атрибути в порядку, змін немає.");
    }
    else {
        console.log(`  Змін output: ${outputChanges.length}, input (каскад): ${inputChanges.length}`);
    }
    return {
        content: workingLines.join("\n"),
        issues: [...attrIssues, ...cascadeIssues],
    };
}
// ─── Entry point ──────────────────────────────────────────────────────────
function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error("Usage: ts-node check-attributes.ts <path-to-md-file>");
        process.exit(1);
    }
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        console.error(`Файл не знайдено: ${absPath}`);
        process.exit(1);
    }
    const original = fs.readFileSync(absPath, "utf-8");
    const fileName = path.basename(absPath);
    const { content: fixed } = runAttributeCheck(original, fileName);
    if (fixed === original)
        return;
    const bakPath = absPath + ".bak";
    if (!fs.existsSync(bakPath)) {
        fs.writeFileSync(bakPath, original, "utf-8");
        console.log(`Оригінал збережено: ${path.basename(bakPath)}`);
    }
    fs.writeFileSync(absPath, fixed, "utf-8");
    console.log(`✅ Файл оновлено.`);
}
if (typeof require !== "undefined" && require.main === module) {
    main();
}
