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
exports.importFromJson = importFromJson;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const importer_1 = require("./importer");
const resolver_1 = require("./resolver");
function findLatestSnapshot() {
    const indexPath = path.join(process.cwd(), 'state', 'snapshots', 'index.json');
    if (!fs.existsSync(indexPath))
        return undefined;
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    if (!index.length)
        return undefined;
    return path.join(process.cwd(), 'state', 'snapshots', index[index.length - 1].timestamp, 'snapshot.json');
}
async function importFromJson(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    const snapPath = findLatestSnapshot();
    if (snapPath && fs.existsSync(snapPath)) {
        const snap = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
        const variants = snap.data?.productVariants ?? [];
        (0, resolver_1.preSeedVariants)(variants);
        console.log(`[cache] Snapshot: ${variants.length} варіантів завантажено локально`);
    }
    console.log(`\nImporting ${data.boms.length} BOMs from "${data.sourceFile}"...`);
    await (0, importer_1.importAllBoms)(data.boms);
}
