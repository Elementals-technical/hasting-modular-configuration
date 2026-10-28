/**
 * Read a config value (number or numeric string) as a finite number.
 * @example finiteNumber('45') // → 45
 */
export function finiteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Look up a side-panel table by a numeric config value; null when the value is not a key.
 * @example tableValue({ 45: -0.1 }, '45') // → -0.1
 */
export function tableValue(table, value) {
    const number = finiteNumber(value);
    return number !== null && Object.prototype.hasOwnProperty.call(table, number)
        ? table[number]
        : null;
}
