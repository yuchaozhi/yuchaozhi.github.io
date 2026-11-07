/**
 * Cloudflare Worker：抓取 Google Scholar 个人主页，把引用数输出成 shields.io endpoint。
 *
 * GET /            -> {"schemaVersion":1,"label":"citations","message":"37"}
 * GET /badge       -> 同上（给页面徽章用）
 * GET /data.json   -> 完整数据（含 publications，供页面按论文显示引用数）
 * GET /refresh     -> 立即抓取一次；配置 REFRESH_TOKEN 后需带 ?token=xxx
 * GET /admin       -> 网页表单，手动改数字后直接写 KV（需 ADMIN_TOKEN）
 * POST /update     -> 上面的表单提交用的接口（需 ADMIN_TOKEN）
 * GET /debug       -> 最近一次抓取尝试的域名与 HTTP 状态
 *
 * 定时任务由 wrangler.toml 里的 [triggers] crons 驱动，无需外部触发。
 */

const SCHOLAR_HOSTS = [
  "scholar.google.com",
  "scholar.google.com.hk",
  "scholar.google.de",
  "scholar.google.co.jp",
];

// 直连被 Google 挡住时的公共读取代理（都免 key）
const READER_PROXIES = [
  { name: "r.jina.ai", url: "https://r.jina.ai/{target}", headers: { "X-Return-Format": "html" } },
  { name: "allorigins", url: "https://api.allorigins.win/raw?url={encoded}", headers: {} },
  { name: "codetabs", url: "https://api.codetabs.com/v1/proxy?quest={encoded}", headers: {} },
];

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9," +
    "image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://scholar.google.com/",
};

const BLOCKED_MARKERS = ["gs_captcha_ccl", "unusual traffic", "not a robot", "sorry"];
const FETCH_TIMEOUT_MS = 12000;
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
};
// 徽章不缓存：每次请求都实时读 KV，改完数字刷新即生效
const BADGE_HEADERS = {
  "Cache-Control": "no-store",
};
const DATA_KEY = "gs_data";
const GOOD_KEY = "gs_data_good";
const DEBUG_KEY = "last_run";

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(refresh(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = { "Access-Control-Allow-Origin": "*" };

    if (url.pathname === "/admin") {
      return new Response(ADMIN_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    if (url.pathname === "/update") {
      return updateData(request, env, url, cors);
    }

    if (url.pathname === "/debug") {
      const last = await readJson(env, DEBUG_KEY);
      return json({ last: last || null }, { ...cors, "Cache-Control": "no-store" });
    }

    if (url.pathname === "/refresh") {
      if (env.REFRESH_TOKEN && url.searchParams.get("token") !== env.REFRESH_TOKEN) {
        return new Response("forbidden", { status: 403 });
      }
      return json(await refresh(env), { ...cors, "Cache-Control": "no-store" });
    }

    const data = await readData(env);
    if (!data) {
      // 主数据和备份都拿不到：后台抓一次，本次请求先返回，避免徽章接口被上游拖住
      ctx.waitUntil(refresh(env));
    }

    if (url.pathname === "/data.json") {
      return json(data || {}, { ...cors, ...CACHE_HEADERS });
    }

    return json(
      {
        schemaVersion: 1,
        label: "citations",
        message: data ? String(data.citedby) : "n/a",
      },
      { ...cors, ...BADGE_HEADERS }
    );
  },
};

async function refresh(env) {
  const scholarId = normalizeId(env.GOOGLE_SCHOLAR_ID || "bZ9TsCcAAAAJ");
  const attempts = [];
  await env.GS_DATA.put(DEBUG_KEY, JSON.stringify({ phase: "started", at: new Date().toISOString() }));

  const profile = `https://scholar.google.com/citations?hl=en&user=${scholarId}`;

  // 1) 直连各地区的 Scholar 域名
  for (const host of SCHOLAR_HOSTS) {
    const target = `https://${host}/citations?hl=en&user=${scholarId}`;
    const page = await fetchPage(target);
    attempts.push({ url: target, status: page.status, blocked: page.blocked });
    if (page.html && page.html.includes('class="gsc_rsb_std"')) {
      return store(env, page.html, target, attempts);
    }
  }

  // 2) 直连全是 403 时，改走公共读取代理（按顺序回退）
  for (const proxy of READER_PROXIES) {
    const target =
      proxy.name === "r.jina.ai"
        ? proxy.url.replace("{target}", profile)
        : proxy.url
            .replace("{encoded}", encodeURIComponent(profile))
            .replace("{target}", profile);

    let page = await fetchPage(target, proxy.headers);
    if (page.status === 429) {
      // Jina 免费额度是瞬时限流，等一会儿再试一次
      await sleep(6000);
      page = await fetchPage(target, proxy.headers);
    }
    attempts.push({ url: target, status: page.status, blocked: page.blocked });
    if (page.html && page.html.includes('class="gsc_rsb_std"')) {
      return store(env, page.html, proxy.name, attempts);
    }
  }

  await env.GS_DATA.put(
    DEBUG_KEY,
    JSON.stringify({ ok: false, attempts, at: new Date().toISOString() })
  );
  return { ok: false, attempts };
}

async function fetchPage(url, extraHeaders = {}) {
  try {
    const resp = await fetch(url, {
      headers: { ...BROWSER_HEADERS, ...extraHeaders },
      redirect: "follow",
      cf: { cacheTtl: 0 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const text = await resp.text();
    const blocked = BLOCKED_MARKERS.some((marker) => text.toLowerCase().includes(marker));
    return {
      status: resp.status,
      blocked,
      html: resp.ok && !blocked ? text : null,
    };
  } catch (err) {
    return { status: 0, blocked: false, html: null, error: String(err) };
  }
}

async function store(env, html, source, attempts) {
  const data = {
    ...parseStats(html),
    name: parseName(html),
    publications: parsePublications(html),
    source,
    updated: new Date().toISOString(),
  };
  const payload = JSON.stringify(data);
  await env.GS_DATA.put(DATA_KEY, payload);
  // 同时写一份“上一次正常值”，供主数据损坏时兜底
  await env.GS_DATA.put(GOOD_KEY, payload);
  await env.GS_DATA.put(
    DEBUG_KEY,
    JSON.stringify({ ok: true, attempts, at: data.updated })
  );
  return { ok: true, citedby: data.citedby, papers: Object.keys(data.publications).length, source, attempts };
}

async function readData(env) {
  const data = await readJson(env, DATA_KEY);
  if (data && typeof data === "object" && data.citedby != null) return data;
  const good = await readJson(env, GOOD_KEY);
  return good && typeof good === "object" ? good : null;
}

async function readJson(env, key) {
  try {
    const text = await env.GS_DATA.get(key);
    if (!text) return null;
    const clean = String(text).replace(/^\uFEFF/, "").trim();
    return clean ? JSON.parse(clean) : null;
  } catch {
    return null;
  }
}

// /admin 表单只允许改这几个数字字段
const NUM_KEYS = ["citedby", "citedby5y", "hindex", "hindex5y", "i10index", "i10index5y"];

async function updateData(request, env, url, cors) {
  const noStore = { ...cors, "Cache-Control": "no-store" };
  if (request.method !== "POST") {
    return json({ ok: false, error: "use POST" }, noStore, 405);
  }
  if (!env.ADMIN_TOKEN) {
    return json({ ok: false, error: "ADMIN_TOKEN not configured" }, noStore, 500);
  }
  const token = request.headers.get("X-Admin-Token") || url.searchParams.get("token");
  if (token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: "forbidden" }, noStore, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid json" }, noStore, 400);
  }

  const current = (await readData(env)) || {};
  const data = { ...current };
  for (const key of NUM_KEYS) {
    if (body[key] == null || body[key] === "") continue;
    const value = Number(body[key]);
    if (!Number.isInteger(value) || value < 0) {
      return json({ ok: false, error: `${key} must be a non-negative integer` }, noStore, 400);
    }
    data[key] = value;
  }
  if (data.citedby == null) {
    return json({ ok: false, error: "citedby is required" }, noStore, 400);
  }

  data.updated = new Date().toISOString();
  data.source = "manual";
  const payload = JSON.stringify(data);
  await env.GS_DATA.put(DATA_KEY, payload);
  await env.GS_DATA.put(GOOD_KEY, payload);
  await env.GS_DATA.put(
    DEBUG_KEY,
    JSON.stringify({ ok: true, manual: true, at: data.updated })
  );
  return json({ ok: true, citedby: data.citedby, updated: data.updated }, noStore);
}

const ADMIN_HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>引用数修改</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#f4f6f8; font:15px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif; color:#24292f; }
  .card { width:min(92vw,480px); background:#fff; border-radius:12px; padding:24px 26px;
          box-shadow:0 6px 24px rgba(0,0,0,.08); }
  h1 { font-size:18px; margin:0 0 4px; }
  .sub { margin:0 0 18px; color:#667085; font-size:13px; }
  label { display:block; margin-bottom:12px; font-size:13px; color:#475467; }
  label span { display:block; margin-bottom:4px; }
  input { width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #d0d5dd;
          border-radius:8px; font-size:15px; background:#fff; color:#24292f; }
  .row { display:flex; gap:12px; }
  .row > label { flex:1; }
  button { width:100%; margin-top:6px; padding:10px; border:0; border-radius:8px;
           background:#2f6feb; color:#fff; font-size:15px; cursor:pointer; }
  button:disabled { opacity:.6; cursor:default; }
  #msg { margin-top:12px; font-size:14px; min-height:20px; }
  .meta { margin-top:14px; font-size:12px; color:#98a2b3; word-break:break-all; }
</style></head><body>
<div class="card">
  <h1>Google Scholar 引用数</h1>
  <p class="sub">改完点保存即可，无需改代码、无需 push。徽章约 1 分钟内生效（浏览器缓存最多 5 分钟，Ctrl+F5 强刷）。</p>
  <label><span>总引用</span><input id="citedby" type="number" min="0" step="1"></label>
  <label><span>近五年引用</span><input id="citedby5y" type="number" min="0" step="1"></label>
  <div class="row">
    <label><span>h-index</span><input id="hindex" type="number" min="0" step="1"></label>
    <label><span>近五年 h-index</span><input id="hindex5y" type="number" min="0" step="1"></label>
  </div>
  <div class="row">
    <label><span>i10-index</span><input id="i10index" type="number" min="0" step="1"></label>
    <label><span>近五年 i10-index</span><input id="i10index5y" type="number" min="0" step="1"></label>
  </div>
  <label><span>口令</span><input id="token" type="password" placeholder="首次输入后本浏览器会记住"></label>
  <button id="save">保存</button>
  <div id="msg"></div>
  <p class="meta" id="meta"></p>
</div>
<script>
const FIELDS = ["citedby","citedby5y","hindex","hindex5y","i10index","i10index5y"];
const el = (id) => document.getElementById(id);
async function load() {
  try {
    const res = await fetch("/data.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    for (const key of FIELDS) {
      if (data[key] != null) el(key).value = data[key];
    }
    el("meta").textContent = "上次更新 " + (data.updated || "未知") + " · 来源 " + (data.source || "未知");
  } catch (err) {
    el("meta").textContent = "读取当前值失败";
  }
}
el("token").value = localStorage.getItem("scholar_admin_token") || "";
el("save").onclick = async () => {
  const token = el("token").value.trim();
  if (!token) { el("msg").textContent = "请先输入口令"; return; }
  const body = {};
  for (const key of FIELDS) body[key] = Number(el(key).value);
  el("save").disabled = true;
  el("msg").textContent = "保存中...";
  try {
    const res = await fetch("/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      body: JSON.stringify(body),
    });
    if (res.status === 403) { el("msg").textContent = "口令不对"; return; }
    if (!res.ok) { el("msg").textContent = "保存失败：HTTP " + res.status; return; }
    const data = await res.json();
    localStorage.setItem("scholar_admin_token", token);
    el("msg").textContent = "已保存，引用数 " + data.citedby;
    el("meta").textContent = "上次更新 " + data.updated + " · 来源 manual";
  } catch (err) {
    el("msg").textContent = "请求失败：" + err.message;
  } finally {
    el("save").disabled = false;
  }
};
load();
</script>
</body></html>`;

function normalizeId(raw) {
  let value = String(raw).trim().replace(/^["']|["']$/g, "").trim();
  const match = value.match(/user=([A-Za-z0-9_-]+)/);
  if (match) value = match[1];
  return value.split(/\s+/)[0] || "";
}

function parseStats(html) {
  const values = [...html.matchAll(/class="gsc_rsb_std">([0-9,]+)</g)].map((m) =>
    parseInt(m[1].replace(/,/g, ""), 10)
  );
  if (values.length < 6) {
    throw new Error(`unexpected scholar page layout, got ${values.length} stat values`);
  }
  return {
    citedby: values[0],
    citedby5y: values[1],
    hindex: values[2],
    hindex5y: values[3],
    i10index: values[4],
    i10index5y: values[5],
  };
}

function parseName(html) {
  const match = html.match(/<div id="gsc_prf_in">([^<]+)<\/div>/);
  return match ? match[1].trim() : "";
}

function parsePublications(html) {
  const publications = {};
  for (const row of html.split('class="gsc_a_tr"').slice(1)) {
    const id = row.match(/citation_for_view=([^"&]+)/);
    if (!id) continue;
    const title = row.match(/class="gsc_a_at"[^>]*>([^<]+)</);
    const cited = row.match(/class="gsc_a_ac[^"]*"[^>]*>([0-9,]+)</);
    publications[id[1]] = {
      author_pub_id: id[1],
      title: title ? title[1].trim() : "",
      num_citations: cited ? parseInt(cited[1].replace(/,/g, ""), 10) : 0,
    };
  }
  return publications;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(obj, headers = {}, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
