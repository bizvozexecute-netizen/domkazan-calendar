import {globSync as findDirectories} from 'tinyglobby';
import {isAbsolute,parse} from 'node:path';

// Only @next/eslint-plugin-next@16.4.0 uses this adapter, through get-root-dirs.
// It is intentionally not a general implementation of the fast-glob API.
export function globSync(pattern, options) {
  if (typeof pattern !== 'string' || options?.onlyDirectories !== true ||
      Object.keys(options).some(key => key !== 'onlyDirectories')) {
    throw new TypeError('Unsupported Next ESLint glob contract; review the scoped override.');
  }
  if (pattern.length > 4096) throw new RangeError('Next ESLint root pattern is too long.');
  let depth = 0;
  for (let index = 0; index < pattern.length; index++) {
    if (pattern[index] === '\\') { index++; continue; }
    if (pattern[index] === '{' && ++depth > 64) throw new RangeError('Next ESLint root pattern is too deeply nested.');
    if (pattern[index] === '}') depth = Math.max(0, depth - 1);
  }
  // fast-glob matches a literal directory itself. tinyglobby otherwise expands
  // it recursively by default, which would change Next's rootDir semantics.
  return findDirectories(pattern, { onlyDirectories: true, expandDirectories: false, absolute: isAbsolute(pattern) })
    .map(directory => directory.endsWith('/') && directory.length > parse(directory).root.length ? directory.slice(0,-1) : directory);
}
