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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.executeKw = executeKw;
exports.searchRead = searchRead;
exports.search = search;
exports.create = create;
exports.createMany = createMany;
exports.write = write;
exports.unlink = unlink;
exports.fieldsGet = fieldsGet;
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const ODOO_URL = process.env.ODOO_URL;
const ODOO_DB = process.env.ODOO_DB;
const ODOO_USERNAME = process.env.ODOO_USERNAME;
const ODOO_API_KEY = process.env.ODOO_API_KEY;
let _uid = null;
// Odoo JSON-RPC через /jsonrpc (аналог XML-RPC, але JSON)
async function jsonRpc(service, method, args) {
    const response = await axios_1.default.post(`${ODOO_URL}/jsonrpc`, {
        jsonrpc: '2.0',
        method: 'call',
        params: { service, method, args },
        id: Date.now(),
    }, {
        headers: { 'Content-Type': 'application/json' },
    });
    if (response.data.error) {
        throw new Error(`Odoo RPC error: ${JSON.stringify(response.data.error.data?.message || response.data.error)}`);
    }
    return response.data.result;
}
async function authenticate() {
    if (_uid !== null)
        return _uid;
    if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_API_KEY) {
        throw new Error("Odoo вимкнено: порожній ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_API_KEY. " +
            "Розкоментуй ключ у .env лише коли треба жива база.");
    }
    const uid = await jsonRpc("common", "authenticate", [
        ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {},
    ]);
    if (!uid)
        throw new Error('Odoo authentication failed. Перевірте .env credentials.');
    _uid = uid;
    console.log(`[OK] Підключено до Odoo (UID: ${uid})`);
    return uid;
}
async function executeKw(model, method, args = [], kwargs = {}) {
    const uid = await authenticate();
    return jsonRpc('object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY,
        model, method, args,
        { context: { lang: 'uk_UA' }, ...kwargs },
    ]);
}
async function searchRead(model, domain = [], fields = [], limit = 0) {
    return executeKw(model, 'search_read', [domain], { fields, limit });
}
async function search(model, domain) {
    return executeKw(model, 'search', [domain]);
}
async function create(model, vals) {
    return executeKw(model, 'create', [vals]);
}
/** Batch create — Odoo 16+ accepts a list and returns list of IDs in the same order */
async function createMany(model, vals) {
    if (vals.length === 0)
        return [];
    return executeKw(model, 'create', [vals]);
}
async function write(model, ids, vals) {
    return executeKw(model, 'write', [ids, vals]);
}
async function unlink(model, ids) {
    return executeKw(model, 'unlink', [ids]);
}
async function fieldsGet(model, attributes = ['type', 'selection']) {
    return executeKw(model, 'fields_get', [], { attributes });
}
