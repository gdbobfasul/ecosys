// record.js — ЗАДЪЛЖИТЕЛЕН ЗАПИС на всички данни за пуснат токен в проекта: private/crypto/<ИмеНаТокена>/
// (искане на собственика 11.09.2026). Пише: token.json (договор, мрежа, адреси, параметри, пазар, страница),
// README.md (четимо), abi.json + <Договор>.sol (копие на договора на ТОЗИ токен), stats.json (последно състояние).
// Никакви ключове/сийдове — само публични данни. Вика се от bot.js след create/liquidity/stats и с `node bot.js record <id>`.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const CRYPTO_DIR = path.join(ROOT, "private", "crypto");
// (11.09.2026) ABI и изходният код са на ДОГОВОРА НА ТОЗИ ТОКЕН (dep.contract; липсва → стария PupikesFeatureToken):
// HRVS пази своя ABI (без блокиране), новите V2 токени получават V2.
function contractOf(dep) { return String((dep && dep.contract) || "PupikesFeatureToken").replace(/[^A-Za-z0-9_]/g, ""); }
function artifactPath(n) { return path.join(ROOT, "private", "token", "artifacts", "token", "contracts", n + ".sol", n + ".json"); }
function sourcePath(n) { return path.join(ROOT, "private", "token", "contracts", n + ".sol"); }

function folderName(d) { return String(d.name || d.id).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""); }

// Записва/обновява папката на токена. dep = deployments/<мрежа>-<id>.json, cat = каталожният запис,
// stats = deployments/<мрежа>-<id>.stats.json (ако има), extra = { pair, liquidity, pageUrl, txHash… }.
function recordToken({ dep, cat, stats, extra, network }) {
  if (!dep || !dep.address) return null;
  const cn = contractOf(dep);
  const netKey = network && network.key ? network.key : (dep.network || "");
  const dir = path.join(CRYPTO_DIR, folderName(dep) + (netKey && netKey !== "bscMainnet" ? "-" + netKey : ""));
  fs.mkdirSync(dir, { recursive: true });
  const prev = fs.existsSync(path.join(dir, "token.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "token.json"), "utf8")) : {};
  const rec = Object.assign({}, prev, {
    name: dep.name, symbol: dep.symbol, id: dep.id, decimals: dep.decimals, supply: dep.supply,
    contract: { address: dep.address, name: cn, deployedAt: dep.deployedAt, txHash: dep.txHash || (extra && extra.txHash) || prev.txHash || null },
    network: { key: dep.network, chainId: dep.chainId, explorer: (network && network.explorer) || prev.explorer || null,
               explorerUrl: ((network && network.explorer) || "https://bscscan.com") + "/address/" + dep.address },
    owner: { treasury: dep.deployer, guardian: dep.guardian, note: "Ключовете са САМО в pupikes-metamask-coin-creator/wallet/ (gitignored). Тук няма тайни." },
    params: cat ? { special: cat.special, why: cat.why, burnFeeBps: cat.params && cat.params.burnFeeBps, fundFeeBps: cat.params && cat.params.fundFeeBps,
                    maxTxBps: cat.params && cat.params.maxTxBps, maxWalletBps: cat.params && cat.params.maxWalletBps, ownerGuard: cat.ownerGuard } : prev.params,
    market: Object.assign({}, prev.market || {}, (extra && extra.market) || {}, stats ? { lastStats: stats } : {}),
    page: { local: "public/crypto/" + slug(dep) + "/index.html", url: "https://pupikes.com/crypto/" + slug(dep) + "/" },
    files: { abi: "abi.json", source: cn + ".sol", deploymentRecord: "deployments/" + dep.network + "-" + dep.id + ".json" },
    updatedAt: new Date().toISOString()
  });
  fs.writeFileSync(path.join(dir, "token.json"), JSON.stringify(rec, null, 2));
  try { const art = JSON.parse(fs.readFileSync(artifactPath(cn), "utf8")); fs.writeFileSync(path.join(dir, "abi.json"), JSON.stringify(art.abi, null, 2)); } catch (_) {}
  try { fs.copyFileSync(sourcePath(cn), path.join(dir, cn + ".sol")); } catch (_) {}
  if (stats) fs.writeFileSync(path.join(dir, "stats.json"), JSON.stringify(stats, null, 2));
  fs.writeFileSync(path.join(dir, "README.md"), readme(rec));
  upsertConf(rec);
  return dir;
}
function slug(d) { return String(d.name || d.id).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""); }
function readme(r) {
  const p = r.params || {}; const m = r.market || {};
  return `# ${r.name} (${r.symbol})

- Мрежа: ${r.network.key} (chainId ${r.network.chainId})
- Договор: \`${r.contract.address}\` — ${r.network.explorerUrl}
- Пуснат: ${r.contract.deployedAt || "?"}${r.contract.txHash ? " · tx " + r.contract.txHash : ""}
- Снабдяване: ${r.supply} ${r.symbol} (decimals ${r.decimals})
- Трезор (създател/фонд): \`${r.owner.treasury}\`
- Пазач (Vault Guard): \`${r.owner.guardian}\`
- Особеност: ${p.special || "—"}
- Такси: изгаряне ${(p.burnFeeBps || 0) / 100}% · фонд ${(p.fundFeeBps || 0) / 100}% · maxTx ${p.maxTxBps || 0} bps · maxWallet ${p.maxWalletBps || 0} bps
- Охрана на трезора: праг ${p.ownerGuard ? p.ownerGuard.thresholdTokens : "?"} токена, задържане ${p.ownerGuard ? p.ownerGuard.delaySec : "?"} s
- Пазар: ${m.pair ? "PancakeSwap pair `" + m.pair + "`" : "още няма пул"}${m.liquidityBnb != null ? " · ликвидност " + m.liquidityBnb + " BNB + " + m.liquidityTokens + " " + r.symbol : ""}${m.lastStats && m.lastStats.price != null ? " · цена " + m.lastStats.price : ""}
- Страница: ${r.page.url}
- Файлове тук: token.json (всички данни), abi.json, ${(r.files && r.files.source) || "PupikesFeatureToken.sol"} (копие на договора), stats.json (последно състояние)

Ключове/сийд НЕ се пазят тук — само в pupikes-metamask-coin-creator/wallet/ (извън git).
Обновено: ${r.updatedAt}
`;
}

// (11.09.2026) Всеки създаден токен се записва и в private/configs/new-metatokens.conf (искане на собственика):
// TOKEN_<SYMBOL>_ADDRESS/NAME/NETWORK/PAIR/CREATED. Пипаме САМО тези редове; сийдът и другите стойности не се четат.
function upsertConf(rec) {
  try {
    const f = path.join(ROOT, "private", "configs", "new-metatokens.conf");
    if (!fs.existsSync(f)) return;
    let s = fs.readFileSync(f, "utf8"); const NL = s.includes("\r\n") ? "\r\n" : "\n";
    const sym = String(rec.symbol || rec.id).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const vals = { ADDRESS: rec.contract.address, NAME: JSON.stringify(rec.name), NETWORK: rec.network.key, PAIR: (rec.market && rec.market.pair) || "", CREATED: rec.contract.deployedAt || "" };
    let lines = s.split(NL); if (lines[lines.length - 1] === "") lines.pop();
    if (!lines.some((l) => l.startsWith("# ── ТОКЕНИ"))) lines.push("", "# ── ТОКЕНИ, създадени от бота (ботът допълва тук при всеки нов токен) ──");
    for (const [k, v] of Object.entries(vals)) {
      if (v === "") continue;
      const key = "TOKEN_" + sym + "_" + k + (rec.network.key !== "bscMainnet" ? "_" + rec.network.key.toUpperCase() : "");
      const i = lines.findIndex((l) => l.startsWith(key + "="));
      if (i >= 0) lines[i] = key + "=" + v; else lines.push(key + "=" + v);
    }
    fs.writeFileSync(f, lines.join(NL) + NL);
  } catch (_) {}
}
module.exports = { recordToken, CRYPTO_DIR };
