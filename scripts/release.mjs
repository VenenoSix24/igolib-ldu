#!/usr/bin/env node
// 版本号单点维护：package.json 为唯一来源，同步到 tauri.conf.json / Cargo.toml / Cargo.lock
// 用法：
//   node scripts/release.mjs 1.0.29   # 设置新版本并同步四处文件
//   node scripts/release.mjs --check   # 只校验一致性（CI 用），不一致时退出码 1

import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const files = {
  package: `${ROOT}package.json`,
  tauriConf: `${ROOT}src-tauri/tauri.conf.json`,
  cargoToml: `${ROOT}src-tauri/Cargo.toml`,
  cargoLock: `${ROOT}src-tauri/Cargo.lock`,
};

const readVersion = {
  package() {
    return JSON.parse(readFileSync(files.package, "utf8")).version;
  },
  tauriConf() {
    return JSON.parse(readFileSync(files.tauriConf, "utf8")).version;
  },
  cargoToml() {
    return readFileSync(files.cargoToml, "utf8").match(/^version = "(.+)"$/m)?.[1];
  },
  // Cargo.lock 中 igolib-ldu 包自己的版本（跳过依赖里同名段）
  cargoLock() {
    const content = readFileSync(files.cargoLock, "utf8");
    return content.match(/name = "igolib-ldu"\nversion = "(.+?)"/)?.[1];
  },
};

const [arg] = process.argv.slice(2);

if (arg === "--check") {
  const versions = Object.fromEntries(
    Object.entries(readVersion).map(([k, fn]) => [k, fn()]),
  );
  const unique = new Set(Object.values(versions));
  if (unique.size !== 1) {
    console.error("版本号不一致：", versions);
    process.exit(1);
  }
  console.log(`版本一致：${versions.package}`);
  process.exit(0);
}

if (!arg || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(arg)) {
  console.error("用法：node scripts/release.mjs <x.y.z> | --check");
  process.exit(1);
}

const next = arg;
const prev = readVersion.package();
if (prev === next) {
  console.log(`版本已是 ${next}，无需变更`);
  process.exit(0);
}

// package.json
const pkg = JSON.parse(readFileSync(files.package, "utf8"));
pkg.version = next;
writeFileSync(files.package, `${JSON.stringify(pkg, null, 2)}\n`);

// tauri.conf.json
const conf = JSON.parse(readFileSync(files.tauriConf, "utf8"));
conf.version = next;
writeFileSync(files.tauriConf, `${JSON.stringify(conf, null, 2)}\n`);

// Cargo.toml（只改 [package] 段的 version，即文件首个）
let toml = readFileSync(files.cargoToml, "utf8");
toml = toml.replace(/(^version = ").+(")$/m, `$1${next}$2`);
writeFileSync(files.cargoToml, toml);

// Cargo.lock（igolib-ldu 自身条目）
let lock = readFileSync(files.cargoLock, "utf8");
lock = lock.replace(/(name = "igolib-ldu"\nversion = ").+?(")/, `$1${next}$2`);
writeFileSync(files.cargoLock, lock);

console.log(`${prev} -> ${next}，已同步 package.json / tauri.conf.json / Cargo.toml / Cargo.lock`);
console.log("后续：提交变更并打 v 标签触发 release（标签需人工确认后再推）");
