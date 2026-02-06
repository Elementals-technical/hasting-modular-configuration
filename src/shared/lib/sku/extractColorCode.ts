export const extractColorCode = (value?: string | null): string | null => {
  if (!value) return null;

  const tokens = value
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) return null;

  const last = tokens[tokens.length - 1];
  const secondLast = tokens.length > 1 ? tokens[tokens.length - 2] : null;

  const isWord = (token: string) => /^[A-Za-z]+$/.test(token);
  const isAlnum = (token: string) => /^[A-Za-z0-9]+$/.test(token);

  if (secondLast && isWord(last) && last.length <= 3 && isAlnum(secondLast) && secondLast.length <= 3) {
    return `${secondLast}${last}`;
  }

  return last || null;
};
