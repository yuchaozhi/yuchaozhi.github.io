# Update Google Scholar citation data and upload it to Cloudflare KV
# Usage: powershell -ExecutionPolicy Bypass -File .\update_citations.ps1
#        powershell -ExecutionPolicy Bypass -File .\update_citations.ps1 -Html .\scholar.html
#        (-Html: 用浏览器另存的本机 HTML，不联网抓取)

param([string]$Html = "")

$root = $PSScriptRoot
$env:GOOGLE_SCHOLAR_ID = "bZ9TsCcAAAAJ"

if ($Html) {
    $htmlPath = (Resolve-Path $Html).Path
    Write-Host "[1/2] Parsing local HTML: $htmlPath"
    $crawlArgs = @("--from-html", $htmlPath)
} else {
    Write-Host "[1/2] Fetching Google Scholar ..."
    $crawlArgs = @()
}

Push-Location (Join-Path $root "google_scholar_crawler")
python main.py @crawlArgs
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Crawl failed, nothing uploaded" }

Write-Host "[2/2] Uploading to Cloudflare KV ..."
Push-Location (Join-Path $root "_worker")
npx --yes wrangler@latest kv key put --binding GS_DATA --path ../google_scholar_crawler/results/gs_data.json gs_data --remote
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "Upload failed. If the Cloudflare login expired, run: npx --yes wrangler@latest login"
    exit 1
}
Pop-Location

Write-Host "Done. Badge refreshes within about 5 minutes (refresh the page with Ctrl+F5)."
