import { z } from "zod";

import type { Configurator } from "@/entities/configurator/api/types";
import type { CountertopDatatable } from "@/entities/countertop/api/types";
import type { ProductDatatable } from "@/entities/product/api/types";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

const collectionIdSchema = z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
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
        /**
         * Product data of the collection — option catalogs, capabilities, rule
         * parameters and reason codes. Validated by `parseProductProfile` rather than a
         * schema here: the profile contract is owned by C, and two validators over one
         * file would drift apart.
         */
        productProfile: localJsonReferenceSchema.optional(),
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
