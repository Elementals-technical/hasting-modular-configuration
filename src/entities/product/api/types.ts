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

export type ProductSkuPriceResponse = {
  price: number;
  resolver: string;
  error: string | null;
  metadata: Record<string, unknown>;
  parsed: Record<string, unknown>;
};

export type SkuResolveResponse = {
  price: number;
  resolver: string;
  error: string | null;
  metadata: Record<string, unknown>;
  parsed: Record<string, unknown>;
};

export type SkuSearchRow = {
  sku: string;
  prices: Record<string, number>;
};

export type SkuSearchResponse = {
  rows: SkuSearchRow[];
  error: string | null;
};
