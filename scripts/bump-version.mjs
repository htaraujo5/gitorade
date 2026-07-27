#!/usr/bin/env node
/**
 * Bump app version across package.json, Cargo.toml, tauri.conf.json.
 *
 * Usage:
 *   node scripts/bump-version.mjs fix      # 1.0.0 → 1.0.1 (patch)
 *   node scripts/bump-version.mjs hotfix   # 1.0.1 → 1.1.0 (minor)
 *   node scripts/bump-version.mjs release  # 1.1.0 → 2.0.0 (major)
 *
 *   node scripts/bump-version.mjs detect   # print bump from git log since last tag
 *   node scripts/bump-version.mjs print    # print current version
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(root, "package.json");
const cargoPath = join(root, "src-tauri", "Cargo.toml");
const tauriPath = join(root, "src-tauri", "tauri.conf.json");

const BUMP = {
  fix: "patch",
  patch: "patch",
  hotfix: "minor",
  minor: "minor",
  feat: "minor",
  release: "major",
  major: "major",
};

function readVersion() {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return pkg.version;
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  if (!m) throw new Error(`Invalid semver: ${v}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function format({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(current, kind) {
  const level = BUMP[kind];
  if (!level) {
    throw new Error(`Unknown bump "${kind}". Use: fix | hotfix | release (or patch|minor|major)`);
  }
  const v = parseSemver(current);
  if (level === "major") return format({ major: v.major + 1, minor: 0, patch: 0 });
  if (level === "minor") return format({ major: v.major, minor: v.minor + 1, patch: 0 });
  return format({ major: v.major, minor: v.minor, patch: v.patch + 1 });
}

function writeVersions(next) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.version = next;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  let cargo = readFileSync(cargoPath, "utf8");
  cargo = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${next}"`);
  writeFileSync(cargoPath, cargo);

  const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
  tauri.version = next;
  writeFileSync(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`);
}

/**
 * Highest bump wins among commits since last tag (or last 30 commits).
 * release > hotfix > fix
 */
function detectBumpFromGit() {
  let range = "HEAD";
  try {
    const lastTag = execSync("git describe --tags --abbrev=0", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (lastTag) range = `${lastTag}..HEAD`;
  } catch {
    range = "HEAD~30..HEAD";
  }

  let log = "";
  try {
    log = execSync(`git log ${range} --pretty=%s`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    log = execSync("git log -30 --pretty=%s", {
      cwd: root,
      encoding: "utf8",
    });
  }

  const lines = log
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  let found = null; // patch | minor | major
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      /^(release)(\(.+\))?\s*:/.test(lower) ||
      /^major(\(.+\))?\s*:/.test(lower) ||
      /breaking change/i.test(line) ||
      /^[a-z]+(\(.+\))?!:/.test(line)
    ) {
      found = "major";
      break;
    }
    if (/^(hotfix|feat|minor)(\(.+\))?\s*:/.test(lower) && found !== "major") {
      found = "minor";
    }
    if (/^(fix|patch)(\(.+\))?\s*:/.test(lower) && found !== "major" && found !== "minor") {
      found = "patch";
    }
  }

  if (!found) return null;
  if (found === "major") return "release";
  if (found === "minor") return "hotfix";
  return "fix";
}

const cmd = (process.argv[2] || "").toLowerCase();

if (cmd === "print") {
  process.stdout.write(readVersion());
  process.exit(0);
}

if (cmd === "detect") {
  const kind = detectBumpFromGit();
  if (!kind) {
    process.stdout.write("none");
    process.exit(0);
  }
  process.stdout.write(kind);
  process.exit(0);
}

if (!cmd) {
  console.error("Usage: node scripts/bump-version.mjs <fix|hotfix|release|detect|print>");
  process.exit(1);
}

const current = readVersion();
const next = bumpVersion(current, cmd);
writeVersions(next);
console.log(`${current} → ${next} (${cmd})`);
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `version=${next}\n`, { flag: "a" });
}
