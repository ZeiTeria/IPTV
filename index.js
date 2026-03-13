// ============================================================
//  IPTV Local Tester v3
//  - Merges iptv-org + Free-TV per country
//  - Legal platforms: Pluto, Samsung, LG, XUMO, etc
//  - Tests every stream (no limits!)
//  - Saves blacklist to blacklist.json
//  - Outputs clean playlist.m3u
//
//  Usage:
//    node index.js              → all sources
//    node index.js --source id  → specific source key
//    node index.js --skip-test  → skip testing, just filter
// ============================================================

import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────
const TIMEOUT_MS = 4000;
const CONCURRENCY = 20;
const BLACKLIST_FILE = path.join(__dirname, "blacklist.json");
const OUTPUT_FILE = path.join(__dirname, "playlist.m3u");

// Sources with same label = merged into one folder
const SOURCES = [
  // ── Countries (iptv-org + Free-TV merged) ───────────────
  { key: "id",  label: "🇮🇩 Indonesia",              group: "Countries", url: "https://iptv-org.github.io/iptv/countries/id.m3u" },
  { key: "cn",  label: "🇨🇳 China",                  group: "Countries", url: "https://iptv-org.github.io/iptv/countries/cn.m3u" },
  { key: "tw",  label: "🇹🇼 Taiwan",                 group: "Countries", url: "https://iptv-org.github.io/iptv/countries/tw.m3u" },
  { key: "hk",  label: "🇭🇰 Hong Kong",              group: "Countries", url: "https://iptv-org.github.io/iptv/countries/hk.m3u" },
  { key: "sg",  label: "🇸🇬 Singapore",              group: "Countries", url: "https://iptv-org.github.io/iptv/countries/sg.m3u" },
  { key: "my",  label: "🇲🇾 Malaysia",               group: "Countries", url: "https://iptv-org.github.io/iptv/countries/my.m3u" },
  { key: "mo",  label: "🇲🇴 Macau",                  group: "Countries", url: "https://iptv-org.github.io/iptv/countries/mo.m3u" },
  { key: "jp",  label: "🇯🇵 Japan",                   group: "Countries", url: "https://iptv-org.github.io/iptv/countries/jp.m3u" },
  { key: "kr",  label: "🇰🇷 Korea",                   group: "Countries", url: "https://iptv-org.github.io/iptv/countries/kr.m3u" },
  { key: "au",  label: "🇦🇺 Australia",              group: "Countries", url: "https://iptv-org.github.io/iptv/countries/au.m3u" },
  { key: "us",  label: "🇺🇸 USA",                     group: "Countries", url: "https://iptv-org.github.io/iptv/countries/us.m3u" },
  { key: "zho", label: "🌏 Chinese (All Regions)",    group: "Countries", url: "https://iptv-org.github.io/iptv/languages/zho.m3u" },

  // ── Legal Platforms ─────────────────────────────────────
  { key: "plex",    label: "📺 Plex TV",              group: "Platforms", url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/plex_all.m3u" },
  { key: "samsung", label: "📺 Samsung TV Plus",      group: "Platforms", url: "https://apsattv.com/ssungusa.m3u" },
  { key: "lg",      label: "📺 LG Channels",          group: "Platforms", url: "https://www.apsattv.com/lg.m3u" },
  { key: "xumo",    label: "📺 XUMO",                 group: "Platforms", url: "https://www.apsattv.com/xumo.m3u" },
  { key: "roku",    label: "📺 Roku Channel",         group: "Platforms", url: "https://www.apsattv.com/rok.m3u" },
  { key: "xiaomi",  label: "📺 Xiaomi TV+",           group: "Platforms", url: "https://www.apsattv.com/xiaomi.m3u" },
  { key: "vizio",   label: "📺 Vizio TV",             group: "Platforms", url: "https://www.apsattv.com/vizio.m3u" },
  { key: "distro",  label: "📺 DistroTV",             group: "Platforms", url: "https://www.apsattv.com/distro.m3u" },
  { key: "freetv",  label: "📺 Free-TV",              group: "Platforms", url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8" },

  // ── Movies ──────────────────────────────────────────────
  { key: "tubi",    label: "🎬 Tubi TV",              group: "Movies",    url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/tubi_all.m3u" },
  { key: "redbox",  label: "🎬 Redbox",               group: "Movies",    url: "https://www.apsattv.com/redbox.m3u" },
  { key: "movies",  label: "🎬 Public Movies",        group: "Movies",    url: "https://iptv-org.github.io/iptv/categories/movies.m3u" },
];

// Instant filter patterns
const INSTANT_DEAD = [
  /streamlock\.net/,
];

const INSTANT_BLOCKED = [
  /status="blocked"/i,
  /status="offline"/i,
  /\[geo.?block/i,
  /geo.?block/i,
];

// ── Load/Save blacklist ───────────────────────────────────
function loadBlacklist() {
  try {
    if (fs.existsSync(BLACKLIST_FILE)) {
      const data = JSON.parse(fs.readFileSync(BLACKLIST_FILE, "utf8"));
      return new Set(Array.isArray(data) ? data : []);
    }
  } catch {
    // blacklist.json missing or corrupted, start fresh
  }
  return new Set();
}

function saveBlacklist(blacklist) {
  fs.writeFileSync(BLACKLIST_FILE, JSON.stringify([...blacklist], null, 2));
}

// ── Test stream ───────────────────────────────────────────
async function isAlive(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
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

// ── Run concurrently in batches ───────────────────────────
async function runBatch(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    process.stdout.write(`\r  Testing... ${Math.min(i + CONCURRENCY, items.length)}/${items.length}`);
  }
  console.log();
  return results;
}

// ── Parse M3U ─────────────────────────────────────────────
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

// ── Rewrite group-title ───────────────────────────────────
function rewriteGroup(extinf, label) {
  if (extinf.includes("group-title=")) {
    return extinf.replace(/group-title="[^"]*"/g, `group-title="${label}"`);
  }
  const lastComma = extinf.lastIndexOf(",");
  if (lastComma !== -1) {
    return extinf.slice(0, lastComma) + ` group-title="${label}"` + extinf.slice(lastComma);
  }
  return extinf;
}

// ── Process one source ────────────────────────────────────
async function processSource(source, blacklist, seenUrls, skipTest) {
  let text;
  try {
    const resp = await fetch(source.url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) { console.log(`  ❌ Failed (HTTP ${resp.status})`); return []; }
    text = await resp.text();
  } catch (err) {
    console.log(`  ❌ Fetch error: ${err.message}`);
    return [];
  }

  const channels = parseM3U(text);
  console.log(`  📺 Found: ${channels.length} channels`);

  const toTest = [];
  let instantDead = 0, instantBlocked = 0, dupes = 0;

  for (const ch of channels) {
    // Deduplicate across merged sources
    if (seenUrls.has(ch.url)) { dupes++; continue; }
    seenUrls.add(ch.url);

    if (blacklist.has(ch.url)) { continue; }
    if (INSTANT_DEAD.some(p => p.test(ch.url))) {
      blacklist.add(ch.url); instantDead++; continue;
    }
    if (INSTANT_BLOCKED.some(p => p.test(ch.extinf) || p.test(ch.name))) {
      blacklist.add(ch.url); instantBlocked++; continue;
    }
    toTest.push(ch);
  }

  if (dupes > 0) console.log(`  🔁 Duplicates removed: ${dupes}`);
  console.log(`  🚫 Dead: ${instantDead} | Geo-blocked: ${instantBlocked} | To test: ${toTest.length}`);

  let alive = toTest;
  if (!skipTest && toTest.length > 0) {
    const results = await runBatch(toTest, async (ch) => {
      const ok = await isAlive(ch.url);
      if (!ok) blacklist.add(ch.url);
      return ok ? ch : null;
    });
    alive = results.filter(Boolean);
    console.log(`  ✅ Alive: ${alive.length} | ❌ Dead: ${toTest.length - alive.length}`);
  }

  return alive;
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const sourceArg = args.includes("--source") ? args[args.indexOf("--source") + 1] : "all";
  const skipTest = args.includes("--skip-test");

  let sources = sourceArg === "all"
    ? SOURCES
    : SOURCES.filter(s => s.key === sourceArg || s.key === sourceArg + "2");

  if (sources.length === 0) {
    console.error(`❌ Unknown source: ${sourceArg}`);
    console.error(`Available: ${[...new Set(SOURCES.map(s => s.key.replace(/\d$/, "")))].join(", ")}`);
    process.exit(1);
  }

  const blacklist = loadBlacklist();
  console.log(`\n🚀 IPTV Tester v3`);
  console.log(`📋 Blacklist: ${blacklist.size} entries`);
  console.log(`🔧 Mode: ${skipTest ? "Filter only" : `Testing (${CONCURRENCY} concurrent, ${TIMEOUT_MS}ms timeout)`}\n`);

  // Group sources by label for merging
  const byLabel = {};
  for (const source of sources) {
    if (!byLabel[source.label]) byLabel[source.label] = [];
    byLabel[source.label].push(source);
  }

  let merged = "#EXTM3U\n\n";
  let totalAlive = 0, totalDead = 0, totalBlocked = 0;
  let lastGroup = "";

  for (const [label, labelSources] of Object.entries(byLabel)) {
    const group = labelSources[0].group;

    if (group !== lastGroup) {
      console.log(`\n${"━".repeat(50)}`);
      console.log(`  ${group}`);
      console.log(`${"━".repeat(50)}`);
      lastGroup = group;
    }

    console.log(`\n${label}`);

    // Shared dedup set across all sources for this label
    const seenUrls = new Set();
    const allAlive = [];

    for (const source of labelSources) {
      console.log(`  → ${source.url.includes("Free-TV") ? "Free-TV" : "iptv-org"}`);
      const alive = await processSource(source, blacklist, seenUrls, skipTest);
      allAlive.push(...alive);
      totalDead += (blacklist.size - totalDead - totalBlocked);
    }

    totalAlive += allAlive.length;

    if (allAlive.length > 0) {
      merged += `\n# ═══ ${label} — ${allAlive.length} channels ═══\n`;
      for (const ch of allAlive) {
        merged += rewriteGroup(ch.extinf, label) + "\n" + ch.url + "\n";
      }
    }
  }

  saveBlacklist(blacklist);
  merged += `\n# ✅ ${totalAlive} alive | blacklist: ${blacklist.size} entries\n`;
  fs.writeFileSync(OUTPUT_FILE, merged);

  console.log(`\n${"━".repeat(50)}`);
  console.log(`💾 Blacklist: ${blacklist.size} entries → blacklist.json`);
  console.log(`✅ Playlist:  ${totalAlive} channels → playlist.m3u`);
  console.log(`🎉 Done! Open playlist.m3u in your IPTV player.\n`);
}

main().catch(console.error);