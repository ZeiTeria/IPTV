// ============================================================
//  IPTV Local Tester v6 — Region-Based + GitHub Gist Upload
//  - One playlist.m3u with regions as group folders
//  - Region order: ID → Chinese → SE Asia → East Asia → Middle East/SA → Americas → Europe → Movies/Platforms
//  - Global dedup: first URL seen wins
//  - Tests every stream, saves blacklist.json
//  - Auto-uploads playlist.m3u to GitHub Gist on finish
//
//  Setup:
//    1. cp .env.example .env  →  fill in GITHUB_TOKEN and GIST_ID
//    2. npm install
//    3. node index.js
//
//  Usage:
//    node index.js              → all regions, full stream test
//    node index.js --skip-test  → skip testing, just filter & dedup
//    node index.js --region id  → specific region key only
// ============================================================

import "dotenv/config";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────
const TIMEOUT_MS     = 4000;
const CONCURRENCY    = 20;
const BLACKLIST_FILE = path.join(__dirname, "blacklist.json");
const OUTPUT_FILE    = path.join(__dirname, "playlist.m3u");

// ─────────────────────────────────────────────────────────────────────────────
//  REGIONS
//  Each region has:
//    key     → used with --region flag
//    label   → group-title shown in IPTV player
//    sources → array of M3U URLs to merge & dedup into this region
// ─────────────────────────────────────────────────────────────────────────────
const REGIONS = [

  // ════════════════════════════════════════════════════════
  //  1. 🇮🇩 INDONESIA  (priority #1)
  // ════════════════════════════════════════════════════════
  {
    key: "id",
    label: "🇮🇩 Indonesia",
    sources: [
      "https://iptv-org.github.io/iptv/countries/id.m3u",
      // "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
    ],
  },

  // ════════════════════════════════════════════════════════
  //  2. 🌏 CHINESE REGIONS  (CN + HK + MO + TW + ZHO)
  // ════════════════════════════════════════════════════════
  {
    key: "cn",
    label: "🌏 Chinese Regions",
    sources: [
      "https://iptv-org.github.io/iptv/countries/cn.m3u",
      "https://iptv-org.github.io/iptv/countries/hk.m3u",
      "https://iptv-org.github.io/iptv/countries/mo.m3u",
      "https://iptv-org.github.io/iptv/countries/tw.m3u",
      "https://iptv-org.github.io/iptv/languages/zho.m3u",
    ],
  },

  // ════════════════════════════════════════════════════════
  //  3. 🌏 SOUTHEAST ASIA  (SG + MY + TH + PH + VN + MM + KH + LA + BN)
  // ════════════════════════════════════════════════════════
  {
    key: "sea",
    label: "🌏 Southeast Asia",
    sources: [
      "https://iptv-org.github.io/iptv/countries/sg.m3u",
      "https://iptv-org.github.io/iptv/countries/my.m3u",
      "https://iptv-org.github.io/iptv/countries/th.m3u",
      "https://iptv-org.github.io/iptv/countries/ph.m3u",
      "https://iptv-org.github.io/iptv/countries/vn.m3u",
      "https://iptv-org.github.io/iptv/countries/mm.m3u",
      "https://iptv-org.github.io/iptv/countries/kh.m3u",
      "https://iptv-org.github.io/iptv/countries/la.m3u",
      "https://iptv-org.github.io/iptv/countries/bn.m3u",
    ],
  },

  // ════════════════════════════════════════════════════════
  //  4. 🌏 EAST ASIA  (JP + KR)
  // ════════════════════════════════════════════════════════
  {
    key: "ea",
    label: "🌏 East Asia",
    sources: [
      "https://iptv-org.github.io/iptv/countries/jp.m3u",
      "https://iptv-org.github.io/iptv/countries/kr.m3u",
    ],
  },

  // ════════════════════════════════════════════════════════
  //  5. 🌍 MIDDLE EAST & SOUTH ASIA  (SA + AE + IR + IQ + PK + IN + BD + LB + TR + EG)
  // ════════════════════════════════════════════════════════
  {
    key: "mesa",
    label: "🌍 Middle East & South Asia",
    sources: [
      "https://iptv-org.github.io/iptv/countries/sa.m3u",
      "https://iptv-org.github.io/iptv/countries/ae.m3u",
      "https://iptv-org.github.io/iptv/countries/ir.m3u",
      "https://iptv-org.github.io/iptv/countries/iq.m3u",
      "https://iptv-org.github.io/iptv/countries/pk.m3u",
      "https://iptv-org.github.io/iptv/countries/in.m3u",
      "https://iptv-org.github.io/iptv/countries/bd.m3u",
      "https://iptv-org.github.io/iptv/countries/lb.m3u",
      "https://iptv-org.github.io/iptv/countries/tr.m3u",
      "https://iptv-org.github.io/iptv/countries/eg.m3u",
    ],
  },

  // ════════════════════════════════════════════════════════
  //  6. 🌎 AMERICAS  (US + CA + MX + BR + AR + CO + CL + PE + VE)
  // ════════════════════════════════════════════════════════
  {
    key: "am",
    label: "🌎 Americas",
    sources: [
      "https://iptv-org.github.io/iptv/countries/us.m3u",
      "https://iptv-org.github.io/iptv/countries/ca.m3u",
      "https://iptv-org.github.io/iptv/countries/mx.m3u",
      "https://iptv-org.github.io/iptv/countries/br.m3u",
      "https://iptv-org.github.io/iptv/countries/ar.m3u",
      "https://iptv-org.github.io/iptv/countries/co.m3u",
      "https://iptv-org.github.io/iptv/countries/cl.m3u",
      "https://iptv-org.github.io/iptv/countries/pe.m3u",
      "https://iptv-org.github.io/iptv/countries/ve.m3u",
    ],
  },

  // ════════════════════════════════════════════════════════
  //  7. 🌍 EUROPE  (GB + DE + FR + IT + ES + NL + PL + PT + RU + UA + SE + NO + FI + AU + NZ)
  // ════════════════════════════════════════════════════════
  {
    key: "eu",
    label: "🌍 Europe",
    sources: [
      "https://iptv-org.github.io/iptv/countries/gb.m3u",
      "https://iptv-org.github.io/iptv/countries/de.m3u",
      "https://iptv-org.github.io/iptv/countries/fr.m3u",
      "https://iptv-org.github.io/iptv/countries/it.m3u",
      "https://iptv-org.github.io/iptv/countries/es.m3u",
      "https://iptv-org.github.io/iptv/countries/nl.m3u",
      "https://iptv-org.github.io/iptv/countries/pl.m3u",
      "https://iptv-org.github.io/iptv/countries/pt.m3u",
      "https://iptv-org.github.io/iptv/countries/ru.m3u",
      "https://iptv-org.github.io/iptv/countries/ua.m3u",
      "https://iptv-org.github.io/iptv/countries/se.m3u",
      "https://iptv-org.github.io/iptv/countries/no.m3u",
      "https://iptv-org.github.io/iptv/countries/fi.m3u",
      "https://iptv-org.github.io/iptv/countries/au.m3u",
      "https://iptv-org.github.io/iptv/countries/nz.m3u",
    ],
  },

  // ════════════════════════════════════════════════════════
  //  8. 🎬 MOVIES & PLATFORMS  (last priority)
  // ════════════════════════════════════════════════════════
  {
    key: "movies",
    label: "🎬 Movies & Platforms",
    sources: [
      "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/tubi_all.m3u",
      "https://www.apsattv.com/redbox.m3u",
      "https://iptv-org.github.io/iptv/categories/movies.m3u",
      "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/plex_all.m3u",
      "https://apsattv.com/ssungusa.m3u",
      "https://www.apsattv.com/lg.m3u",
      "https://www.apsattv.com/xumo.m3u",
      "https://www.apsattv.com/rok.m3u",
      "https://www.apsattv.com/xiaomi.m3u",
      "https://www.apsattv.com/vizio.m3u",
      "https://www.apsattv.com/distro.m3u",
    ],
  },
];

// ── Instant-filter patterns ───────────────────────────────
const INSTANT_DEAD = [
  /streamlock\.net/,
];

const INSTANT_BLOCKED = [
  /status="blocked"/i,
  /status="offline"/i,
  /\[geo.?block/i,
  /geo.?block/i,
];

// ── Load / Save blacklist ─────────────────────────────────
function loadBlacklist() {
  try {
    if (fs.existsSync(BLACKLIST_FILE)) {
      const data = JSON.parse(fs.readFileSync(BLACKLIST_FILE, "utf8"));
      return new Set(Array.isArray(data) ? data : []);
    }
  } catch {}
  return new Set();
}

function saveBlacklist(blacklist) {
  fs.writeFileSync(BLACKLIST_FILE, JSON.stringify([...blacklist], null, 2));
}

// ── Test a single stream URL ──────────────────────────────
async function isAlive(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "*/*",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    return ![404, 410].includes(resp.status);
  } catch {
    clearTimeout(timer);
    return false;
  }
}

// ── Run tasks concurrently in batches ─────────────────────
async function runBatch(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    process.stdout.write(
      `\r  Testing... ${Math.min(i + CONCURRENCY, items.length)}/${items.length}`
    );
  }
  console.log();
  return results;
}

// ── Parse M3U text into channel objects ───────────────────
function parseM3U(text) {
  const channels = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("#EXTINF")) {
      const streamUrl = (lines[i + 1] || "").trim();
      if (streamUrl && !streamUrl.startsWith("#")) {
        const lastComma = line.lastIndexOf(",");
        const name = lastComma !== -1 ? line.slice(lastComma + 1).trim() : "";
        channels.push({ extinf: line, url: streamUrl, name });
        i += 2;
        continue;
      }
    }
    i++;
  }
  return channels;
}

// ── Rewrite group-title tag in #EXTINF line ───────────────
function rewriteGroup(extinf, label) {
  if (extinf.includes("group-title=")) {
    return extinf.replace(/group-title="[^"]*"/g, `group-title="${label}"`);
  }
  const lastComma = extinf.lastIndexOf(",");
  if (lastComma !== -1) {
    return (
      extinf.slice(0, lastComma) +
      ` group-title="${label}"` +
      extinf.slice(lastComma)
    );
  }
  return extinf;
}

// ── Fetch & filter one M3U URL ────────────────────────────
async function fetchSource(url, label, blacklist, globalSeen, skipTest) {
  let text;
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) {
      console.log(`    ❌ HTTP ${resp.status} — ${url}`);
      return [];
    }
    text = await resp.text();
  } catch (err) {
    console.log(`    ❌ Fetch error: ${err.message} — ${url}`);
    return [];
  }

  const channels = parseM3U(text);
  const toTest = [];
  let dupes = 0, instantDead = 0, instantBlocked = 0;

  for (const ch of channels) {
    if (globalSeen.has(ch.url)) { dupes++; continue; }
    globalSeen.add(ch.url);
    if (blacklist.has(ch.url)) continue;
    if (INSTANT_DEAD.some((p) => p.test(ch.url))) {
      blacklist.add(ch.url); instantDead++; continue;
    }
    if (INSTANT_BLOCKED.some((p) => p.test(ch.extinf) || p.test(ch.name))) {
      blacklist.add(ch.url); instantBlocked++; continue;
    }
    toTest.push(ch);
  }

  console.log(
    `    📺 ${channels.length} found | 🔁 ${dupes} dupes | 🚫 ${instantDead} dead | ⛔ ${instantBlocked} blocked | 🧪 ${toTest.length} to test`
  );

  if (!skipTest && toTest.length > 0) {
    const results = await runBatch(toTest, async (ch) => {
      const ok = await isAlive(ch.url);
      if (!ok) blacklist.add(ch.url);
      return ok ? ch : null;
    });
    const alive = results.filter(Boolean);
    console.log(`    ✅ ${alive.length} alive | ❌ ${toTest.length - alive.length} dead`);
    return alive;
  }

  return toTest;
}

// ── Process one region ────────────────────────────────────
async function processRegion(region, blacklist, globalSeen, skipTest) {
  console.log(`\n${"═".repeat(55)}`);
  console.log(`  ${region.label}`);
  console.log(`${"═".repeat(55)}`);

  const allAlive = [];
  for (const url of region.sources) {
    console.log(`  → ${url}`);
    const alive = await fetchSource(url, region.label, blacklist, globalSeen, skipTest);
    allAlive.push(...alive);
  }

  console.log(`  📊 Region total: ${allAlive.length} channels`);
  return allAlive;
}

// ── Upload playlist to GitHub Gist ───────────────────────
async function uploadToGist(content) {
  const token  = process.env.GITHUB_TOKEN;
  const gistId = process.env.GIST_ID;

  if (!token || !gistId) {
    console.log("⚠️  GITHUB_TOKEN or GIST_ID not set in .env — skipping Gist upload");
    return;
  }

  console.log("☁️  Uploading to GitHub Gist...");
  try {
    const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "iptv-generator",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        files: { "playlist.m3u": { content } },
      }),
    });

    const data = await resp.json();
    if (resp.ok) {
      const rawUrl = data.files["playlist.m3u"]?.raw_url;
      console.log(`✅ Gist updated: ${data.html_url}`);
      console.log(`📋 Raw URL (use in IPTV player): ${rawUrl}`);
    } else {
      console.log(`❌ Gist upload failed: ${data.message}`);
    }
  } catch (err) {
    console.log(`❌ Gist upload error: ${err.message}`);
  }
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const regionArg = args.includes("--region")
    ? args[args.indexOf("--region") + 1]
    : "all";
  const skipTest = args.includes("--skip-test");

  const regions =
    regionArg === "all"
      ? REGIONS
      : REGIONS.filter((r) => r.key === regionArg);

  if (regions.length === 0) {
    console.error(`❌ Unknown region: ${regionArg}`);
    console.error(`Available: ${REGIONS.map((r) => r.key).join(", ")}`);
    process.exit(1);
  }

  const blacklist = loadBlacklist();
  console.log(`\n🚀 IPTV Generator v5 — Region-Based`);
  console.log(`📋 Blacklist: ${blacklist.size} entries`);
  console.log(
    `🔧 Mode: ${
      skipTest
        ? "Filter only (no stream testing)"
        : `Full test (${CONCURRENCY} concurrent, ${TIMEOUT_MS}ms timeout)`
    }`
  );
  console.log(`🗺️  Regions: ${regions.map((r) => r.label).join(" | ")}\n`);

  const globalSeen = new Set();
  let merged = "#EXTM3U\n\n";
  let totalAlive = 0;

  for (const region of regions) {
    const alive = await processRegion(region, blacklist, globalSeen, skipTest);
    totalAlive += alive.length;

    if (alive.length > 0) {
      merged += `\n# ═══ ${region.label} — ${alive.length} channels ═══\n`;
      for (const ch of alive) {
        merged += rewriteGroup(ch.extinf, region.label) + "\n" + ch.url + "\n";
      }
    }
  }

  saveBlacklist(blacklist);
  merged += `\n# ✅ Total: ${totalAlive} channels | blacklist: ${blacklist.size} entries\n`;
  fs.writeFileSync(OUTPUT_FILE, merged);

  console.log(`\n${"═".repeat(55)}`);
  console.log(`💾 Blacklist: ${blacklist.size} entries → blacklist.json`);
  console.log(`✅ Playlist:  ${totalAlive} channels → playlist.m3u`);

  await uploadToGist(merged);

  console.log(`🎉 Done!\n`);
}

main().catch(console.error);