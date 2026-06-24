export const UOM = {
  UNITS: 1,   // Одиниці
  M: 8,       // m (метр)
  M2: 10,     // m² (квадратний метр)
  G: 14,      // g (грам)
  KG: 15,     // кг (кілограм)
  M3: 30,     // m³ (кубічний метр)
} as const;

export type UomId = typeof UOM[keyof typeof UOM];

/** Компонент у специфікації */
export interface ComponentSpec {
  product: string;
  variants?: string[];       // значення атрибутів для пошуку варіанту
  qty: number;
  uomId: number;
  operationIndex?: number;  // 0-based індекс в масиві operations (поле "Спожитий в операції")
}

/** Операція в специфікації */
export interface OperationSpec {
  name: string;
  workcenter: string;       // назва робочого центру (буде створений якщо не існує)
  priceRate?: number;       // x_studio_piece_rate_2
}

/** Повне визначення специфікації (BOM) */
export interface BomDef {
  product: string;           // назва шаблону товару
  variants?: string[];       // значення атрибутів вихідного варіанту (порожньо = простий товар)
  reference?: string;        // код специфікації (за замовчуванням — variants через ' / ')
  qty?: number;              // кількість виходу (за замовчуванням 1)
  operations: OperationSpec[];
  components: ComponentSpec[];
}

/** Результат пошуку/вирішення варіанту товару */
export interface ResolvedProduct {
  variantId: number;
  templateId: number;
  displayName: string;
}
