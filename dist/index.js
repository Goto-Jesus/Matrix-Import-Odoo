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
const [, , command, ...args] = process.argv;
async function main() {
    switch (command) {
        case "to-novalid": {
            const { runToNoValid } = await Promise.resolve().then(() => __importStar(require("./commands/toNoValid")));
            await runToNoValid(args[0], args[1]);
            break;
        }
        case "validate": {
            const { runValidate } = await Promise.resolve().then(() => __importStar(require("./commands/validate")));
            await runValidate(args[0]);
            break;
        }
        case "validate-all": {
            const { runValidateAll } = await Promise.resolve().then(() => __importStar(require("./commands/validateAll")));
            await runValidateAll(args[0]);
            break;
        }
        case "snapshot": {
            const { runSnapshot } = await Promise.resolve().then(() => __importStar(require("./commands/snapshot")));
            await runSnapshot(args[0]);
            break;
        }
        case "restore": {
            const { runRestore } = await Promise.resolve().then(() => __importStar(require("./commands/restore")));
            await runRestore(args[0]);
            break;
        }
        case "import": {
            const { runImport } = await Promise.resolve().then(() => __importStar(require("./commands/importSpec")));
            await runImport(args[0]);
            break;
        }
        case "check": {
            const { runCheck } = await Promise.resolve().then(() => __importStar(require("./commands/check")));
            await runCheck(args[0], ...args.slice(1));
            break;
        }
        case "add-fabric": {
            const { runAddFabric } = await Promise.resolve().then(() => __importStar(require("./commands/addFabric")));
            await runAddFabric(args[0]);
            break;
        }
        case "bom": {
            const { createAllBoms } = await Promise.resolve().then(() => __importStar(require("./bom/creator")));
            const { neo3Boms } = await Promise.resolve().then(() => __importStar(require("./specs/neo3-mekhanizm")));
            await createAllBoms(neo3Boms);
            break;
        }
        default:
            console.log(`
Використання:
  Локально (Odoo не чіпає):
  npm run to-novalid "<файл>"    — сирий дамп → documents_no_valid
  npm run validate "<файл>"       — авто-форматування + список помилок
  npm run validate-all [папка]   — валідація всіх .md у папці
  npm run web                    — сторінка перевірки специфікації

  Жива база (потрібен ODOO_API_KEY в .env):
  npm run import "<файл>"
  npm run check "<продукт>"
  npm run add-fabric "<назва>"
  npm run snapshot [мітка]
  npm run restore
  npm run restore -- "<назва>"
  npm run restore -- all
  npm run dev bom
      `);
    }
}
main().catch((err) => {
    console.error("\n[ПОМИЛКА]", err.message);
    process.exit(1);
});
