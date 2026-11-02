/**
 * Cloudflare Worker：抓取 Google Scholar 个人主页，把引用数输出成 shields.io endpoint。
 *
 * GET /            -> {"schemaVersion":1,"label":"citations","message":"37"}
 * GET /badge       -> 同上（给页面徽章用）
 * GET /data.json   -> 完整数据（含 publications，供页面按论文显示引用数）
 * GET /refresh     -> 立即抓取一次；配置 REFRESH_TOKEN 后需带 ?token=xxx
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
      { ...cors, ...CACHE_HEADERS }
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

function json(obj, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
