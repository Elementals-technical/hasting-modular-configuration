---
paths:
  - "package.json"
  - "vite.config.ts"
  - "tsconfig.app.json"
  - "tsconfig.node.json"
  - "eslint.config.js"
  - ".prettierrc"
  - ".env"
  - "index.html"
  - "scripts/**"
---

# Tooling rules

- The `@` → `src` alias is declared in `tsconfig.app.json`, `vite.config.ts` and `vitest.config.ts`; change all three together.
- The app tsconfig types the browser only. Code that needs Node APIs stays out of it: a script in `scripts/`, or a test excluded from `tsconfig.app.json` the way `recordPriceFixtures.test.ts` is.
- A script is a kebab-case `.mjs` ES module in plain JS with `node:` imports, failing fast with `throw new Error(…)`.
- `.env` holds public `VITE_*` build configuration only, never a secret; `REACT_APP_*` isn't used.
- A dependency change edits `package.json` and `package-lock.json` together, through `npm install`.
