export const COUNTERTOP_METERS_PER_INCH = 0.0254;
export const COUNTERTOP_INCHES_PER_METER = 1 / COUNTERTOP_METERS_PER_INCH;

export function inchesToMeters(value) {
  return value * COUNTERTOP_METERS_PER_INCH;
}

export function metersToInches(value) {
  return value * COUNTERTOP_INCHES_PER_METER;
}
