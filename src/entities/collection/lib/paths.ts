import { CollectionDataError } from "../model/errors";

const assertRelativeReference = (reference: string) => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(reference);
  } catch (cause) {
    throw new CollectionDataError("invalid-reference", `Invalid encoded collection reference: ${reference}`, { cause });
  }

  if (
    decoded.startsWith("/") ||
    decoded.includes("\\") ||
    decoded.includes("?") ||
    decoded.includes("#") ||
    decoded.split("/").some((part) => part === ".." || part === "." || part === "")
  ) {
    throw new CollectionDataError("invalid-reference", `Collection reference must be a safe relative path: ${reference}`);
  }
};

const assertWithinCollectionsRoot = (url: URL, collectionsRootUrl: URL, reference: string) => {
  const rootPath = collectionsRootUrl.pathname.endsWith("/")
    ? collectionsRootUrl.pathname
    : `${collectionsRootUrl.pathname}/`;

  if (url.origin !== collectionsRootUrl.origin || !url.pathname.startsWith(rootPath)) {
    throw new CollectionDataError("invalid-reference", `Collection reference escapes the collections root: ${reference}`);
  }
};

export const resolveCollectionJsonUrl = (
  reference: string,
  declaringUrl: string,
  collectionsRootUrl: string,
): string => {
  assertRelativeReference(reference);
  if (!reference.toLowerCase().endsWith(".json")) {
    throw new CollectionDataError("invalid-reference", `Collection JSON reference must end in .json: ${reference}`);
  }

  const resolved = new URL(reference, declaringUrl);
  assertWithinCollectionsRoot(resolved, new URL(collectionsRootUrl), reference);
  return resolved.href;
};

export const resolveCollectionImageUrl = (
  reference: string,
  manifestUrl: string,
  collectionsRootUrl: string,
): string => {
  if (/^https:\/\//i.test(reference)) return new URL(reference).href;
  if (/^[a-z][a-z\d+.-]*:/i.test(reference)) {
    throw new CollectionDataError("invalid-reference", `Collection image URL must use HTTPS: ${reference}`);
  }

  assertRelativeReference(reference);
  const resolved = new URL(reference, manifestUrl);
  assertWithinCollectionsRoot(resolved, new URL(collectionsRootUrl), reference);
  return resolved.href;
};

export const toAbsoluteCollectionUrl = (url: string, origin: string): string => new URL(url, origin).href;
