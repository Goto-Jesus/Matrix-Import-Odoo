/**
 * Regenerates right_names_odoo_base.md from live Odoo data.
 * Run: npm run sync-base
 */
import * as fs from "fs";
import * as path from "path";
import { authenticate, searchRead } from "../api/odoo";

interface OdooTemplate {
  id: number;
  name: string;
  categ_id: [number, string] | false;
  uom_id: [number, string] | false;
}

interface OdooUom {
  id: number;
  name: string;
  factor: number;
}

interface OdooCategory {
  id: number;
  complete_name: string;
}


// Sort order prefix list — earlier index = earlier in file
const SORT_PREFIXES = [
  "Готова продукція",
  "Сировина",
  "Упаковка",
  "Послуги",
  "Цех /",
];

function categoryOrder(name: string): [number, string] {
  const idx = SORT_PREFIXES.findIndex((p) => name.startsWith(p));
  return [idx === -1 ? 999 : idx, name];
}

// Parse "emoji[Content] Model" → { prefix, model }
// Returns null if name has no brackets
function parseName(name: string): { prefix: string; model: string } | null {
  const m = name.match(/^([🪵🧩🪤🧽]*\[[^\]]+\])\s*(.*)/su);
  if (!m) return null;
  return { prefix: m[1].trim(), model: m[2].trim() };
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return row[n];
}

async function main(): Promise<void> {
  console.log("[sync-base] Підключення до Odoo...");
  await authenticate();

  const [templates, uoms, categories] = await Promise.all([
    searchRead<OdooTemplate>("product.template", [], [
      "id",
      "name",
      "categ_id",
      "uom_id",
    ]),
    searchRead<OdooUom>("uom.uom", [], ["id", "name", "factor"]),
    searchRead<OdooCategory>("product.category", [], [
      "id",
      "complete_name",
    ]),
  ]);

  console.log(
    `[sync-base] Шаблонів: ${templates.length}, UOM: ${uoms.length}, Категорій: ${categories.length}`,
  );

  const catById = new Map(categories.map((c) => [c.id, c.complete_name]));

  // Group: catName → Map<key, { uomName, models[], isStandalone }>
  // "grouped" entries: key = "🧩[Type]", models = ["Д.Верадо", "Д.Леон", ...]
  // "standalone" entries: key = full name like "🧩[Чохол - нарізані матеріали Д.Верадо]", models = []
  type Group = { uomName: string; models: string[]; isStandalone: boolean };
  const byCategory = new Map<string, Map<string, Group>>();

  for (const t of templates) {
    const catName = t.categ_id
      ? (catById.get(t.categ_id[0]) ?? "Невідома")
      : "Без категорії";
    const uomName = t.uom_id ? t.uom_id[1] : "Одиниці";

    if (!byCategory.has(catName)) byCategory.set(catName, new Map());
    const catMap = byCategory.get(catName)!;

    const parsed = parseName(t.name);
    if (parsed && parsed.model) {
      // e.g. "🧩[Поролон - нарізані компоненти] Д.Верадо" → grouped by prefix
      const { prefix, model } = parsed;
      if (!catMap.has(prefix)) {
        catMap.set(prefix, { uomName, models: [], isStandalone: false });
      }
      catMap.get(prefix)!.models.push(model);
    } else {
      // Either plain name ("Дерево") or model-in-bracket ("🧩[Чохол - матеріали Д.Верадо]")
      const isStandalone = parsed !== null; // has brackets but no model after them
      catMap.set(t.name, { uomName, models: [], isStandalone });
    }
  }

  // Detect near-duplicate entries for unification table.
  //
  // Two passes:
  // 1. Grouped entries (models.length > 0): same bracket prefix, different model lists.
  //    e.g. "🧩[Поролон - нарізані компоненти]" (36) vs "🧩[Поролон - нарізані компонети]" (1)
  //    Threshold: dist ≤ 3 and < 10% of shorter length.
  //
  // 2. Standalone bracket entries (isStandalone=true): compare bracket CONTENT only
  //    with a tighter threshold (dist ≤ 2). This catches typos in pure-type names
  //    (where Odoo stores the model as an attribute, not inside the brackets).
  //    Чохол entries are skipped because their bracket content contains the sofa model
  //    name, so levenshtein between different models will be > 2.
  type UnifItem = { rare: string; dominant: string; rareCount: number; dominantCount: number };
  const unification: UnifItem[] = [];
  const reported = new Set<string>();

  function extractBracketContent(key: string): string | null {
    const m = key.match(/\[([^\]]+)\]/);
    return m ? m[1] : null;
  }

  function tryAddUnif(
    aKey: string, aCount: number,
    bKey: string, bCount: number,
    dist: number,
  ): void {
    const pairKey = [aKey, bKey].sort().join("||");
    if (reported.has(pairKey)) return;
    reported.add(pairKey);
    const [rare, dominant] =
      aCount <= bCount
        ? [{ key: aKey, count: aCount }, { key: bKey, count: bCount }]
        : [{ key: bKey, count: bCount }, { key: aKey, count: aCount }];
    unification.push({
      rare: rare.key,
      dominant: dominant.key,
      rareCount: rare.count,
      dominantCount: dominant.count,
    });
  }

  for (const catMap of byCategory.values()) {
    // Pass 1: grouped entries
    const grouped = [...catMap.entries()]
      .filter(([, g]) => !g.isStandalone && g.models.length > 0)
      .map(([k, g]) => ({ key: k, count: g.models.length }));

    for (let i = 0; i < grouped.length; i++) {
      for (let j = i + 1; j < grouped.length; j++) {
        const a = grouped[i];
        const b = grouped[j];
        const dist = levenshtein(a.key.toLowerCase(), b.key.toLowerCase());
        const shorter = Math.min(a.key.length, b.key.length);
        if (dist > 0 && dist <= 3 && dist / shorter < 0.1) {
          tryAddUnif(a.key, a.count, b.key, b.count, dist);
        }
      }
    }

    // Pass 2: standalone bracket entries — compare bracket contents only (dist ≤ 2).
    // Exclude entries whose bracket content contains a sofa model pattern ("Д." or "Угол")
    // since those are type+model names (e.g. Чохол sections) where different sofa models
    // legitimately differ by 1-2 chars ("Д.Лофт" vs "Д.Лофт-3") — not typos.
    const standalones = [...catMap.entries()]
      .filter(([k, g]) => g.isStandalone && /\[/.test(k))
      .map(([k]) => ({ key: k, content: extractBracketContent(k)! }))
      .filter((e) => e.content && !/\sД\./.test(e.content) && !/\sУгол\s/.test(e.content));

    for (let i = 0; i < standalones.length; i++) {
      for (let j = i + 1; j < standalones.length; j++) {
        const a = standalones[i];
        const b = standalones[j];
        const aFirst = a.content.split(/\s/)[0].toLowerCase();
        const bFirst = b.content.split(/\s/)[0].toLowerCase();
        if (aFirst !== bFirst) continue; // different type entirely — skip
        const dist = levenshtein(a.content.toLowerCase(), b.content.toLowerCase());
        if (dist > 0 && dist <= 2) {
          tryAddUnif(a.key, 1, b.key, 1, dist);
        }
      }
    }
  }

  // Build markdown
  const out: string[] = [];
  const now = new Date().toISOString().slice(0, 10);
  const odooUrl = process.env.ODOO_URL ?? "Odoo";

  out.push("# База шаблонів товарів Odoo");
  out.push(
    `# Оновлено: ${now} (синхронізовано з ${odooUrl})`,
  );
  out.push(`# ${templates.length} товарів / ${byCategory.size} категорій`);
  out.push("");
  out.push("---");
  out.push("");

  if (unification.length > 0) {
    out.push("## ⚠️ Потребує уніфікації в Odoo");
    out.push("");
    out.push(
      "Нижче — дублікати де два варіанти назви, один з яких домінує.",
    );
    out.push(
      "Рідкісний варіант треба перейменувати в Odoo до домінантного.",
    );
    out.push("");
    out.push(
      "| Рідкісний (треба перейменувати) | Домінантний (правильний) | Кількість |",
    );
    out.push("|---|---|---|");
    for (const item of unification) {
      out.push(
        `| \`${item.rare}\` | \`${item.dominant}\` | ${item.rareCount} vs ${item.dominantCount} |`,
      );
    }
    out.push("");
    out.push("---");
    out.push("");
  }

  const sortedCats = [...byCategory.keys()].sort((a, b) => {
    const [oa, sa] = categoryOrder(a);
    const [ob, sb] = categoryOrder(b);
    return oa !== ob ? oa - ob : sa.localeCompare(sb, "uk");
  });

  for (const catName of sortedCats) {
    const catMap = byCategory.get(catName)!;
    const heading = `## ${catName}`;
    out.push(heading);
    out.push("");

    const entries = [...catMap.entries()].sort(([a], [b]) =>
      a.localeCompare(b, "uk"),
    );

    // Check if this section has standalone (model-in-bracket) entries
    const hasStandalone = entries.some(([, g]) => g.isStandalone);
    if (hasStandalone) {
      out.push(
        "// Увага: в Odoo модель вбудована в назву дужки, не як атрибут",
      );
    }

    for (const [key, group] of entries) {
      if (group.isStandalone) {
        out.push(key);
      } else {
        out.push(`Товар: ${key}`);
        out.push(`uoms: "${group.uomName}"`);
        if (group.models.length > 0) {
          const sorted = [...group.models].sort((a, b) =>
            a.localeCompare(b, "uk"),
          );
          out.push(`Значення: ${sorted.map((m) => `"${m}"`).join(", ")}`);
        }
        out.push("");
      }
    }

    if (hasStandalone) out.push("");
    out.push("---");
    out.push("");
  }

  // UOMs JSON block (preserved for importers that read it)
  out.push('"uoms": [');
  const uomsSorted = [...uoms].sort((a, b) => a.id - b.id);
  for (const u of uomsSorted) {
    out.push(
      JSON.stringify({ id: u.id, name: u.name, factor: u.factor }) + ",",
    );
  }
  out.push("]");

  const outputPath = path.resolve("right_names_odoo_base.md");
  fs.writeFileSync(outputPath, out.join("\n"), "utf-8");

  console.log(`✅ Збережено: ${outputPath}`);
  console.log(`   Товарів: ${templates.length}`);
  console.log(`   Категорій: ${sortedCats.length}`);
  if (unification.length > 0) {
    console.log(`   ⚠️  Потребує уніфікації: ${unification.length} пар`);
    for (const item of unification) {
      console.log(
        `      "${item.rare}" → "${item.dominant}" (${item.rareCount} vs ${item.dominantCount})`,
      );
    }
  }
}

main().catch((err) => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});
