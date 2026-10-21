import type { CabinetHeightStyle } from "@/entities/collection";

/**
 * The cards of a drawer style that comes in models of different heights (`cabinetStyle.heightStyles`).
 *
 * Urban Low Height has one drawer style, at 38 or 28 cm with the upper groove and at 35 or 25 cm with
 * push-to-open: the taller model and the Slim. A model's card stands at the first of its heights the
 * rules allow the cabinet being added, so a handle that moves the heights moves the card with them.
 * The cabinets of a composition share a height: the card of that height adds a cabinet, another one
 * switches every cabinet to its own.
 */

export type HeightStyleCard = {
  id: string;
  label: string | null;
  /** The height a cabinet of this card takes, in cm. */
  height: number;
  /** The placed cabinets stand at another height: choosing the card switches every one of them. */
  switchesComposition: boolean;
};

export const resolveHeightStyleCards = ({
  heightStyles,
  heightChoices,
  compositionHeight,
}: {
  heightStyles: readonly CabinetHeightStyle[] | undefined;
  /** The heights the rules leave the cabinet being added (`getHeightChoices`). */
  heightChoices: readonly number[];
  /** The height the placed cabinets share; null while none is placed. */
  compositionHeight: number | null;
}): HeightStyleCard[] => {
  const cards = (heightStyles ?? []).flatMap(({ id, label, heights }): HeightStyleCard[] => {
    const height = heights.find((candidate) => heightChoices.includes(candidate));
    if (height === undefined) return [];

    return [
      {
        id,
        label: label ?? null,
        height,
        switchesComposition: compositionHeight !== null && height !== compositionHeight,
      },
    ];
  });

  // With one card or none there is nothing to choose between: the style keeps its single card.
  return cards.length > 1 ? cards : [];
};
