import profileDocument from "../../../../public/collections/tricot/product-profile.json";
import skuDocument from "../../../../public/collections/tricot/sku-profile.json";
import uiDocument from "../../../../public/collections/tricot/ui.json";
import runtimeDocument from "../../../../public/collections/tricot/runtime-bindings.json";
import { parseRuntimeBindings } from "../lib/runtimeBindings/parseRuntimeBindings";
import { parseProductProfile } from "../lib/parseProductProfile";
import { validateCustomizationSchema } from "../lib/customization/validateCustomizationSchema";
import { collectionSkuProfileSchema, configuratorSchema } from "../model/schemas";
import type { RuntimeBindingSet } from "../model/runtimeBindings";
import type { ConfiguratorGroupCatalog } from "../model/types";
import configuratorDocument from "./fixtures/remote/configurator-12.json";
import countertopTable from "./fixtures/remote/datatable-593.json";
import { parseCountertopMatrix } from "@/features/configurator-rule-core/countertop/parse";

const parsed = parseProductProfile(profileDocument);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
export const tricotProfile = parsed.profile;
/** Mirrors the profile hydrated by the loader, using the approved read-only API export. */
export const tricotMatrixProfile = { ...tricotProfile, countertopRules: parseCountertopMatrix(countertopTable) };
export const tricotSkuProfile = collectionSkuProfileSchema.parse(skuDocument);
const uiResult = validateCustomizationSchema(uiDocument);
if (!uiResult.ok) throw new Error("Invalid Tricot UI");
export const tricotUi = uiResult.schema;

const configurator = configuratorSchema.parse(configuratorDocument);
/** Tricot's own material configurator (12), as the loader indexes it: its palettes give the profile's colours hex and SKU. */
export const tricotConfigurator: ConfiguratorGroupCatalog = {
  groups: configurator.availableOptions,
  groupsByName: Object.fromEntries(configurator.availableOptions.map((group) => [group.proxyName, group])),
};

const runtimeResult = parseRuntimeBindings(runtimeDocument);
if (!runtimeResult.ok) throw new Error(JSON.stringify(runtimeResult.diagnostics));
/**
 * Production partial handoff. Unlike the test port below, invalid values are blocked; pending ones
 * are placed without, and their commands are unsupported.
 */
export const tricotRuntimeBindings = runtimeResult.bindings;

/** Test port only: these product types/keys are NOT claimed to exist in the production scene. */
export const tricotTestBindings: RuntimeBindingSet = {
  schemaVersion: 1,
  collectionId: "tricot",
  productTypes: { "Sink-Base": "test-tricot-sb", "Side-Cabinet": "test-tricot-sc" },
  bindings: tricotProfile.attributes.map(({ attributeId, scope }) => ({
    attributeId,
    status: "bound",
    target: scope === "global" ? { kind: "cabinets" } : { kind: "product" },
    values: { kind: "identity", sceneKey: "test:" + attributeId },
  })),
};
