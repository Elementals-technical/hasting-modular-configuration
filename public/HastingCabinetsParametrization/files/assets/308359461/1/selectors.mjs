/**
 * Body selectors for manipulable specs (engine-free).
 *
 * A body is `{ id, tags: string[], meta?: object, entity?: any }` as listed by the host scene.
 * A selector is either a string shortcut ('self', 'others', 'all'), a tag selector built with
 * `tag()`, a combinator (`all`, `any`, `not`), an `envelope()` wrapper, or a predicate
 * `(body, ctx) => boolean`. `ctx.self` is the moving body.
 */

const SELECTOR = Symbol.for('spatial-manipulation.selector');

const make = (kind, test, extra = {}) => Object.freeze({ [SELECTOR]: true, kind, test, ...extra });

export const isSelector = value => Boolean(value && value[SELECTOR] === true);

/** Bodies carrying `name` in their tags. */
export const tag = name => {
  if (typeof name !== 'string' || name.length === 0) throw new TypeError('tag() requires a non-empty tag name');
  return make('tag', body => Array.isArray(body?.tags) && body.tags.includes(name), { name });
};

/** Bodies matching every selector. */
export const all = (...selectors) => {
  const parts = selectors.map(toSelector);
  return make('all', (body, ctx) => parts.every(part => part.test(body, ctx)), { parts });
};

/** Bodies matching at least one selector. */
export const any = (...selectors) => {
  const parts = selectors.map(toSelector);
  return make('any', (body, ctx) => parts.some(part => part.test(body, ctx)), { parts });
};

/** Bodies not matching the selector. */
export const not = selector => {
  const part = toSelector(selector);
  return make('not', (body, ctx) => !part.test(body, ctx), { parts: [part] });
};

/**
 * The union bounds of a selection, measured as one pseudo-body with id `envelope:<name>`.
 * Features extracted from an envelope describe the group (e.g. the composition's outer edges).
 */
export const envelope = (selector, { id = 'envelope' } = {}) => {
  const inner = toSelector(selector);
  return make('envelope', inner.test, { inner, envelopeId: id });
};

const SELF = make('self', (body, ctx) => body.id === ctx.self?.id);
const OTHERS = make('others', (body, ctx) => body.id !== ctx.self?.id);
const ALL = make('all-bodies', () => true);

/** Normalize a selector-like value to a selector object. */
export const toSelector = value => {
  if (isSelector(value)) return value;
  if (value === 'self') return SELF;
  if (value === 'others') return OTHERS;
  if (value === 'all') return ALL;
  if (typeof value === 'function') return make('predicate', value);
  throw new TypeError(`Unknown selector: ${String(value)}`);
};

/**
 * Apply a selector to the scene bodies. The moving body is excluded from every selector except
 * 'self' (a body never snaps or collides with itself). Envelopes return one pseudo-body.
 */
export const selectBodies = (selector, bodies, ctx) => {
  const normalized = toSelector(selector);
  if (normalized.kind === 'self') return ctx.self ? [ctx.self] : [];
  const others = bodies.filter(body => body.id !== ctx.self?.id);
  if (normalized.kind === 'envelope') {
    const members = others.filter(body => normalized.inner.test(body, ctx));
    return members.length ? [{ id: normalized.envelopeId, tags: ['envelope'], members }] : [];
  }
  return others.filter(body => normalized.test(body, ctx));
};
