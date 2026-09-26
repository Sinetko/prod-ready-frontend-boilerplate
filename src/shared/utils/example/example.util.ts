/** Normalize whitespace in a display label without changing its case. */
export const example = (value: string): string => {
  return value.trim().replace(/\s+/g, ' ');
};
