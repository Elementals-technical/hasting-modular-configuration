import configurator4 from "./remote/configurator-4.json";
import configurator10 from "./remote/configurator-10.json";

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

const lacquer = (id: number, name: string, sku: string, codeColor: string, material: string) =>
  variant(id, name, sku, codeColor, { Material: material, label: name, value: name });

/**
 * Configurator 10, Urban Low Height's own, with lacquered countertop colours of the kind configurator 4
 * lists and it does not: an MT lacquer under one value as Tekorlux (SSTKR) and as Glass MT (GLSM), a GL
 * lacquer as Glass GL (GLSG). No Urban Low Height user sees them; they keep table 589's rules for such
 * colours covered.
 */
export const configurator10WithLacquerCountertops = {
  ...configurator10,
  availableOptions: configurator10.availableOptions.map((group) =>
    group.proxyName === "Select Countertop Color"
      ? {
          ...group,
          options: group.options.map((countertopOption) => ({
            ...countertopOption,
            variants: [
              ...countertopOption.variants,
              lacquer(90_094, "Agata BD MT", "SSTKR", "BD MT", "Tekorlux"),
              lacquer(90_099, "Bianco 0B MT", "SSTKR", "0B MT", "Tekorlux"),
              lacquer(90_153, "Bianco 0B MT", "GLSM", "0B MT", "Glass MT"),
              lacquer(90_211, "Bianco 0B GL", "GLSG", "0B GL", "Glass GL"),
            ],
          })),
        }
      : group,
  ),
};
