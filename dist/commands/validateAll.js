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
exports.runValidateAll = runValidateAll;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const validate_1 = require("./validate");
const DEFAULT_DIR = 'documents';
async function runValidateAll(dirArg) {
    const dir = path.resolve(process.cwd(), dirArg ?? DEFAULT_DIR);
    if (!fs.existsSync(dir)) {
        console.error(`Папку не знайдено: ${dir}`);
        process.exit(1);
    }
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    if (files.length === 0) {
        console.error(`У папці немає .md файлів: ${dir}`);
        process.exit(1);
    }
    console.log(`\n📁 Папка: ${path.relative(process.cwd(), dir)}`);
    console.log(`📋 Файлів: ${files.length}\n`);
    console.log('═'.repeat(60));
    let ok = 0;
    let errors = 0;
    for (let i = 0; i < files.length; i++) {
        const relPath = path.join(dirArg ?? DEFAULT_DIR, files[i]);
        console.log(`\n[${i + 1}/${files.length}]`);
        try {
            await (0, validate_1.runValidate)(relPath);
            ok++;
        }
        catch (e) {
            console.error(`\n❌ Збій при обробці "${files[i]}": ${e.message}`);
            errors++;
        }
        console.log('─'.repeat(60));
    }
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ Оброблено: ${ok}   ❌ Збоїв: ${errors}   Всього: ${files.length}`);
}
