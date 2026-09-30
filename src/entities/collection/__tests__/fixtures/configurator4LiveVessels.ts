import configurator4 from "./remote/configurator-4.json";

const variant = (id: number, name: string, sku: string, codeColor: string, metadata: Record<string, string> = {}) => ({
  id,
  name,
  image: null,
  enabled: true,
  sort: 0,
  description: "",
  metadata: { sku, codeColor, ...metadata },
});

const option = (id: number, name: string, variants: ReturnType<typeof variant>[]) => ({
  id,
  name,
  resource: null,
  paramString: "",
  playcanvasString: "",
  variants,
});

/**
 * Configurator 4 with vessel colours the recorded sample leaves out, as the live configurator gives
 * them (2026-09-29). Its Vessels section is split by material, Ceramic, Solid Surface and Tekorlux,
 * so the material of a vessel colour is the option it is listed under; the sample keeps Ceramic only.
 */
export const configurator4WithLiveVessels = {
  ...configurator4,
  availableOptions: configurator4.availableOptions.map((group) =>
    group.proxyName === "Vessels"
      ? {
          ...group,
          options: [
            ...group.options,
            option(296, "Solid Surface", [
              variant(3316, "Matte Black T1D", "SS", "T1D"),
              variant(3315, "Matte White T1C", "SS", "T1C"),
            ]),
            option(289, "Tekorlux", [
              variant(3094, "Agata BD MT", "SSTKR", "BD MT", {
                Material: "Lacquered MT",
                label: "Agata BD MT",
                value: "Agata BD MT",
              }),
              variant(3146, "Bianco Gloss TAL", "SSTKR", "TAL"),
              variant(3147, "Bianco Matte TAM", "SSTKR", "TAM"),
            ]),
          ],
        }
      : group,
  ),
};
