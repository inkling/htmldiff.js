/**
 * Compares two pieces of HTML content and returns the combined content with differences
 * wrapped in <ins> and <del> tags.
 *
 * @param {string} before The HTML content before the changes.
 * @param {string} after The HTML content after the changes.
 * @param {string} className (Optional) The class attribute to include in <ins> and <del> tags.
 * @param {string} dataPrefix (Optional) The data prefix to use for data attributes. The
 *     operation index data attribute will be named `data-${dataPrefix-}operation-index`.
 *
 * @return {string} The combined HTML content with differences wrapped in <ins> and <del> tags.
 */
declare function diff(before: string, after: string, className?: string, dataPrefix?: string): string;
export = diff;
