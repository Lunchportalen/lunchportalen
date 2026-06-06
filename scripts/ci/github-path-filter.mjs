#!/usr/bin/env node
/**
 * Minimal GitHub Actions path-filter matching (fnmatch-style, no deps).
 * @see https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#patterns-to-match-file-paths
 */

/**
 * @param {string} pattern
 * @returns {RegExp}
 */
export function githubPathPatternToRegExp(pattern) {
  const pat = String(pattern).replace(/\\/g, "/");
  let re = "^";
  for (let i = 0; i < pat.length; i += 1) {
    const ch = pat[i];
    const next = pat[i + 1];

    if (ch === "*" && next === "*") {
      const after = pat[i + 2];
      if (after === "/") {
        re += "(?:.*/)?";
        i += 2;
      } else {
        re += ".*";
        i += 1;
      }
      continue;
    }

    if (ch === "*") {
      re += "[^/]*";
      continue;
    }

    if (ch === "?") {
      re += "[^/]";
      continue;
    }

    if ("\\.+^${}()|[]".includes(ch)) {
      re += `\\${ch}`;
      continue;
    }

    re += ch;
  }

  re += "$";
  return new RegExp(re);
}

/**
 * @param {string} filePath
 * @param {string} pattern
 * @returns {boolean}
 */
export function pathMatchesGitHubFilter(filePath, pattern) {
  const path = String(filePath).replace(/\\/g, "/").replace(/^\.\//, "");
  return githubPathPatternToRegExp(pattern).test(path);
}

/**
 * @param {string} filePath
 * @param {string[]} patterns
 * @returns {boolean}
 */
export function pathMatchesAnyGitHubFilter(filePath, patterns) {
  const list = Array.isArray(patterns) ? patterns : [];
  return list.some((pattern) => pathMatchesGitHubFilter(filePath, pattern));
}
