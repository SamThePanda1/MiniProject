export function isIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

/**
 * Updates a value in a JSON object at a specific path
 * @param obj - The JSON object to update
 * @param path - The path array (e.g., ["fruits", 0, "name"])
 * @param newValue - The new value to set
 * @returns A new object with the updated value
 */
export function updateJsonAtPath(obj: any, path: (string | number)[], newValue: any): any {
  if (path.length === 0) {
    return newValue;
  }

  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  const [first, ...rest] = path;

  if (rest.length === 0) {
    newObj[first] = newValue;
  } else {
    newObj[first] = updateJsonAtPath(newObj[first] ?? (typeof rest[0] === "number" ? [] : {}), rest, newValue);
  }

  return newObj;
}