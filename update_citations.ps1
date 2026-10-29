# Update Google Scholar citation data from this machine and upload it to Cloudflare KV
# Usage: powershell -ExecutionPolicy Bypass -File .\update_citations.ps1

$root = $PSScriptRoot
$env:GOOGLE_SCHOLAR_ID = "bZ9TsCcAAAAJ"

Write-Host "[1/2] Fetching Google Scholar ..."
Push-Location (Join-Path $root "google_scholar_crawler")
python main.py
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
