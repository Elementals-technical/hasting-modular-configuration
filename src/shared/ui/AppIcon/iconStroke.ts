/** Stroke in rendered CSS pixels. Sizes between 16 and 20 use the small-icon weight. */
export const getIconStrokeWidth = (size: number): 1.25 | 1.5 => (size >= 20 ? 1.5 : 1.25);
