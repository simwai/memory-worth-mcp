#!/usr/bin/env node
/**
 * Release script for memory-worth-mcp
 * Usage: node scripts/release.js [patch|minor|major] [--dry-run]
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const args = process.argv.slice(2);
const type = args[0] || "patch";
const dryRun = args.includes("--dry-run");

const validTypes = ["patch", "minor", "major"];
if (!validTypes.includes(type)) {
  console.error(`❌ Invalid version type: ${type}. Use: patch, minor, or major`);
  process.exit(1);
}

const pkgPath = resolve("package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const currentVersion = pkg.version;

function run(cmd, { silent = false } = {}) {
  if (dryRun) {
    console.log(`🔍 [DRY RUN] ${cmd}`);
    return "";
  }
  try {
    const output = execSync(cmd, { encoding: "utf-8", stdio: silent ? "pipe" : "inherit" });
    return output.trim();
  } catch (e) {
    console.error(`❌ Command failed: ${cmd}`);
    console.error(e.message);
    process.exit(1);
  }
}

function getNextVersion(version, type) {
  const [major, minor, patch] = version.split(".").map(Number);
  switch (type) {
    case "major": return `${major + 1}.0.0`;
    case "minor": return `${major}.${minor + 1}.0`;
    case "patch": return `${major}.${minor}.${patch + 1}`;
  }
}

const nextVersion = getNextVersion(currentVersion, type);

console.log(`🚀 Releasing ${type}: ${currentVersion} → ${nextVersion}`);
if (dryRun) console.log("🔍 DRY RUN MODE - no changes will be made\n");

// 1. Run tests
console.log("\n📋 Step 1: Running tests...");
run("npm test");

// 2. Build
console.log("\n📋 Step 2: Building...");
run("npm run build");

// 3. Verify dist exists
console.log("\n📋 Step 3: Verifying build output...");
run("ls -la dist/");

// 4. Bump version (npm version handles git commit + tag)
console.log(`\n📋 Step 4: Bumping version to ${nextVersion}...`);
run(`npm version ${type} -m "chore: release v%s"`);

// 5. Publish
console.log("\n📋 Step 5: Publishing to npm...");
run("npm publish --access public");

// 6. Push git tags
console.log("\n📋 Step 6: Pushing git tags...");
run("git push origin main --tags");

console.log(`\n✅ Release v${nextVersion} complete!`);
console.log(`   Published: memory-worth-mcp@${nextVersion}`);
console.log(`   Tag: v${nextVersion} pushed to origin`);