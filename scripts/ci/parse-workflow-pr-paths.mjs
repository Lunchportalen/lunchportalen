#!/usr/bin/env node
/**
 * Parse on.pull_request.paths from a GitHub Actions workflow YAML (zero deps).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * @param {string[]} lines
 * @param {number} startIndex
 * @param {number} listIndent
 * @returns {string[]}
 */
function readListItems(lines, startIndex, listIndent) {
  /** @type {string[]} */
  const items = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent < listIndent) {
      break;
    }

    const item = line.match(/^\s+-\s+"?([^"#]+?)"?\s*(?:#.*)?$/)?.[1];
    if (item && indent >= listIndent) {
      items.push(item.trim());
      continue;
    }

    if (indent <= listIndent) {
      break;
    }
  }
  return items;
}

/**
 * @param {string} content
 * @returns {Map<string, string[]>}
 */
export function parseYamlPathAnchors(content) {
  const lines = content.split(/\r?\n/);
  /** @type {Map<string, string[]>} */
  const anchors = new Map();

  for (let i = 0; i < lines.length; i += 1) {
    const anchorDef = lines[i].match(/^(\s*)paths:\s*&([A-Za-z0-9_]+)\s*$/);
    if (!anchorDef) {
      continue;
    }
    const listIndent = anchorDef[1].length + 2;
    const items = readListItems(lines, i + 1, listIndent);
    anchors.set(anchorDef[2], items);
  }

  return anchors;
}

/**
 * @param {string} content
 * @returns {string[]}
 */
export function parseWorkflowPullRequestPaths(content) {
  const lines = content.split(/\r?\n/);
  const anchors = parseYamlPathAnchors(content);

  let inOn = false;
  let onIndent = 0;
  let inPullRequest = false;
  let prIndent = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;

    if (!inOn && /^\s*on:\s*$/.test(line)) {
      inOn = true;
      onIndent = indent;
      continue;
    }

    if (inOn && indent <= onIndent && !/^\s*on:\s*$/.test(line)) {
      inOn = false;
      inPullRequest = false;
    }

    if (inOn && /^\s*pull_request:\s*$/.test(line)) {
      inPullRequest = true;
      prIndent = indent;
      continue;
    }

    if (inPullRequest && indent <= prIndent && !/^\s*pull_request:\s*$/.test(line)) {
      inPullRequest = false;
    }

    if (!inPullRequest) {
      continue;
    }

    const alias = line.match(/^\s+paths:\s*\*([A-Za-z0-9_]+)\s*$/);
    if (alias) {
      const resolved = anchors.get(alias[1]);
      if (!resolved?.length) {
        throw new Error(`Unresolved YAML anchor *${alias[1]} in pull_request.paths`);
      }
      return [...resolved];
    }

    const inlineAnchor = line.match(/^(\s+)paths:\s*&([A-Za-z0-9_]+)\s*$/);
    if (inlineAnchor) {
      const listIndent = inlineAnchor[1].length + 2;
      const items = readListItems(lines, i + 1, listIndent);
      if (!items.length) {
        throw new Error(`Empty inline anchor paths list &${inlineAnchor[2]}`);
      }
      return items;
    }

    const plain = line.match(/^(\s+)paths:\s*$/);
    if (plain) {
      const listIndent = plain[1].length + 2;
      const items = readListItems(lines, i + 1, listIndent);
      if (!items.length) {
        throw new Error("Empty pull_request.paths list");
      }
      return items;
    }
  }

  throw new Error("No on.pull_request.paths found in workflow");
}

/**
 * @param {string} workflowPath
 * @param {{ cwd?: string }} [options]
 * @returns {string[]}
 */
export function loadWorkflowPullRequestPaths(workflowPath, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const absolute = resolve(cwd, workflowPath);
  const content = readFileSync(absolute, "utf8");
  return parseWorkflowPullRequestPaths(content);
}
