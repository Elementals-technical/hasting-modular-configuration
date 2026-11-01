---
paths:
  - "public/collections/**"
  - "src/entities/collection/**"
  - "src/entities/product/**"
---

# Collection data and product rules

> Read when: changing a collection package (`public/collections/<id>/`), collection loaders, or product rules.

- Before changing a value, read `docs/products/<id>/README.md` (USH: `docs/products/urban-standard-height.md`) and the one section file the task names. The specification is the team contract; `docs/ai/hastings/*.csv` holds the client sources behind it.
- Statuses matter: a `Provisional` or `UNKNOWN — clarify` fact is a decision for the owner, not a default to pick; `Not implemented` is backlog, not a defect.
- A change that alters a specified fact updates the section file and the revision date in the collection `README.md` in the same change.
