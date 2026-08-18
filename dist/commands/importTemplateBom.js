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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const odoo_1 = require("../api/odoo");
const importer_1 = require("../tools/importJson/template-bom/importer");
async function main() {
    const jsonPath = process.argv[2];
    if (!jsonPath) {
        console.error('Usage: ts-node src/commands/importTemplateBom.ts <path-to-json>');
        console.error('Example: ts-node src/commands/importTemplateBom.ts exports/Диван\\ Угол\\ Леон-Люкс\\ 140\\ Механізм.json');
        process.exit(1);
    }
    const absPath = path.resolve(jsonPath);
    if (!fs.existsSync(absPath)) {
        console.error(`Файл не знайдено: ${absPath}`);
        process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
    console.log(`[import] Файл: ${data.sourceFile}`);
    console.log(`[import] BOM записів: ${data.boms.length}`);
    console.log(`[import] Режим: template-level BOM (product_id = false)`);
    await (0, odoo_1.authenticate)();
    await (0, importer_1.importAllTemplateBoms)(data.boms, data.sourceFile);
}
main().catch(err => {
    console.error('[FATAL]', err.message);
    process.exit(1);
});
