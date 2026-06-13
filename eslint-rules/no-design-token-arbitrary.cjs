/**
 * Blocks arbitrary Tailwind design-token escapes in class strings.
 * Week/employee paths: error. Rest of repo: warn (deferred hygiene track).
 */

const FORBIDDEN_PATTERNS = [
  {
    id: "rounded-arbitrary",
    re: /rounded-\[(?!inherit\b)/,
    message: "Use rounded-sm|md|lg|card|pill instead of rounded-[…].",
  },
  {
    id: "shadow-arbitrary",
    re: /shadow-\[/,
    message: "Use shadow-soft|card|accent|secondary instead of shadow-[…].",
  },
  {
    id: "hex-arbitrary",
    re: /(?:^|\s)(?:bg|text|ring|border|from|to|via|fill|stroke)-\[#/,
    message: "Use ds color tokens (bg-accent, text-text, ring-accent/50, …) instead of hex brackets.",
  },
  {
    id: "touch-44",
    re: /min-h-\[44px\]/,
    message: "Use min-h-touch (48px). Never downgrade touch targets.",
  },
  {
    id: "spacing-arbitrary",
    re: /(?:^|\s)(?:min-h|min-w|max-w|max-h|w|h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)-\[(?!var\(--)/,
    message: "Use named spacing tokens (min-h-touch, max-w-week-mobile, …) instead of arbitrary spacing.",
  },
];

const ALLOWED_TEXT_SIZE = /text-\[(?:10|11)px\]/g;

function inspectClassString(value, context, node) {
  if (typeof value !== "string" || !value.includes("[")) return;

  for (const { re, message } of FORBIDDEN_PATTERNS) {
    if (re.test(value)) {
      context.report({ node, message: `Design token violation: ${message}` });
      return;
    }
  }
}

function inspectStyleObject(node, context) {
  if (node.type !== "ObjectExpression") return;

  for (const prop of node.properties) {
    if (prop.type !== "Property" || prop.key.type !== "Identifier") continue;
    const key = prop.key.name;
    if (key === "gridColumnStart" || key === "gridRowStart" || key === "width" || key === "height") {
      continue;
    }
    if (key === "backgroundColor" || key === "color" || key === "borderColor") {
      const val = prop.value;
      if (
        val.type === "Literal" &&
        typeof val.value === "string" &&
        /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(val.value)
      ) {
        context.report({
          node: prop,
          message: "Design token violation: static hex in style={{}} — use Tailwind ds classes.",
        });
      }
    }
  }
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow arbitrary Tailwind design values outside approved token classes",
    },
    schema: [],
    messages: {},
  },
  create(context) {
    function check(node, raw) {
      if (typeof raw !== "string") return;
      const stripped = raw.replace(ALLOWED_TEXT_SIZE, "");
      inspectClassString(stripped, context, node);
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
      JSXAttribute(node) {
        if (node.name.name !== "style" || !node.value) return;
        if (node.value.type === "JSXExpressionContainer") {
          inspectStyleObject(node.value.expression, context);
        }
      },
    };
  },
};
