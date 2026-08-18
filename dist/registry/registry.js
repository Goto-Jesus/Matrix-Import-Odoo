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
exports.getEntry = getEntry;
exports.setEntry = setEntry;
exports.archiveEntry = archiveEntry;
exports.listEntries = listEntries;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const REGISTRY_PATH = path.resolve(process.cwd(), 'import_registry.json');
function load() {
    if (!fs.existsSync(REGISTRY_PATH))
        return {};
    try {
        return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    }
    catch {
        return {};
    }
}
function save(registry) {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
}
function getEntry(sofaName) {
    const registry = load();
    return registry[sofaName] ?? null;
}
function setEntry(sofaName, entry) {
    const registry = load();
    registry[sofaName] = entry;
    save(registry);
}
function archiveEntry(sofaName) {
    const registry = load();
    if (registry[sofaName]) {
        registry[sofaName].status = 'archived';
        save(registry);
    }
}
function listEntries() {
    const registry = load();
    return Object.entries(registry).map(([name, entry]) => ({ name, ...entry }));
}
