export type CountertopDatatableSchemaField = {
  name: string;
  type: string;
};

export type CountertopDatatableRow = Record<string, string>;

export type CountertopDatatable = {
  id: number;
  name: string;
  description: string | null;
  schema: CountertopDatatableSchemaField[];
  rows: CountertopDatatableRow[];
  organizationId: number;
  createdAt: string;
  updatedAt: string;
};
