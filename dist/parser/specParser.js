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
exports.parseSpecFile = parseSpecFile;
const fs = __importStar(require("fs"));
const types_1 = require("../bom/types");
function parseUom(uomStr) {
    const s = uomStr.toLowerCase().replace(/\s+/g, "").replace(/\.$/, "");
    if (s === "шт" || s === "шт." || s === "од" || s === "штук" || s === "pcs")
        return types_1.UOM.UNITS;
    if (s.includes("m²") || s.includes("м²") || s === "m2" || s === " m²")
        return types_1.UOM.M2;
    if (s.includes("m³") || s.includes("м³") || s === "m3" || s === " m³")
        return types_1.UOM.M3;
    if (s === "кг" || s === "kg")
        return types_1.UOM.KG;
    if (s === "г" || s === "g")
        return types_1.UOM.G;
    if (s === "m" || s === "м" || s === "метр")
        return types_1.UOM.M;
    console.warn(`  [parse] невідома UOM: "${uomStr}", використовується Одиниці`);
    return types_1.UOM.UNITS;
}
function parseQty(qtyStr) {
    return parseFloat(qtyStr.replace(",", ".")) || 0;
}
// Regex для рядка з emoji-продуктом або звичайним продуктом
// Відловлює: 🪤🧽[Назва] (Атр1, Атр2) - qty uom
const PRODUCT_RE = /^([\s\S]*?)(?:([\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}🪤🧩🪵🧽]+))?\[([^\]]+)\]\s*(?:\(([^)]+)\))?\s*(?:-\s*([\d,.]+)\s*(.+?))?\s*$/u;
// Рядок без дужок: "Диван (Атр1, Атр2)"
const PLAIN_PRODUCT_RE = /^[\s]*([A-Za-zА-ЯҐЄІЇа-яґєії0-9 -]+?)\s*\(([^)]+)\)\s*(?:-\s*([\d,.]+)\s*(.+?))?\s*$/;
// Компонент (відступ + назва - кількість UOM)
const COMPONENT_BRACKET_RE = /^(\s{2,})([\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}🪤🧩🪵🧽]*)\[([^\]]+)\]\s*(?:\(([^)]+)\))?\s*-\s*([\d,.]+)\s*(.+?)\s*$/u;
const COMPONENT_PLAIN_RE = /^(\s{2,})([^[\n#\/\-].+?)\s*-\s*([\d,.]+)\s*(.+?)\s*$/;
function parseWorkshopHeader(line) {
    const m = line.match(/^#+\s*Цех\s+№([\w-]+)\s+(.+?)\s+-\s+(\S+)\s+[""](.+?)[""]\s*$/);
    if (!m)
        return null;
    return {
        number: m[1].trim(),
        fullName: `Цех №${m[1].trim()} ${m[2].trim()}`,
        code: m[3].trim(),
        operationName: m[4].trim(),
    };
}
function tryParseProduct(line) {
    const trimmed = line.trim();
    if (!trimmed ||
        trimmed.startsWith("//") ||
        trimmed.startsWith("Ціна") ||
        trimmed === "або" ||
        trimmed === "---")
        return null;
    // Спробуємо з дужками []
    const m = trimmed.match(PRODUCT_RE);
    if (m && m[3]) {
        return {
            emoji: (m[2] || "").trim(),
            name: m[3].trim(),
            attributes: m[4]
                ? m[4]
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [],
            qty: m[5] ? parseQty(m[5]) : undefined,
            uomStr: m[6]?.trim(),
        };
    }
    // Без дужок: "Диван (Атр1, Атр2)"
    const pm = trimmed.match(PLAIN_PRODUCT_RE);
    if (pm) {
        return {
            emoji: "",
            name: pm[1].trim(),
            attributes: pm[2]
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            qty: pm[3] ? parseQty(pm[3]) : undefined,
            uomStr: pm[4]?.trim(),
        };
    }
    return null;
}
function tryParseComponent(line) {
    // З дужками: "    🧩[Каркас] (100ДСП) - 1 шт."
    const bm = line.match(COMPONENT_BRACKET_RE);
    if (bm && bm[3]) {
        const qty = parseQty(bm[5]);
        if (qty <= 0)
            return null;
        return {
            emoji: (bm[2] || "").trim(),
            name: bm[3].trim(),
            attributes: bm[4]
                ? bm[4]
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [],
            qty,
            uomStr: bm[6].trim(),
        };
    }
    // Без дужок: "    Дерево - 0.024 m³"
    const pm = line.match(COMPONENT_PLAIN_RE);
    if (pm) {
        const name = pm[2].trim();
        if (!name ||
            name.startsWith("Ціна") ||
            name.startsWith("або") ||
            name === "---")
            return null;
        const qty = parseQty(pm[3]);
        if (qty <= 0)
            return null;
        return {
            emoji: "",
            name,
            attributes: [],
            qty,
            uomStr: pm[4].trim(),
        };
    }
    return null;
}
function rawProductToBomDef(product, components, workshop, price) {
    const operation = {
        name: workshop.operationName,
        workcenter: workshop.fullName,
        priceRate: price,
    };
    const bomComponents = components.map((c) => ({
        product: c.name,
        variants: c.attributes.length > 0 ? c.attributes : undefined,
        qty: c.qty,
        uomId: parseUom(c.uomStr),
        operationIndex: 0,
    }));
    return {
        product: product.name,
        variants: product.attributes.length > 0 ? product.attributes : undefined,
        qty: product.qty ?? 1,
        operations: [operation],
        components: bomComponents,
    };
}
function parsePrice(line) {
    const m = line.match(/Ціна\s+([\d,.]+)/);
    return m ? parseFloat(m[1].replace(",", ".")) : undefined;
}
function parseSpecFile(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const boms = [];
    let currentWorkshop = null;
    let currentProduct = null;
    let currentComponents = [];
    let currentPrice;
    let inHeader = true; // skip preamble before first workshop
    function flushVariant() {
        if (!currentWorkshop || !currentProduct)
            return;
        // Skip if product has qty=0 (empty placeholder)
        if (currentProduct.qty !== undefined &&
            currentProduct.qty <= 0 &&
            currentComponents.length === 0)
            return;
        boms.push(rawProductToBomDef(currentProduct, currentComponents, currentWorkshop, currentPrice));
    }
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        // Workshop header: "# Цех №N ..."
        if (trimmed.startsWith("#") && trimmed.includes("Цех")) {
            const wh = parseWorkshopHeader(trimmed);
            if (wh) {
                flushVariant();
                currentWorkshop = wh;
                currentProduct = null;
                currentComponents = [];
                currentPrice = undefined;
                inHeader = false;
                continue;
            }
        }
        if (inHeader)
            continue;
        if (!currentWorkshop)
            continue;
        // Skip comments and empty lines (but don't break state)
        if (!trimmed ||
            trimmed.startsWith("//") ||
            trimmed.startsWith("<<") ||
            trimmed.startsWith(">>"))
            continue;
        // Price line
        if (trimmed.startsWith("Ціна")) {
            currentPrice = parsePrice(trimmed);
            continue;
        }
        // "або" separator — flush current variant, start new one within same workshop
        if (trimmed === "або" || trimmed === "Або") {
            flushVariant();
            currentProduct = null;
            currentComponents = [];
            continue;
        }
        // Section separator "---" — flush current variant
        if (trimmed === "---") {
            flushVariant();
            currentProduct = null;
            currentComponents = [];
            currentPrice = undefined;
            continue;
        }
        // Try to parse as component (must be indented, has "- qty uom")
        if (line.match(/^\s{3,}/) && currentProduct !== null) {
            const comp = tryParseComponent(line);
            if (comp) {
                currentComponents.push(comp);
                continue;
            }
        }
        // Try to parse as a product line (output of this workshop)
        const prod = tryParseProduct(line);
        if (prod) {
            if (currentProduct !== null) {
                // New product in same workshop (after ---)
                flushVariant();
                currentComponents = [];
                currentPrice = undefined;
            }
            currentProduct = prod;
            continue;
        }
        // Try as component even without deep indent (2+ spaces)
        if (currentProduct !== null && line.match(/^\s{2,}/)) {
            const comp = tryParseComponent(line);
            if (comp) {
                currentComponents.push(comp);
            }
        }
    }
    // Flush last variant
    flushVariant();
    return boms;
}
