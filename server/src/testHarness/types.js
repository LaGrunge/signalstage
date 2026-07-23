// v1's deliberately restricted parameter/return type system - see
// CLAUDE.md's "Interview problems and automated tests" section for why:
// flat primitives and single-level arrays only, no nested objects/structs.
export const SCALAR_TYPES = ["int", "double", "bool", "string"];
export const ARRAY_TYPES = ["int[]", "double[]", "string[]"];
export const ALL_TYPES = [...SCALAR_TYPES, ...ARRAY_TYPES];

export function isArrayType(type) {
  return type.endsWith("[]");
}

export function elementType(type) {
  return isArrayType(type) ? type.slice(0, -2) : null;
}

export function isValidType(type) {
  return ALL_TYPES.includes(type);
}
