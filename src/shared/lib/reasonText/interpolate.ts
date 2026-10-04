/** Values substituted into `{name}` placeholders of a message. */
export type MessageParams = Record<string, string | number>;

/**
 * Fills `{name}` placeholders of a message template.
 * A placeholder without a matching param is left as written, so a missing value is visible.
 */
export const interpolateMessage = (template: string, params?: MessageParams): string => {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
};
