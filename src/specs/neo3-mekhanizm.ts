/**
 * Специфікації для Дивану "Нео-3 Механізм"
 *
 * Охоплює всі цехи від 1 до 10 + ВТК.
 * Варіант: Рене 4, Звичайні Бильця, Крихта ППУ (без посиленого блоку).
 *
 * Де є "або" (другий варіант) — окремий BomDef нижче в масиві.
 *
 * ПРИМІТКИ:
 * - "950х220 с углами" — нове значення атрибуту, якого немає в базі.
 *   Якщо [WARN], додайте його вручну через ensureVariant або в Odoo UI.
 * - [Подушка] (Д.Нео, Рене 4, Крихта ППУ) — потребує 3-го атрибуту "Наповнювач"
 *   на шаблоні [Подушка]. Якщо атрибут відсутній, BOM буде пропущено.
 */

import type { BomDef } from "../bom/types";
import { UOM } from "../bom/types";

// Назви робочих центрів
const WC = {
  C1: "Цех №1 Дерева (нарізка)",
  C21: "Цех №2-1 ДСП (нарізка бильце)",
  C22: "Цех №2-2 ДСП (нарізка каркас)",
  C31: "Цех №3-1 ЛДСП (нарізка ламінату)",
  C41: "Цех №4-1 Сборка Бильце",
  C42: "Цех №4-2 Сборка Каркас",
  C5: "Цех №5 Порізка Поролону",
  C51: "Цех №5-1 Наволочка",
  C6: "Цех №6 Поклейка Поролону + Збивка",
  C7: "Цех №7 Закрійка Тканини",
  C8: "Цех №8 Швейка",
  C91: "Цех №9-1 Набивка Подушок",
  C9: "Цех №9 Оббивка",
  C10: "Цех №10 Упаковка",
  VTK: "ВТК",
} as const;

export const neo3Boms: BomDef[] = [
  // ═══════════════════════════════════════════════════════════
  // ЦЕХ №1 — Дерева (нарізка)
  // ═══════════════════════════════════════════════════════════

  {
    product: "🪵[Каркас - нарізана деревина]",
    variants: ["100ДСП Механізм"],
    reference: "100ДСП Механізм",
    operations: [
      {
        name: "Операція (Цех №1) 🪵[Каркас - нарізана деревина] (100ДСП Механізм)",
        workcenter: WC.C1,
      },
    ],
    components: [
      { product: "Дерево", qty: 0.02, uomId: UOM.M3, operationIndex: 0 },
    ],
  },

  {
    product: "🪵[Бильце - нарізана деревина]",
    variants: ["Б.Нео"],
    reference: "Б.Нео",
    operations: [
      {
        name: "Операція (Цех №1) 🪵[Бильце - нарізана деревина] (Б.Нео)",
        workcenter: WC.C1,
      },
    ],
    components: [
      { product: "Дерево", qty: 0.00125, uomId: UOM.M3, operationIndex: 0 },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ЦЕХ №2-1 — ДСП (нарізка бильце)
  // ═══════════════════════════════════════════════════════════

  {
    product: "🧩[Бильце - нарізані деталі]",
    variants: ["Б.Нео"],
    reference: "Б.Нео",
    operations: [
      {
        name: "Операція (Цех №2-1) 🧩[Бильце - нарізані деталі] (Б.Нео)",
        workcenter: WC.C21,
      },
    ],
    components: [
      {
        product: "[ДСП]",
        variants: ["Звичайний"],
        qty: 0.59,
        uomId: UOM.M2,
        operationIndex: 0,
      },
      {
        product: "[ДВП]",
        variants: ["Звичайний"],
        qty: 0.41,
        uomId: UOM.M2,
        operationIndex: 0,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ЦЕХ №2-2 — ДСП (нарізка каркас)
  // ═══════════════════════════════════════════════════════════

  {
    product: "🧩[Каркас - нарізані деталі]",
    variants: ["100ДСП Механізм"],
    reference: "100ДСП Механізм",
    operations: [
      {
        name: "Операція (Цех №2-2) 🧩[Каркас - нарізані деталі] (100ДСП Механізм)",
        workcenter: WC.C22,
      },
    ],
    components: [
      {
        product: "[ДСП]",
        variants: ["Звичайний"],
        qty: 1.76,
        uomId: UOM.M2,
        operationIndex: 0,
      },
      {
        product: "[ДВП]",
        variants: ["Білий"],
        qty: 0.73,
        uomId: UOM.M2,
        operationIndex: 0,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ЦЕХ №3-1 — ЛДСП (нарізка ламінату)
  // УВАГА: "950х220 с углами" — нове значення, може бути відсутнє в Odoo
  // ═══════════════════════════════════════════════════════════

  {
    product: "🧩[Ламінат - нарізані деталі]",
    variants: ["100 Механізм"],
    reference: "100 Механізм",
    operations: [
      {
        name: "Операція (Цех №3-1) 🧩[Ламінат - нарізані деталі] (100 Механізм)",
        workcenter: WC.C31,
      },
    ],
    components: [
      {
        product: "🧩[Ламінат - лист]",
        variants: ["712x220"],
        qty: 2,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "🧩[Ламінат - лист]",
        variants: ["950х220"],
        qty: 1,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      // "950х220 с углами" — якщо [WARN], треба додати значення атрибуту "Ламінат Розмір" в Odoo
      {
        product: "🧩[Ламінат - лист]",
        variants: ["950х220 с углами"],
        qty: 1,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ЦЕХ №4-1 — Сборка Бильце
  // ═══════════════════════════════════════════════════════════

  {
    product: "🪤[Бильце - напівфабрикат]",
    variants: ["Б.Нео"],
    reference: "Б.Нео",
    operations: [
      {
        name: "Операція (Цех №4-1) 🪤[Бильце - напівфабрикат] (Б.Нео)",
        workcenter: WC.C41,
      },
    ],
    components: [
      {
        product: "🧩[Бильце - нарізані деталі]",
        variants: ["Б.Нео"],
        qty: 1,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ЦЕХ №4-2 — Сборка Каркас
  // ═══════════════════════════════════════════════════════════

  {
    product: "🪤[Каркас - напівфабрикат]",
    variants: ["100ДСП Механізм"],
    reference: "100ДСП Механізм",
    operations: [
      {
        name: "Операція (Цех №4-2) 🪤[Каркас - напівфабрикат] (100ДСП Механізм)",
        workcenter: WC.C42,
      },
    ],
    components: [
      {
        product: "🧩[Каркас - нарізані деталі]",
        variants: ["100ДСП Механізм"],
        qty: 1,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "🪵[Каркас - нарізана деревина]",
        variants: ["100ДСП Механізм"],
        qty: 1,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "🧩[Ламінат - нарізані деталі]",
        variants: ["100 Механізм"],
        qty: 1,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ЦЕХ №5 — Порізка Поролону (ЗВИЧАЙНИЙ блок)
  // ═══════════════════════════════════════════════════════════

  {
    product: "🧩[Поролон - нарізані компонети]",
    variants: ["Д.Нео-3 Механізм"],
    reference: "Д.Нео-3 Механізм",
    operations: [
      {
        name: "Операція (Цех №5) 🧩[Поролон - нарізані компонети] (Д.Нео-3 Механізм)",
        workcenter: WC.C5,
        priceRate: 100,
      },
    ],
    components: [
      {
        product: "[Поролон]",
        variants: ["ST-2535 (2000x1600x20)"],
        qty: 2.4,
        uomId: UOM.KG,
        operationIndex: 0,
      },
      {
        product: "[Поролон]",
        variants: ["ST-2233 (2000x1600x40x105)"],
        qty: 1.4,
        uomId: UOM.KG,
        operationIndex: 0,
      },
      {
        product: "[Поролон]",
        variants: ["ST-2233 (2000x1600x10)"],
        qty: 1.06,
        uomId: UOM.KG,
        operationIndex: 0,
      },
      {
        product: "[Поролон]",
        variants: ["ST-2233 (2000x1400x10)"],
        qty: 0.93,
        uomId: UOM.KG,
        operationIndex: 0,
      },
      {
        product: "[Поролон]",
        variants: ["ST-2233 (2000x1600x40x70)"],
        qty: 1.6,
        uomId: UOM.KG,
        operationIndex: 0,
      },
      {
        product: "[Войлок]",
        variants: ["1.60"],
        qty: 3,
        uomId: UOM.M,
        operationIndex: 0,
      },
    ],
  },

  // ЦЕХ №5 — Порізка Поролону (ПОСИЛЕНИЙ блок)
  {
    product: "🧩[Поролон - нарізані компонети]",
    variants: ["Д.Нео-3 Механізм - посилений блок"],
    reference: "Д.Нео-3 Механізм - посилений блок",
    operations: [
      {
        name: "Операція (Цех №5) 🧩[Поролон - нарізані компонети] (Д.Нео-3 Механізм - посилений блок)",
        workcenter: WC.C5,
        priceRate: 100,
      },
    ],
    components: [
      {
        product: "[Поролон]",
        variants: ["ST-2535 (2000x1600x20)"],
        qty: 2.4,
        uomId: UOM.KG,
        operationIndex: 0,
      },
      {
        product: "[Поролон]",
        variants: ["ST-2233 (2000x1600x40x105)"],
        qty: 1.4,
        uomId: UOM.KG,
        operationIndex: 0,
      },
      {
        product: "[Поролон]",
        variants: ["ST-2233 (2000x1600x10)"],
        qty: 1.06,
        uomId: UOM.KG,
        operationIndex: 0,
      },
      {
        product: "[Поролон]",
        variants: ["ST-2233 (2000x1400x10)"],
        qty: 0.93,
        uomId: UOM.KG,
        operationIndex: 0,
      },
      {
        product: "[Поролон]",
        variants: ["ST-2233 (2000x1600x40x70)"],
        qty: 3.2,
        uomId: UOM.KG,
        operationIndex: 0,
      }, // x2
      {
        product: "[Войлок]",
        variants: ["1.60"],
        qty: 6,
        uomId: UOM.M,
        operationIndex: 0,
      }, // x2
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ЦЕХ №5-1 — Наволочка
  // ═══════════════════════════════════════════════════════════

  {
    product: "[Наволочка]",
    variants: ["Д.Нео"],
    reference: "Д.Нео",
    operations: [
      {
        name: "Операція (Цех №5-1) [Наволочка] (Д.Нео)",
        workcenter: WC.C51,
        priceRate: 1,
      },
    ],
    components: [
      {
        product: "[Флізелін]",
        variants: ["30"],
        qty: 1.3,
        uomId: UOM.M,
        operationIndex: 0,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ЦЕХ №6 — Поклейка Поролону + Збивка (ЗВИЧАЙНИЙ блок)
  // ═══════════════════════════════════════════════════════════

  {
    product: "🪤🧽[Каркас + Поролон - напівфабрикат 2]",
    variants: ["Д.Нео-3 Механізм"],
    reference: "Д.Нео-3 Механізм",
    operations: [
      {
        name: "Операція (Цех №6) 🪤🧽[Каркас + Поролон - напівфабрикат 2] (Д.Нео-3 Механізм)",
        workcenter: WC.C6,
        priceRate: 380,
      },
    ],
    components: [
      {
        product: "🪤[Каркас - напівфабрикат]",
        variants: ["100ДСП Механізм"],
        qty: 3,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "🪤[Бильце - напівфабрикат]",
        variants: ["Б.Нео"],
        qty: 2,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "🧩[Поролон - нарізані компонети]",
        variants: ["Д.Нео-3 Механізм"],
        qty: 1,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "[Боннель]",
        variants: ["910 х 600"],
        qty: 3,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "[Боннель]",
        variants: ["910 х 750"],
        qty: 3,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
    ],
  },

  // ЦЕХ №6 — Поклейка Поролону + Збивка (ПОСИЛЕНИЙ блок)
  {
    product: "🪤🧽[Каркас + Поролон - напівфабрикат 2]",
    variants: ["Д.Нео-3 Механізм - посилений блок"],
    reference: "Д.Нео-3 Механізм - посилений блок",
    operations: [
      {
        name: "Операція (Цех №6) 🪤🧽[Каркас + Поролон - напівфабрикат 2] (Д.Нео-3 Механізм - посилений блок)",
        workcenter: WC.C6,
        priceRate: 380,
      },
    ],
    components: [
      {
        product: "🪤[Каркас - напівфабрикат]",
        variants: ["100ДСП Механізм"],
        qty: 3,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "🪤[Бильце - напівфабрикат]",
        variants: ["Б.Нео"],
        qty: 2,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "🧩[Поролон - нарізані компонети]",
        variants: ["Д.Нео-3 Механізм - посилений блок"],
        qty: 1,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "[Боннель]",
        variants: ["910 х 600"],
        qty: 3,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "[Боннель]",
        variants: ["910 х 750"],
        qty: 3,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ЦЕХ №7 — Закрійка Тканини (Звичайні Бильця)
  // ═══════════════════════════════════════════════════════════

  {
    product: "🧩[Чохол - нарізані матеріали]",
    variants: ["Д.Нео-3 Механізм", "Рене 4"],
    reference: "Д.Нео-3 Механізм / Рене 4",
    operations: [
      {
        name: "Операція (Цех №7) 🧩[Чохол - нарізані матеріали] (Д.Нео-3 Механізм / Рене 4)",
        workcenter: WC.C7,
        priceRate: 500,
      },
    ],
    components: [
      {
        product: "[Синтепон]",
        variants: ["400"],
        qty: 14,
        uomId: UOM.M,
        operationIndex: 0,
      },
      {
        product: "[Тканина]",
        variants: ["Рене 4"],
        qty: 17.5,
        uomId: UOM.M,
        operationIndex: 0,
      },
      {
        product: "[Флізелін]",
        variants: ["60"],
        qty: 16.5,
        uomId: UOM.M,
        operationIndex: 0,
      },
    ],
  },

  // ЦЕХ №7 — Закрійка Тканини (Зменшені Бильця)
  {
    product: "🧩[Чохол - нарізані матеріали]",
    variants: ["Д.Нео-3 Механізм- зменшене бильцебильце", "Рене 4"],
    reference: "Д.Нео-3 Механізм- зменшене бильцебильце / Рене 4",
    operations: [
      {
        name: "Операція (Цех №7) 🧩[Чохол - нарізані матеріали] (Д.Нео-3 Механізм- зменшене бильцебильце / Рене 4)",
        workcenter: WC.C7,
        priceRate: 500,
      },
    ],
    components: [
      {
        product: "[Синтепон]",
        variants: ["400"],
        qty: 14,
        uomId: UOM.M,
        operationIndex: 0,
      },
      {
        product: "[Тканина]",
        variants: ["Рене 4"],
        qty: 17.5,
        uomId: UOM.M,
        operationIndex: 0,
      },
      {
        product: "[Флізелін]",
        variants: ["60"],
        qty: 16.5,
        uomId: UOM.M,
        operationIndex: 0,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ЦЕХ №8 — Швейка (Звичайні Бильця)
  // ═══════════════════════════════════════════════════════════

  {
    product: "🪤[Чохол - напівфабрикат]",
    variants: ["Д.Нео-3 Механізм", "Рене 4"],
    reference: "Д.Нео-3 Механізм / Рене 4",
    operations: [
      {
        name: "Операція (Цех №8) 🪤[Чохол - напівфабрикат] (Д.Нео-3 Механізм / Рене 4)",
        workcenter: WC.C8,
      },
    ],
    components: [
      {
        product: "🧩[Чохол - нарізані матеріали]",
        variants: ["Д.Нео-3 Механізм", "Рене 4"],
        qty: 1,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
    ],
  },

  // ЦЕХ №8 — Швейка (Зменшені Бильця)
  {
    product: "🪤[Чохол - напівфабрикат]",
    variants: ["Д.Нео-3 Механізм- зменшене бильцебильце", "Рене 4"],
    reference: "Д.Нео-3 Механізм- зменшене бильцебильце / Рене 4",
    operations: [
      {
        name: "Операція (Цех №8) 🪤[Чохол - напівфабрикат] (Д.Нео-3 Механізм- зменшене бильцебильце / Рене 4)",
        workcenter: WC.C8,
      },
    ],
    components: [
      {
        product: "🧩[Чохол - нарізані матеріали]",
        variants: ["Д.Нео-3 Механізм- зменшене бильцебильце", "Рене 4"],
        qty: 1,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ЦЕХ №9-1 — Набивка Подушок
  // УВАГА: [Подушка] потребує 3-го атрибуту "Наповнювач" (Крихта ППУ / Холофайбер)
  // ═══════════════════════════════════════════════════════════

  {
    product: "[Подушка]",
    variants: ["Д.Нео", "Рене 4", "Крихта ППУ"],
    reference: "Д.Нео / Рене 4 / Крихта ППУ",
    operations: [
      {
        name: "Операція (Цех №9-1) [Подушка] (Д.Нео / Рене 4 / Крихта ППУ)",
        workcenter: WC.C91,
      },
    ],
    components: [
      {
        product: "[Наволочка]",
        variants: ["Д.Нео"],
        qty: 2,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      { product: "Крихта ППУ", qty: 2.7, uomId: UOM.KG, operationIndex: 0 },
    ],
  },

  {
    product: "[Подушка]",
    variants: ["Д.Нео", "Рене 4", "Холофайбер"],
    reference: "Д.Нео / Рене 4 / Холофайбер",
    operations: [
      {
        name: "Операція (Цех №9-1) [Подушка] (Д.Нео / Рене 4 / Холофайбер)",
        workcenter: WC.C91,
      },
    ],
    components: [
      {
        product: "[Наволочка]",
        variants: ["Д.Нео"],
        qty: 2,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      { product: "Холофайбер", qty: 2.7, uomId: UOM.KG, operationIndex: 0 },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ФІНАЛЬНИЙ ДИВАН — Цехи №9 + №10 + ВТК (одна специфікація, 3 операції)
  //
  // Варіант: Рене 4, Звичайні Бильця, Крихта ППУ (без посиленого блоку)
  // Компоненти Цех №9   → operationIndex: 0
  // Компоненти Цех №10  → operationIndex: 1
  // Компоненти ВТК      → operationIndex: 2
  //
  // ПРИМІТКА: уточніть точну назву шаблону дивана в Odoo!
  // ═══════════════════════════════════════════════════════════

  {
    product: "Диван (Нео-3 Механізм)",
    variants: ["Рене 4", "Звичайні Бильця"],
    reference: "Нео-3 Мех / Рене 4 / Звичайні Бильця / Крихта ППУ",
    operations: [
      {
        name: "Операція (Цех №9) Диван (Нео-3 Механізм) (Рене 4 / Звичайні Бильця / Крихта ППУ)",
        workcenter: WC.C9,
        priceRate: 490,
      },
      {
        name: "Операція (Цех №10) Диван (Нео-3 Механізм) (Рене 4 / Звичайні Бильця / Крихта ППУ)",
        workcenter: WC.C10,
        priceRate: 160,
      },
      {
        name: "ВТК Диван (Нео-3 Механізм) (Рене 4 / Звичайні Бильця / Крихта ППУ)",
        workcenter: WC.VTK,
        priceRate: 100,
      },
    ],
    components: [
      // — Цех №9 (operationIndex: 0) —
      {
        product: "🪤🧽[Каркас + Поролон - напівфабрикат 2]",
        variants: ["Д.Нео-3 Механізм"],
        qty: 1,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      { product: "Тік-так", qty: 3, uomId: UOM.UNITS, operationIndex: 0 },
      { product: "Распорка", qty: 3, uomId: UOM.UNITS, operationIndex: 0 },
      {
        product: "[Соединитель]",
        variants: ["83 эконом"],
        qty: 8,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      // Точна назва значення атрибуту [Петля]: "K 113.01" (перевірте в Odoo)
      {
        product: "[Петля]",
        variants: ["K 113.01"],
        qty: 6,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "[Ніжка]",
        variants: ["h30"],
        qty: 26,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      {
        product: "🪤[Чохол - напівфабрикат]",
        variants: ["Д.Нео-3 Механізм", "Рене 4"],
        qty: 1,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },
      // [Подушка] потребує 3-го атрибуту "Наповнювач" на шаблоні
      {
        product: "[Подушка]",
        variants: ["Д.Нео", "Рене 4", "Крихта ППУ"],
        qty: 3,
        uomId: UOM.UNITS,
        operationIndex: 0,
      },

      // — Цех №10 (operationIndex: 1) —
      { product: "Скотч", qty: 85, uomId: UOM.M, operationIndex: 1 },
      { product: "Плівка", qty: 3.4, uomId: UOM.KG, operationIndex: 1 },
      { product: "Картон", qty: 5.1, uomId: UOM.M, operationIndex: 1 },

      // — ВТК (operationIndex: 2) —
      // (Послуга) Перевірка Якості — сервісний товар, уточніть назву в Odoo
      // { product: 'Перевірка Якості', qty: 1, uomId: UOM.UNITS, operationIndex: 2 },
    ],
  },
];
