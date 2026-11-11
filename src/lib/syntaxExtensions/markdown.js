// An emphasis run counts only where it opens (nothing word-like before,
// non-space after) or closes (non-space before, nothing word-like after), so
// "* bullet", "2 * 3" and "2*3" stay text. "C++" is a known false closer.
export const emphasis = (marker, char) =>
  String.raw`(?<![\p{L}\p{N}${char}])${marker}(?=[^\s${char}])|(?<=[^\s${char}])${marker}(?![\p{L}\p{N}${char}])`;
