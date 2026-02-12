export type ProductDatatableSchemaField = {
  name: string;
  type: string;
};

export type ProductDatatableRow = Record<string, string>;

export type ProductDatatable = {
  id: number;
  name: string;
  description: string | null;
  schema: ProductDatatableSchemaField[];
  rows: ProductDatatableRow[];
  organizationId: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductSkuPriceResponse = Record<string, unknown>;
