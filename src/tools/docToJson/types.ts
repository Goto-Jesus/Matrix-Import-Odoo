export interface AttributeVal {
  attributeName: string;  // "Модель" | "Тканина" | "Наповнювач"
  value: string;
}

export interface OperationEntry {
  name: string;           // e.g. "Операція (Цех №1) 🪵[Каркас - нарізана деревина] (100ДСП Механізм)"
  workcenterName: string; // e.g. "Цех №1 Дерева (нарізка)"
  priceRate: number;      // x_studio_piece_rate_2
}

export interface ComponentEntry {
  templateName: string;      // e.g. "Дерево" or "🧩[Бильце - нарізані деталі]"
  attributes: AttributeVal[];
  qty: number;
  uom: string;               // "m³" | "m²" | "m" | "кг" | "г" | "шт"
  operationIndex: number;    // 0-based index into operations[]
  isService?: boolean;       // true for (Послуга) prefixed lines
}

export interface BomEntry {
  product: {
    templateName: string;       // e.g. "🪵[Каркас - нарізана деревина]"
    attributes: AttributeVal[];
    variantDisplayName: string; // e.g. "🪵[Каркас - нарізана деревина] (100ДСП Механізм)"
    qty: number;
  };
  operations: OperationEntry[];
  components: ComponentEntry[];
}

export interface OdooImportJson {
  sourceFile: string;
  generatedAt: string;
  boms: BomEntry[];
}
