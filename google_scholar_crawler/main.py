"""抓取 Google Scholar 个人主页的引用数据。

只用一次 HTTP 请求拿到整个主页（引用数、h-index、i10-index、逐条论文引用数），
避免 scholarly 逐条论文抓取带来的高频请求与 429。
"""

import json
import os
import random
import re
import sys
import time
from datetime import datetime

import requests

PROFILE_URL = "https://scholar.google.com/citations?hl=en&user={scholar_id}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Referer": "https://scholar.google.com/",
}

BLOCKED_MARKERS = ("gs_captcha_ccl", "unusual traffic", "not a robot", "sorry")
MAX_ATTEMPTS = 6


def fetch_profile(session: requests.Session, url: str) -> str:
    """带指数退避重试地取一次主页 HTML。"""
    last_error = "unknown error"
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            resp = session.get(url, headers=HEADERS, timeout=30)
        except requests.RequestException as exc:
            last_error = f"request failed: {exc}"
        else:
            text = resp.text
            if resp.status_code == 200 and 'class="gsc_rsb_std"' in text:
                return text

            last_error = f"HTTP {resp.status_code}"
            lowered = text.lower()
            if any(marker in lowered for marker in BLOCKED_MARKERS):
                last_error += " (captcha/blocked page)"

            retry_after = resp.headers.get("Retry-After")
            if retry_after and retry_after.isdigit():
                wait = min(int(retry_after), 120)
                print(f"[warn] {last_error}, honor Retry-After {wait}s")
                time.sleep(wait)
                continue

        wait = min(3 * 2 ** (attempt - 1), 60) + random.uniform(0, 3)
        print(f"[warn] attempt {attempt}/{MAX_ATTEMPTS} failed: {last_error}; sleep {wait:.1f}s")
        if attempt < MAX_ATTEMPTS:
            time.sleep(wait)

    raise RuntimeError(f"cannot fetch scholar profile: {last_error}")


def parse_stats(html: str) -> dict:
    """解析主页顶部的引用数 / h-index / i10-index。"""
    values = re.findall(r'class="gsc_rsb_std">([0-9,]+)<', html)
    if len(values) < 6:
        raise RuntimeError(f"unexpected scholar page layout, got {len(values)} stat values")
    numbers = [int(v.replace(",", "")) for v in values]
    return {
        "citedby": numbers[0],
        "citedby5y": numbers[1],
        "hindex": numbers[2],
        "hindex5y": numbers[3],
        "i10index": numbers[4],
        "i10index5y": numbers[5],
    }


def parse_name(html: str) -> str:
    match = re.search(r'<div id="gsc_prf_in">([^<]+)</div>', html)
    return match.group(1).strip() if match else ""


def parse_publications(html: str) -> dict:
    """解析论文列表，键为 scholar 的 author_pub_id，供 show_paper_citations 使用。"""
    publications = {}
    rows = html.split('class="gsc_a_tr"')[1:]
    for row in rows:
        pub_id = re.search(r'citation_for_view=([^"&]+)', row)
        if not pub_id:
            continue
        title = re.search(r'class="gsc_a_at"[^>]*>([^<]+)<', row)
        cited = re.search(r'class="gsc_a_ac[^"]*"[^>]*>([0-9,]+)<', row)
        publications[pub_id.group(1)] = {
            "author_pub_id": pub_id.group(1),
            "title": title.group(1).strip() if title else "",
            "num_citations": int(cited.group(1).replace(",", "")) if cited else 0,
        }
    return publications


def main() -> int:
    scholar_id = os.environ.get("GOOGLE_SCHOLAR_ID", "").strip()
    if not scholar_id:
        print("[error] GOOGLE_SCHOLAR_ID is not set", file=sys.stderr)
        return 1

    proxies = {"http": os.environ["SCHOLAR_PROXY"], "https": os.environ["SCHOLAR_PROXY"]} \
        if os.environ.get("SCHOLAR_PROXY") else None

    session = requests.Session()
    if proxies:
        session.proxies.update(proxies)

    try:
        html = fetch_profile(session, PROFILE_URL.format(scholar_id=scholar_id))
        data = parse_stats(html)
        data["name"] = parse_name(html)
        data["publications"] = parse_publications(html)
    except RuntimeError as exc:
        print(f"[error] {exc}", file=sys.stderr)
        return 1

    data["updated"] = str(datetime.now())

    os.makedirs("results", exist_ok=True)
    with open("results/gs_data.json", "w", encoding="utf-8") as outfile:
        json.dump(data, outfile, ensure_ascii=False, indent=2)

    shieldsio_data = {
        "schemaVersion": 1,
        "label": "citations",
        "message": f"{data['citedby']}",
    }
    with open("results/gs_data_shieldsio.json", "w", encoding="utf-8") as outfile:
        json.dump(shieldsio_data, outfile, ensure_ascii=False)

    print(f"[info] citations={data['citedby']} h-index={data['hindex']} "
          f"papers={len(data['publications'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
