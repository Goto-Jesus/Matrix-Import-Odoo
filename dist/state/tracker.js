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
exports.track = void 0;
exports.resetSession = resetSession;
exports.saveSession = saveSession;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const manager_1 = require("./manager");
const _ids = {
    productTemplates: [],
    productVariants: [],
    productAttributes: [],
    productAttributeValues: [],
    boms: [],
    bomLines: [],
    bomOperations: [],
    workcenters: [],
};
exports.track = {
    template: (id) => { _ids.productTemplates.push(id); },
    attribute: (id) => { _ids.productAttributes.push(id); },
    attributeValue: (id) => { _ids.productAttributeValues.push(id); },
    workcenter: (id) => { _ids.workcenters.push(id); },
    bom: (id) => { _ids.boms.push(id); },
    boms: (ids) => { _ids.boms.push(...ids); },
    operation: (id) => { _ids.bomOperations.push(id); },
    operations: (ids) => { _ids.bomOperations.push(...ids); },
    bomLine: (id) => { _ids.bomLines.push(id); },
    bomLines: (ids) => { _ids.bomLines.push(...ids); },
};
function resetSession() {
    _ids.productTemplates = [];
    _ids.productVariants = [];
    _ids.productAttributes = [];
    _ids.productAttributeValues = [];
    _ids.boms = [];
    _ids.bomLines = [];
    _ids.bomOperations = [];
    _ids.workcenters = [];
}
function findLatestSnapshotTimestamp() {
    const indexPath = path.join(process.cwd(), 'state', 'snapshots', 'index.json');
    if (!fs.existsSync(indexPath))
        return null;
    const entries = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    if (!entries.length)
        return null;
    return entries[entries.length - 1].timestamp;
}
function saveSession(label) {
    const snapshotTimestamp = findLatestSnapshotTimestamp();
    if (!snapshotTimestamp) {
        console.warn('[tracker] Snapshot не знайдено — import record не збережено. Виконайте npm run snapshot перед імпортом.');
        return;
    }
    const total = Object.values(_ids).reduce((s, arr) => s + arr.length, 0);
    if (total === 0) {
        console.log('[tracker] Нічого нового не створено — import record пропущено.');
        return;
    }
    const recordLabel = label ?? `import-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}`;
    (0, manager_1.saveImportRecord)(snapshotTimestamp, recordLabel, { ..._ids });
    console.log(`[tracker] "${recordLabel}" → ` +
        `BOMs: ${_ids.boms.length}, ops: ${_ids.bomOperations.length}, lines: ${_ids.bomLines.length}, ` +
        `templates: ${_ids.productTemplates.length}`);
}
