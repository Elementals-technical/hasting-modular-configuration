import { throwSpatialInvalidInput } from './errors.mjs';

export const pathOf = (base, key) => {
  if (!base) {
    return String(key);
  }
  if (typeof key === 'number') {
    return `${base}[${key}]`;
  }
  return `${base}.${key}`;
};

export const isPlainRecord = value => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isArrayIndexKey = key => {
  if (typeof key !== 'string' || key === '') {
    return false;
  }
  const numeric = Number(key);
  return Number.isInteger(numeric) && numeric >= 0 && numeric < 2 ** 32 - 1 && String(numeric) === key;
};

const assertDataDescriptors = (value, path, allowArrayLength = false) => {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key === 'symbol') {
      throwSpatialInvalidInput(path || 'value');
    }
    if (allowArrayLength && key === 'length') {
      continue;
    }
    if (Array.isArray(value) && !isArrayIndexKey(key)) {
      throwSpatialInvalidInput(pathOf(path, key));
    }
    const descriptor = descriptors[key];
    if (!('value' in descriptor)) {
      throwSpatialInvalidInput(pathOf(path, key));
    }
  }
};

export const assertPlainData = (value, path = 'value', stack = new WeakSet()) => {
  if (value === null) {
    return;
  }

  const type = typeof value;
  if (type === 'number') {
    if (!Number.isFinite(value)) {
      throwSpatialInvalidInput(path);
    }
    return;
  }
  if (type === 'string' || type === 'boolean') {
    return;
  }
  if (type === 'undefined' || type === 'function' || type === 'symbol' || type === 'bigint') {
    throwSpatialInvalidInput(path);
  }

  if (stack.has(value)) {
    throwSpatialInvalidInput(path);
  }
  stack.add(value);

  if (Array.isArray(value)) {
    assertDataDescriptors(value, path, true);
    for (let index = 0; index < value.length; index += 1) {
      assertPlainData(value[index], pathOf(path, index), stack);
    }
    stack.delete(value);
    return;
  }

  if (!isPlainRecord(value)) {
    throwSpatialInvalidInput(path);
  }

  assertDataDescriptors(value, path);
  for (const key of Object.keys(value)) {
    assertPlainData(value[key], pathOf(path, key), stack);
  }
  stack.delete(value);
};

export const assertPlainRecord = (value, path) => {
  if (!isPlainRecord(value)) {
    throwSpatialInvalidInput(path);
  }
};

export const assertExactKeys = (value, allowedKeys, path) => {
  assertPlainRecord(value, path);
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(value).filter(key => !allowed.has(key)).sort();
  if (unknown.length > 0) {
    throwSpatialInvalidInput(unknown.map(key => pathOf(path, key)));
  }
};

export const deepFreeze = value => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return value;
};
