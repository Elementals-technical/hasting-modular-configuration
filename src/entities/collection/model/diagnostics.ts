export type CollectionDiagnosticSeverity = "error" | "warning";

export type CollectionDiagnostic = {
  code: string;
  severity: CollectionDiagnosticSeverity;
  dataset: "productProfile" | "customization" | "navigation" | "runtimeBindings";
  dataPath?: string;
  message: string;
};
