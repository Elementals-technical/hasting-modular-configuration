import { z } from "zod";

import type { Configurator } from "@/entities/configurator/api/types";
import type { CountertopDatatable } from "@/entities/countertop/api/types";
import type { ProductDatatable } from "@/entities/product/api/types";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const collectionIdSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const localJsonReferenceSchema = z.string().trim().min(1);

export const collectionRegistrySchema = z
  .object({
    defaultCollectionId: collectionIdSchema,
    collections: z
      .array(
        z
          .object({
            id: collectionIdSchema,
            manifest: localJsonReferenceSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const collectionManifestSchema = z
  .object({
    id: collectionIdSchema,
    label: z.string().trim().min(1),
    defaults: z.record(z.string(), jsonValueSchema),
    defaultPresetId: z.union([z.string(), z.number()]).optional(),
    local: z
      .object({
        navigation: localJsonReferenceSchema.optional(),
        presets: localJsonReferenceSchema.optional(),
        staticOptions: localJsonReferenceSchema.optional(),
        cabinetSkuMappings: localJsonReferenceSchema.optional(),
        /** Pricing SKU words of a collection priced from data (D04). */
        skuProfile: localJsonReferenceSchema.optional(),
        /**
         * Product data of the collection — option catalogs, capabilities, rule
         * parameters and reason codes. Validated by `parseProductProfile` rather than a
         * schema here: the profile contract is owned by C, and two validators over one
         * file would drift apart.
         */
        productProfile: localJsonReferenceSchema.optional(),
        /** Collection-defined flows, steps, sections and fields. */
        ui: localJsonReferenceSchema.optional(),
        /** Semantic attribute and value translations used by the scene adapter. */
        runtimeBindings: localJsonReferenceSchema.optional(),
        /**
         * Cabinet table rows in the same shape as the API datatable. Temporary, for a
         * collection whose table is not published yet; excludes `remote.cabinetTable`.
         */
        cabinetTable: localJsonReferenceSchema.optional(),
      })
      .strict()
      .optional(),
    remote: z
      .object({
        configurator: z
          .object({
            id: z.union([z.string().trim().min(1), z.number()]),
            view: z.enum(["short", "full"]).optional(),
            serialize: z.boolean().optional(),
          })
          .strict()
          .optional(),
        countertopTable: z
          .object({ id: z.union([z.string().trim().min(1), z.number()]) })
          .strict()
          .optional(),
        cabinetTable: z
          .object({ id: z.union([z.string().trim().min(1), z.number()]) })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const navigationStepSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    path: z.string().trim().startsWith("/"),
    headerPrefix: z.string().nullable().optional(),
  })
  .strict();

export const navigationSchema = z
  .object({
    prebuilt: z.array(navigationStepSchema),
    custom: z.array(navigationStepSchema),
  })
  .strict();

const productStyleSchema = z.enum([
  "1_drawer",
  "2_drawer",
  "single_basin",
  "double_basin",
  "asymmetrical",
  "open_shelving",
  "multi_level",
]);

const presetProductSchema = z
  .object({
    name: z.string(),
    Width: z.number().optional(),
    Height: z.number().optional(),
    Depth: z.number().optional(),
    SkuDepth: z.number().optional(),
    CabinetColor: z.string().optional(),
    Drawers: z.string().optional(),
    Handle: z.string().optional(),
    sinkType: z.string().optional(),
    CountertopColor: z.string().optional(),
    HandleGrooveColor: z.string().optional(),
    HandleColor: z.string().optional(),
    LegColor: z.string().optional(),
  })
  .passthrough();

export const presetsSchema = z.array(
  z
    .object({
      id: z.number(),
      img: z.string().trim().min(1),
      title: z.string().trim().min(1),
      desc: z.string().optional(),
      isProductModel: z.boolean(),
      price: z.string().optional(),
      presetProducts: z.array(presetProductSchema),
      size: z.enum(["24_29", "30_39", "40_49", "50_59", "60_69", "70_79", "80_89", "90_plus"]),
      style: z.array(productStyleSchema),
    })
    .strict(),
);

export const staticOptionsSchema = z
  .object({
    countertopThicknesses: z.array(z.string()),
    faucetHoleCounts: z.array(z.number()),
    cabinetTypes: z.array(z.string()),
    drawerConfigurations: z.array(z.string()),
    handles: z.array(z.string()),
  })
  .strict();

const stringMapSchema = z.record(z.string(), z.string());
export const cabinetSkuMappingsSchema = z
  .object({
    cabinetType: stringMapSchema,
    drawer: stringMapSchema,
    handle: stringMapSchema,
    pattern: stringMapSchema,
    sidePanel: stringMapSchema,
    divider: stringMapSchema,
    towelBar: stringMapSchema,
  })
  .strict();

/** Parts of an order whose SKU, quantity or input the collection has not confirmed (D04). */
export const pricingGapGroupSchema = z.enum([
  "legs",
  "vessel",
  "solidSurfaceGroup",
  "divider",
  "thickTop",
  "bracket",
  "countertop",
  "openSideShelf",
  "sidePanel",
  "towelBar",
]);

/** `SB/2DW/G57`: one code per attribute, in order. */
const skuConfigBlockSchema = z.array(z.object({ attributeId: z.string(), codes: stringMapSchema }).strict()).min(1);

/** `CAB-LACM-412`: the first element carries the price. */
const skuElementsSchema = z
  .array(
    z
      .object({
        code: z.string().trim().min(1),
        attributeId: z.string(),
        /** `LACM/B`: a suffix of the material decided by another attribute. */
        materialSuffix: z
          .object({ attributeId: z.string(), byValue: stringMapSchema, otherwise: z.string() })
          .strict()
          .optional(),
        /** Only on a cabinet whose option of that attribute has the capability, e.g. a handle with a groove. */
        appliesWhen: z
          .object({ attributeId: z.string(), capability: z.enum(["supportsGrooveColor"]) })
          .strict()
          .optional(),
        /** Spelled with this attribute's colour while its own is not chosen, e.g. a groove in the cabinet colour. */
        inheritsFrom: z.string().optional(),
      })
      .strict(),
  )
  .min(1);

/** A countertop the collection spells in its own words: `CT-{series}{material}-…` (Class, Mako). */
const collectionCountertopSchema = z
  .object({
    series: z.string().trim().min(1),
    styles: stringMapSchema,
    depthIn: z.string().trim().min(1),
    materialByColorCategory: stringMapSchema,
    /** A basin that belongs to one material decides it (`VA030` → `SSTEX`). */
    materialByBasin: stringMapSchema,
    /** The thickness of a material while none is chosen. */
    thicknessByMaterial: stringMapSchema,
    /** The price list's word for each `Thickness` value the collection offers (`4.75` → `4.7`). */
    thicknessCodes: stringMapSchema,
    bracket: z
      .object({
        sku: z.string().trim().min(1),
        quantity: z.number().int().positive(),
        thicknesses: z.array(z.string()),
      })
      .strict()
      .optional(),
  })
  .strict();

/** A part that is another collection's and priced as that one's: Urban Low Height's countertop, towel bar and side panels are USH's. */
const pricedAsSchema = z.object({ pricedAs: z.literal("urban-standard-height") }).strict();

/**
 * How a collection spells its pricing SKUs, for collections whose SKU words are data (D04).
 * USH keeps its series in code (D01); a collection with this file is priced from it alone.
 */
export const collectionSkuProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    collectionId: collectionIdSchema,
    /** `partial` while any group of `gaps` is open. */
    status: z.enum(["ready", "partial"]),
    sources: z.array(z.string()),
    cabinet: z
      .object({
        series: z.string().trim().min(1),
        configBlock: skuConfigBlockSchema,
        /**
         * A cabinet type with a series of its own, e.g. the open shelf `VAN-UROS-1S-…`. It keeps the
         * cabinet's elements unless it names its own, as a shelf without a handle does.
         */
        byCabinetType: z
          .record(
            z.string(),
            z
              .object({
                series: z.string().trim().min(1),
                configBlock: skuConfigBlockSchema,
                elements: skuElementsSchema.optional(),
              })
              .strict(),
          )
          .optional(),
        elements: skuElementsSchema,
      })
      .strict(),
    colors: z
      .object({
        /** Material SKU by the profile category of a colour option (`Lacquered MT` → `LACM`). */
        materialByCategory: stringMapSchema,
        /** Colour codes the name does not carry as a number (`Fume` → `SG`). */
        codeByValue: stringMapSchema,
      })
      .strict(),
    countertop: z.union([collectionCountertopSchema, pricedAsSchema]),
    /** The towel bar, for a collection that offers one. */
    towelBar: pricedAsSchema.optional(),
    /** The side panels, for a collection that offers them. */
    sidePanel: pricedAsSchema.optional(),
    /** One SKU per organizer, by `DividersStyle` value. */
    dividers: stringMapSchema,
    /** Vessel metadata by the collection's semantic `sinkType` value. */
    vessels: z
      .record(
        z.string(),
        z
          .object({
            sceneType: z.string().trim().min(1),
            series: z.string().trim().min(1),
          })
          .strict(),
      )
      .optional(),
    /** The legs a composition stands on, for a collection that offers them. */
    legs: z
      .object({
        /** Legs ordered per configuration; the collection's price is the price of one leg. */
        quantity: z.number().int().positive(),
        /** The `LegColor` value that means "in the cabinet's colour" rather than a colour of its own. */
        cabinetColorValue: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
    gaps: z.array(
      z
        .object({
          group: pricingGapGroupSchema,
          /** An order that uses the group has no complete price. */
          blocksTotal: z.boolean(),
          owner: z.string().trim().min(1),
          reason: z.string().trim().min(1),
          /**
           * The order uses the group when the attribute has a value, one of `values` or a value of
           * one of `categories`. Without it the gap concerns the collection, not a single order.
           */
          appliesWhen: z
            .object({
              attributeId: z.string(),
              values: z.array(z.string()).optional(),
              categories: z.array(z.string()).optional(),
            })
            .strict()
            .optional(),
        })
        .strict(),
    ),
  })
  .strict();

const configuratorVariantSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    image: z.string().nullable(),
    enabled: z.boolean(),
    description: z.string(),
    metadata: z.record(z.string(), z.unknown()),
  })
  .passthrough();

const configuratorOptionSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    resource: z.string().nullable(),
    paramString: z.string().nullable(),
    playcanvasString: z.string().nullable(),
    variants: z.array(configuratorVariantSchema),
  })
  .passthrough();

const configuratorGroupSchema = z
  .object({
    id: z.number(),
    proxyName: z.string(),
    proxyType: z.string(),
    enabled: z.boolean(),
    metadata: z.record(z.string(), z.unknown()),
    options: z.array(configuratorOptionSchema),
  })
  .passthrough();

export const configuratorSchema: z.ZodType<Configurator> = z
  .object({
    id: z.number(),
    name: z.string(),
    enabled: z.boolean(),
    organizationId: z.number(),
    description: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    availableOptions: z.array(configuratorGroupSchema),
    availableGeometryOptions: z.array(configuratorGroupSchema),
    availableStandardOptions: z.array(configuratorGroupSchema),
  })
  .passthrough();

const datatableSchemaFieldSchema = z.object({ name: z.string(), type: z.string() }).strict();
const datatableRowSchema = z.record(z.string(), z.string());
const datatableEnvelopeSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    schema: z.array(datatableSchemaFieldSchema),
    rows: z.array(datatableRowSchema),
    organizationId: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const countertopDatatableSchema: z.ZodType<CountertopDatatable> = datatableEnvelopeSchema;
export const productDatatableSchema: z.ZodType<ProductDatatable> = datatableEnvelopeSchema;

export type CollectionRegistry = z.infer<typeof collectionRegistrySchema>;
export type CollectionManifest = z.infer<typeof collectionManifestSchema>;
export type CollectionNavigation = z.infer<typeof navigationSchema>;
export type CollectionPreset = z.infer<typeof presetsSchema>[number];
export type CollectionStaticOptions = z.infer<typeof staticOptionsSchema>;
export type CabinetSkuMappings = z.infer<typeof cabinetSkuMappingsSchema>;
export type CollectionSkuProfile = z.infer<typeof collectionSkuProfileSchema>;
export type CollectionCountertop = z.infer<typeof collectionCountertopSchema>;

/** Whether the collection spells its countertop itself, rather than pricing it as another collection's. */
export const hasOwnCountertop = (
  skuProfile: CollectionSkuProfile,
): skuProfile is CollectionSkuProfile & { countertop: CollectionCountertop } => !("pricedAs" in skuProfile.countertop);
export type PricingGapGroup = z.infer<typeof pricingGapGroupSchema>;
