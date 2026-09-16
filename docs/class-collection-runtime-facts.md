# Class collection runtime facts

This note records the currently confirmed scene API facts for the Class collection. They are inputs for a later ProductProfile and runtime-bindings delivery; the first partial manifest does not declare runtime bindings.

## Cabinet lifecycle

Create a cabinet with the case-sensitive product type `Class-side-cabinet`. Keep the returned `cabinetId`: later updates, reads, and removal must address that runtime ID.

```ts
const api = window.ConfiguratorAPI;

const cabinetId = await api.addProduct("Class-side-cabinet", {
  Width: 60,
  Height: 52,
  Depth: 52,
  InnerDrawer: "Disable",
});

if (!cabinetId) throw new Error("Class cabinet was not created");

const result = await api.setConfig(cabinetId, {
  Width: 80,
  Height: 40,
  InnerDrawer: "Enable",
});

if (!result?.success) throw new Error("Class cabinet configuration was not updated");

const currentConfig = api.getConfig(cabinetId);
```

## Confirmed fields

Dimensions use centimetres and are not converted to metres. Field names and string values are case-sensitive.

| Field | Confirmed values | Meaning |
|---|---|---|
| `Width` | `40`, `60`, `80`, `100`, `120` | Cabinet width |
| `Height` | `40`, `52` | Cabinet height and drawer layout |
| `Depth` | `52` | The only confirmed depth |
| `InnerDrawer` | `"Disable"`, `"Enable"` | Changes the visible layout only when `Height` is `40` |
| `CabinetColor` | Value not yet supplied | Front insert material |
| `CabinetSideColor` | Value not yet supplied | Cabinet wall and bottom material |
| `FrameColor` | Value not yet supplied | Front frame material |

## Still required before runtime enablement

The collection still needs an approved ProductProfile, complete value catalogs for the three colour fields, semantic-to-scene mappings, target rules, reset behaviour, and browser verification. Until these inputs exist, the application must treat runtime changes for Class as unsupported instead of borrowing Urban Standard Height mappings.
