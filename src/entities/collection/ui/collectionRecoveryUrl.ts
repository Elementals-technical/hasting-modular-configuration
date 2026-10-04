export const removeCollectionIdFromUrl = (href: string): string => {
  const url = new URL(href);
  url.searchParams.delete("collectionId");
  return url.toString();
};
