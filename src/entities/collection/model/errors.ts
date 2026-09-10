export type CollectionErrorCode =
  | "invalid-registry"
  | "invalid-manifest"
  | "invalid-collection-id"
  | "unknown-collection"
  | "invalid-reference"
  | "source-load-failed"
  | "source-validation-failed";

export type CollectionError = {
  code: CollectionErrorCode;
  message: string;
  cause?: unknown;
};

export class CollectionDataError extends Error {
  readonly code: CollectionErrorCode;

  constructor(code: CollectionErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CollectionDataError";
    this.code = code;
  }
}

export const toCollectionError = (error: unknown): CollectionError => {
  if (error instanceof CollectionDataError) {
    return { code: error.code, message: error.message, cause: error.cause };
  }

  return {
    code: "source-load-failed",
    message: error instanceof Error ? error.message : "Collection data could not be loaded",
    cause: error,
  };
};
