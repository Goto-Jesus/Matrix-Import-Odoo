export interface AttributeVal {
  attributeName: string;
  value: string;
}

export interface OperationEntry {
  name: string;
  workcenterName: string;
  priceRate: number;
  odooWorkcenterId?: number;
}

export interface ComponentEntry {
  templateName: string;
  attributes: AttributeVal[];
  qty: number;
  uom: string;
  operationIndex: number;
  isService?: boolean;
  ifAttr?: Record<string, string>;
  odooTemplateId?: number;
  odooVariantId?: number;
  odooUomId?: number;
}

export interface BomEntry {
  product: {
    templateName: string;
    attributes: AttributeVal[];
    variantDisplayName: string;
    qty: number;
    odooTemplateId?: number;
    odooVariantId?: number;
    ifAttr?: Record<string, string>;
  };
  operations: OperationEntry[];
  components: ComponentEntry[];
  expand?: Record<string, string[]>;
}

export interface OdooImportJson {
  sourceFile: string;
  generatedAt: string;
  boms: BomEntry[];
}
