# DEV-05…DEV-10 residue report v3

From Developer C, 23.09.2026, branch `S1-DD-C/ProductProfile`. Replaces v2 of 22.09.2026.

This lists what still keeps product knowledge or scene calls outside the collection path, who removes each item
and what it waits for. The lists are guarded: `src/entities/collection/__tests__/collectionConsumerBoundary.test.ts`
fails when a new file joins a list, when a count grows, or when a file that was cleaned up stays on one.

Owners: **B** pages and fields, **C** state, rules and commands, **I** scene and bindings, **D** pricing,
**Product** decisions and data.

## What moved since v1

| Area | Now | Proof |
| --- | --- | --- |
| Integrated basin (C06, 23.09) | A basin that names its sink base reaches that one product: the adapter narrows the binding's product type to the named sink base, so the countertop steps send one command per fitting sink base instead of a batch of their own. Files calling the scene directly: 5 → 1. | `createPlayCanvasRuntimePort.test.ts`, boundary test |
| Dividers None (C06, 23.09) | Clearing the placed dividers goes through the divider port and the `clearDividers` command, which records the cleared placements only for what the scene took. | `clearDividers.test.ts`, boundary test |
| Divider style (C06/DEV-07, 23.09) | The picker stores the style the profile declares (`"A"`), not its English label. The label parser is gone, the style is configuration-wide, and the steps record it through the command. Files writing a command-owned value directly: 5 → 0. | `replayValues.test.ts`, `deriveOptions.test.ts`, boundary test |
| Scene calls (C06, 21.09) | Presets, adding/removing/swapping cabinets, undo/redo and the 3D player change the scene through the commands. Files calling the scene directly: 13 → 5. | `compositionCommands.test.ts`, boundary test |
| Page option lists (B06) | The countertop and accessories steps list basins, countertop styles, thicknesses, side panels, divider options and styles and towel bar options from the collection's profile. The page constants are gone. | `pageOptionCatalogs.test.ts`, boundary test "declares no page product catalog" |
| Materials (DEV-06) | Material filter groups come from `materialNormalization.displayHierarchy`; the vessel-compatible countertop materials from `vesselCompatibleCountertopMaterialTokens`; every rule and page matches materials by the collection's alias table. | `materialAliases.test.ts`, boundary test "matches materials by the collection's alias table" |
| Countertop step (C06) | Vessel colour, vessel basin, the plain cutout and the countertop style go through the commands. | boundary test counts |
| Accessories and sidebar (C06) | The towel bar reset, the side shelf removal before a handle change, the preset cabinet colour and the divider option go through the commands. | boundary test counts |
| Reason texts (DEV-08) | Countertop size and width reasons, composition and side panel length, cabinet type and height, the locked-height handle, open-cabinet handles, model compatibility, dividers and the 46 cm integrated restriction return a reason code; the text comes from `messages`, the old English string is the fallback. USH texts are identical to the old strings. | `legacyReasonTextParity.test.ts`, `reasonCodesHaveMessages.test.ts` |
| Handle knowledge (C02) | The side panel groove preferred for a handle comes from `sidePanels.groovePriorityByHandle`; the sidebar recognises a locked-height handle by its reason code, not by the English text. | `sidePanelService.test.ts` |
| Unknown collections (C02.2) | A collection with a cabinet table but no profile is rejected instead of being read with USH columns. | `loadCollection.test.ts` |
| Undecided product rules (C13, CONTRACTS §8) | A change the product has not decided is blocked as `undetermined` with `product.missingData`; nothing changes. Mako declares one: Leg Color on a one-drawer cabinet (Q-MAKO-002). | `undeterminedGate.test.ts` |
| Other collections | Class, Mako and Urban Low Height have texts for the command's own reasons, so a blocked change no longer shows a bare code. | `reasonCodesHaveMessages.test.ts` |
| Restore (C09) | A saved link restores once under StrictMode, after a page remount and when the scene becomes ready later. | `useRestoreSavedConfiguration.test.tsx` |
| Table 438 fallbacks (DEV-06) | Analysed against the frozen table: see section 4. | `countertopFallbacksVs438.test.ts` |
| Reason texts of the interface (DEV-08) | One place turns a reason code into text: the collection's own wording first, then the interface dictionary (`shared/lib/reasonText`). The option and style items and the colour step hold no wording of their own, the cabinet-style mixing text included. | `reasonText.test.ts`, `uiReasonCodes.test.ts`, `reasonTextInItems.test.tsx` |

## 1. Direct scene calls (1 file)

| File | What remains | Owner | Unblocked by |
| --- | --- | --- | --- |
| `features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar.tsx` | 1 call: the size effect sends Height with Depth to every cabinet at once. | C | Depth and Height both have `changeDimension`, but the port sends one patch per change, so the single call becomes two. `updateDimensionDataForProduct` replaces the dimension label rather than merging it, so the split needs a browser check before it lands. |

## 2. Direct state writes

None. Every value the command owns is written by `commitChange.ts` alone.

## 3. Attributes the scene cannot take through a command

| Attribute | Why | Owner |
| --- | --- | --- |
| `SidePanels`, `SidePanelLeft`, `SidePanelRight` | The scene takes the groove together with a side; the side panel command builds that patch. | I |
| `DividersOption`, `DividersStyle` | Dividers reach the scene as drawer zone objects built by the divider adapter. The option is recorded by the command, the scene part stays with the adapter. | I |

`BookMatching`, `LedOption`, `FaucetHolesAmount` and `FaucetHolesSpacing` are `state-only` bindings: the command
records them without a scene call.

## 4. Product decisions

| Item | Facts | Owner |
| --- | --- | --- |
| USH `countertopFallbacks` (`needsConfirmation: true`) | Every restricted material and basin is already in table 438, and the depth filter reads the table: there the fallback is a duplicate. The countertop pages also ask the fallback directly ("46 cm → vessel only") and 438 allows **Ocritech Rayo, Roll and Quadra integrated at 46 cm**: the only case where the fallback changes the outcome, against the table. That check also compares tokens without aliases, so an Ocritech colour is restricted when named SSOCR and not when named "Ocritech". | Product: which source is right for Ocritech at 46 cm |
| Class and Mako integrated basins | No Class or Mako rows in the countertop table, so basin-by-material and minimum sink base width are undetermined. Declaring them in `undeterminedRules` is one data entry, but it disables every integrated basin in both collections. | Product |
| Class and Mako rules not expressible yet | 220 cm, at most two sink bases, height by style, SB 60 / 1DWID without Integrated, floating: see `class-profile.md`, `mako-profile.md`. | Product, then C |

## 5. Waiting for other owners

| Item | Owner |
| --- | --- |
| Pricing still matches countertop materials by the legacy alias table and reads thickness from `COUNTERTOP_THICKNESS_OPTIONS`; `countertopColorResolution.ts` has its own alias groups. | D |
| Class has no runtime bindings; Mako has no basins in the scene and no Mako materials. | I (I07), scene resources |
| Test profiles cannot be opened in the browser: the production registry lists only the real collections. | A |
| Class loads its sources from the USH configurator and tables. | Product → A |
| The material filter tree still compares its reasons as text; its wording already comes from the collection, so only the comparison is left. | B |
| A second language: the dictionary and the resolver are one place, but no locale is chosen anywhere yet. | B |

## Legacy fallbacks kept in code

Used only when the active collection does not declare the data; each is kept equal to the USH profile by test.

| Fallback | Profile data | Test |
| --- | --- | --- |
| `LEGACY_MATERIAL_ALIASES` | `materialNormalization.aliases` | `materialAliases.test.ts` |
| `LEGACY_MATERIAL_HIERARCHY` | `materialNormalization.displayHierarchy` | `materialAliases.test.ts` |
| `LEGACY_VESSEL_COMPATIBLE_COUNTERTOP_MATERIAL_TOKENS` | `materialNormalization.vesselCompatibleCountertopMaterialTokens` | `materialAliases.test.ts` |
| English reason strings | `messages` | `legacyReasonTextParity.test.ts` |
| `DividersStyle` labels of links saved before the style was stored by value | `aliases` of the `DividersStyle` options | `replayValues.test.ts` |

## Not checked here

The real scene and the live Save service were not used. The browser run of `c12-state-acceptance.md` is still to be
done together with I06; it should include the countertop and accessories steps, which now go through the commands.
