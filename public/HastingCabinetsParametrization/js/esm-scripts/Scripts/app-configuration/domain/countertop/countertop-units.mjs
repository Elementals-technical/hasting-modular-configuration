const COUNTERTOP_METERS_PER_INCH = 0.0254;
const COUNTERTOP_INCHES_PER_METER = 1 / COUNTERTOP_METERS_PER_INCH;
function inchesToMeters(value) {
    return value * COUNTERTOP_METERS_PER_INCH;
}
function metersToInches(value) {
    return value * COUNTERTOP_INCHES_PER_METER;
}

export { COUNTERTOP_INCHES_PER_METER, COUNTERTOP_METERS_PER_INCH, inchesToMeters, metersToInches };
