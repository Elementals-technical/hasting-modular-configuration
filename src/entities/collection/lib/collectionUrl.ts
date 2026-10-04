export const withCollectionId = (targetUrl: string, collectionId: string): string => {
  const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(targetUrl);
  const rootRelative = targetUrl.startsWith("/");
  const url = new URL(targetUrl, "https://collection-url.invalid/");
  url.searchParams.set("collectionId", collectionId);

  if (absolute) return url.href;
  const relativeResult = `${url.pathname}${url.search}${url.hash}`;
  return rootRelative ? relativeResult : relativeResult.replace(/^\//, "");
};
