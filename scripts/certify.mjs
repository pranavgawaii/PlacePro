#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHECK_DIRS = ["app", "components", "lib"];
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".sql"]);
const SKIP_PARTS = new Set(["node_modules", ".next", ".git", "dist", "build"]);

const violations = [];

function listFiles(dir) {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) {
    return [];
  }

  const result = [];
  const stack = [absolute];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relative = path.relative(ROOT, fullPath);
      const parts = relative.split(path.sep);

      if (parts.some((part) => SKIP_PARTS.has(part))) {
        continue;
      }

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
        result.push(relative);
      }
    }
  }

  return result;
}

function addViolation(file, message) {
  violations.push({ file, message });
}

function checkGeneralPatterns(file, content) {
  if (content.includes("dangerouslySetInnerHTML")) {
    addViolation(file, "dangerouslySetInnerHTML is disallowed");
  }

  if (/\beval\s*\(/.test(content)) {
    addViolation(file, "eval(...) is disallowed");
  }

  if (/new\s+Function\s*\(/.test(content)) {
    addViolation(file, "new Function(...) is disallowed");
  }
}

function checkClientBoundary(file, content) {
  const isClientComponent = /^\s*["']use client["'];/m.test(content);
  if (!isClientComponent) {
    return;
  }

  if (content.includes("createAdminClient")) {
    addViolation(file, "Client component imports or uses createAdminClient");
  }

  if (content.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    addViolation(file, "Client component references SUPABASE_SERVICE_ROLE_KEY");
  }
}

function checkApiDataQueries(file, content) {
  if (!file.startsWith("app/api/") && !file.startsWith("lib/")) {
    return;
  }

  if (/\.select\(\s*["']\*["']\s*\)/.test(content)) {
    addViolation(file, "API/lib query uses select('*')");
  }
}

function runChecks() {
  const files = CHECK_DIRS.flatMap((dir) => listFiles(dir));

  for (const file of files) {
    const absolute = path.join(ROOT, file);
    const content = fs.readFileSync(absolute, "utf8");

    checkGeneralPatterns(file, content);
    checkClientBoundary(file, content);
    checkApiDataQueries(file, content);
  }
}

runChecks();

if (violations.length > 0) {
  console.error("Certification checks failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.message}`);
  }
  process.exit(1);
}

console.log("Certification checks passed.");
