/**
 * Compares two pieces of HTML content and returns the combined content with differences
 * wrapped in <ins> and <del> tags.
 *
 * @param {string} before The HTML content before the changes.
 * @param {string} after The HTML content after the changes.
 * @param {string} className (Optional) The class attribute to include in <ins> and <del> tags.
 * @param {string} dataPrefix (Optional) The data prefix to use for data attributes. The
 *     operation index data attribute will be named `data-${dataPrefix-}operation-index`.
 * @param {string} atomicTags (Optional) List of tag names. The list has to be in the form 
 *     'tag1|tag2|tag3|...' e. g. 'head|script|style|...'. An atomic tag is one whose child 
 *     nodes should not be compared - the entire tag should be treated as one token. This is 
 *     useful for tags where it does not make sense to insert <ins> and <del> tags.
 *     If not used, the default list 'iframe|object|math|svg|script|head|style' will be used.
 *
 * @return {string} The combined HTML content with differences wrapped in <ins> and <del> tags.
 */
declare function diff(before: string, after: string, className?: string | null, dataPrefix?: string | null, atomicTags?: string | null): string;
export = diff;
