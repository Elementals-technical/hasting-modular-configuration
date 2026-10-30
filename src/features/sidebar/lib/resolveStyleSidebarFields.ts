import type { CustomizationSchema, StyleSidebarFieldId } from "@/entities/collection";

const DEFAULT_STYLE_SIDEBAR_FIELDS: readonly StyleSidebarFieldId[] = ["Width", "Depth", "Handle"];

/** The collection's `styleSidebar.fields` (ui.json), else Width, Depth and Handle. */
export const resolveStyleSidebarFields = (
  schema: Pick<CustomizationSchema, "styleSidebar"> | null | undefined,
): readonly StyleSidebarFieldId[] => schema?.styleSidebar?.fields ?? DEFAULT_STYLE_SIDEBAR_FIELDS;
