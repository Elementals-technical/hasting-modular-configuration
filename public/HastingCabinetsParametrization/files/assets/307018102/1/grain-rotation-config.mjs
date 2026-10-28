/**
 * Grain Direction Rotation Config
 *
 * Maps material names to triplanar rotation angles for GrainVertical/GrainHorizontal.
 * Used by RuleGrainDirection to rotate textures instead of overlay entities.
 *
 * Source: Hastings Config guide - GrainDirMaterials.csv
 */

export const GRAIN_ROTATION_MAP = {
    // Essenze series
    "Rovere Eucalipto 01A":                 { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Bianco 06A":                    { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Naturale 06B":                  { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Sabbia 06C":                    { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Cenere 06D":                    { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Avena 06E":                     { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Fumo 06F":                      { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Carbone 06G":                   { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Moka 06H":                      { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Nero 06J":                      { GrainVertical: 90, GrainHorizontal: 0 },

    // HPL series
    "Rovere Monet TK3":                     { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Slavonia TK6":                  { GrainVertical: 90, GrainHorizontal: 0 },
    "Ardesia TKF":                          { GrainVertical: 35, GrainHorizontal: 0 },
    "Noce Savoia TKG":                      { GrainVertical: 90, GrainHorizontal: 0 },
    "Pulpis Chiaro TKH":                    { GrainVertical: 45, GrainHorizontal: 0 },
    "Pulpis Scuro TKJ":                     { GrainVertical: 45, GrainHorizontal: 0 },
    "Rovere Valdweg TKK":                   { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Alba TKL":                      { GrainVertical: 90, GrainHorizontal: 0 },
    "Noce Sinfonia TKM":                    { GrainVertical: 90, GrainHorizontal: 0 },

    // 3D series
    "Pietra Piasentina Grigio Chiaro 1AA":  { GrainVertical: 90, GrainHorizontal: 0 },
    "Pietra Piasentina Grigio Scuro 1AB":   { GrainVertical: 90, GrainHorizontal: 0 },
    "Castagno Chiaro 1C1":                  { GrainVertical: 90, GrainHorizontal: 0 },
    "Castagno Malto 1C2":                   { GrainVertical: 90, GrainHorizontal: 0 },
    "Castagno Scuro 1C3":                   { GrainVertical: 90, GrainHorizontal: 0 },
    "Eucalipto Naturale 1E1":               { GrainVertical: 90, GrainHorizontal: 0 },
    "Eucalipto Affumicato 1E2":             { GrainVertical: 90, GrainHorizontal: 0 },
    "Paulownia Seppia 1F2":                 { GrainVertical: 90, GrainHorizontal: 0 },
    "Noce Rigato Chiaro 1N1":               { GrainVertical: 90, GrainHorizontal: 0 },
    "Noce rigato Canaletto Naturale 1N2":   { GrainVertical: 90, GrainHorizontal: 0 },
    "Noce Rigato Grigio 1N3":               { GrainVertical: 90, GrainHorizontal: 0 },
    "Nodato spaccato Biondo 1NA":           { GrainVertical: 90, GrainHorizontal: 0 },
    "Nodato spaccato Tabacco 1NB":          { GrainVertical: 90, GrainHorizontal: 0 },
    "Noce Tavola Antico Chiaro 1ND":        { GrainVertical: 90, GrainHorizontal: 0 },
    "Noce Tavola Antico Scuro 1NE":         { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Dogato Bianco 1P0":             { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Dogato Grigio 1P1":             { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Dogato Naturale 1P3":           { GrainVertical: 90, GrainHorizontal: 0 },
    "Rigatino Naturale 1RN":                { GrainVertical: 90, GrainHorizontal: 0 },
    "Rigatino Tabacco 1RP":                 { GrainVertical: 90, GrainHorizontal: 0 },
    "Rigatino Beton 1RQ":                   { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Sherwood Chiaro 1S1":           { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Sherwood Scuro 1S2":            { GrainVertical: 90, GrainHorizontal: 0 },
    "Rovere Sherwood Castano 1S3":          { GrainVertical: 90, GrainHorizontal: 0 },
};

export const GRAIN_SUPPORTED_MATERIALS = new Set(Object.keys(GRAIN_ROTATION_MAP));

function normalizeMaterialName(materialName) {
    return String(materialName || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

const GRAIN_ROTATION_LOOKUP = Object.fromEntries(
    Object.entries(GRAIN_ROTATION_MAP).map(([materialName, config]) => [
        normalizeMaterialName(materialName),
        config
    ])
);

/**
 * Get rotation angle for a material + grain direction combination.
 * @param {string} materialName - CabinetColor material name
 * @param {string} grainDirection - "GrainVertical" or "GrainHorizontal"
 * @returns {number|null} - rotation angle in degrees, or null if material not supported
 */
export function getGrainRotationAngle(materialName, grainDirection) {
    const config = GRAIN_ROTATION_MAP[materialName]
        || GRAIN_ROTATION_LOOKUP[normalizeMaterialName(materialName)];

    return config?.[grainDirection] ?? null;
}
