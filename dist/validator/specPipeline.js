"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTO_PREFIXES = exports.BLOCKING_PREFIXES = void 0;
exports.isBlockingIssue = isBlockingIssue;
exports.isAutoIssue = isAutoIssue;
exports.prepareSpecContent = prepareSpecContent;
exports.runSpecTools = runSpecTools;
exports.checkSpecContent = checkSpecContent;
const check_attributes_1 = require("../tools/check-attributes");
const check_bom_1 = require("../tools/check-bom");
const check_chain_1 = require("../tools/check-chain");
const checker_1 = require("./checker");
const formatter_1 = require("./formatter");
const toNoValid_1 = require("./toNoValid");
exports.BLOCKING_PREFIXES = ["[BREAK]", "[ZERO]", "[EMPTY]", "[NOUNIT]"];
exports.AUTO_PREFIXES = ["[FIX]", "[CASCADE]"];
function isBlockingIssue(message) {
    return exports.BLOCKING_PREFIXES.some((p) => message.startsWith(p));
}
function isAutoIssue(message) {
    return exports.AUTO_PREFIXES.some((p) => message.startsWith(p));
}
function prepareSpecContent(raw) {
    const prepared = (0, toNoValid_1.toNoValidContent)(raw);
    const formatted = (0, formatter_1.formatDocumentContent)(prepared.content);
    return {
        content: formatted.content,
        fileName: prepared.fileName,
        title: prepared.title,
        prepChanges: prepared.changes,
        formatChanges: formatted.changes,
    };
}
function runSpecTools(content, fileName, applyTodosOrOptions = true) {
    const options = typeof applyTodosOrOptions === "boolean"
        ? { applyTodos: applyTodosOrOptions, applyContent: true }
        : {
            applyTodos: applyTodosOrOptions.applyTodos ?? true,
            applyContent: applyTodosOrOptions.applyContent ?? true,
        };
    let attr;
    try {
        const result = (0, check_attributes_1.runAttributeCheck)(content, fileName);
        attr = { source: "attrs", content: result.content, issues: result.issues };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attr = {
            source: "attrs",
            content,
            issues: [],
            error: message,
        };
    }
    const chainInput = options.applyContent ? attr.content : content;
    const chainResult = (0, check_chain_1.runChainCheck)(chainInput, fileName, options.applyTodos);
    const chain = {
        source: "chain",
        content: chainResult.content,
        issues: chainResult.issues,
    };
    const bomInput = options.applyContent ? chain.content : content;
    const bomResult = (0, check_bom_1.runBomCheck)(bomInput, fileName, options.applyTodos);
    const bom = {
        source: "bom",
        content: bomResult.content,
        issues: bomResult.issues,
    };
    return {
        content: options.applyContent ? bom.content : content,
        attr,
        chain,
        bom,
    };
}
function checkSpecContent(content, knownNamesMd) {
    const catalog = (0, checker_1.parseKnownCatalog)(knownNamesMd);
    return (0, checker_1.checkDocumentContent)(content, catalog.set, catalog.labels);
}
