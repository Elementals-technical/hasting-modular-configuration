# Environment and branch map

Revision 1 · observed 2026-10-28. Re-check with the commands at the end before relying on it.

## Branches (origin `Elementals-technical/hasting-modular-configuration`)

| Ref | Role (user-stated) | Evidence 2026-10-28 |
|---|---|---|
| `origin/phase-2/staging` | base for `feat/*`, `fix/*`; PRs land here | tip `cd4f3053` (= local `phase2/ui-fixes` HEAD) |
| `origin/phase-2/production` | next promotion after verification/approval only | tip `46a40f2d` = merge #495 of staging; tree identical to staging |
| `origin/production`, `origin/master` | old modular production line | no `public/collections`; not an ancestor of HEAD — never mix with Phase 2 |
| `origin/HEAD` | points to `origin/dev-oleg` | historical default, not used for Phase 2 |

Feature work: branch from `origin/phase-2/staging`; never change the current branch without need; no push/merge by the agent.

## Deployments (DigitalOcean App Platform, `Procfile`: `web: npm run start` → `vite preview`)

| Host | Role | Evidence | Bundle 2026-10-28 |
|---|---|---|---|
| `hasting-modular-phase-2-staging-ar3wz.ondigitalocean.app` | Phase 2 staging (by host name) | `vite.config.ts` allowedHosts | `index-B-mLU0_Q.js` |
| `hasting-modular-phase-2-p98qb.ondigitalocean.app` | Phase 2 (production candidate, by host name) | same | `index-B-mLU0_Q.js` |
| `hasting-modular-configuration-v3aur.ondigitalocean.app` | old modular production | same | `index-PdD89sUj.js` |
| `hastings-modular.vivid3d.tech` | old modular production (custom domain) | same | `index-PdD89sUj.js` |

The local `dist/` built from HEAD has the same bundle hash `index-B-mLU0_Q.js` → both Phase 2 hosts served the current staging tree on that date. Branch → app mapping is **not** in the repository (no app spec, no CI); host roles above come from host names only, not from deployment configuration.

## External systems (owners other than this frontend)

| System | Used for | Owner boundary |
|---|---|---|
| RenderAdmin `renderadmin.vivid3d.tech` (collections data, `pricing-v2/resolve`) | catalog data, prices | backend |
| Configuration API (`VITE_API_BASE_URL`, `/modular/configurations/store`) | save/share/restore | backend |
| PlayCanvas export `public/HastingCabinetsParametrization/` (source repo not on this machine) | 3D scene | PlayCanvas |
| HubSpot form (How to Buy / quote) | lead submission | client marketing |

## Re-check

```sh
git fetch   # user action
git log -1 --format=%h origin/phase-2/staging origin/phase-2/production
for h in hasting-modular-phase-2-staging-ar3wz.ondigitalocean.app hasting-modular-phase-2-p98qb.ondigitalocean.app; do curl -s "https://$h/" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1; done
```
