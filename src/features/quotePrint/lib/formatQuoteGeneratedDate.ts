const quoteDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
});

export const formatQuoteGeneratedDate = (date: Date = new Date()) => quoteDateFormatter.format(date).replace(/\//g, ".");
