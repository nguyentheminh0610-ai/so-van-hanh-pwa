# Runner cho task "Claude - Dong bo hoan ve" (cai bang scripts\setup-sync-returns-task.ps1).
# Moi gio: dong bo phieu tra hang Sapo -> Supabase platform_returns_feed (khoi "Hoan ve chua nhan" tren So Kho).
# Khong ton token AI; chi doc Sapo, ghi Supabase. Chot 18/11/2026 (feed dung tu 20/10 vi khong co task nao chay).
# Log: logs\returns-feed.log (chi giu dong tom tat + loi, tu cat khi qua 200 KB)
$ErrorActionPreference = "Continue"
$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo
$env:PYTHONUTF8 = "1"
$py = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $py) { $py = (Get-Command py -ErrorAction SilentlyContinue) }
if (-not $py) { exit 1 }
$LogDir = Join-Path $Repo "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }
$Log = Join-Path $LogDir "returns-feed.log"
if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 200KB)) { Remove-Item $Log -Force }
$out = & $py.Source -W ignore scripts\sync_returns_feed.py 2>&1 | Out-String
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$m = [regex]::Match($out, '"synced":\s*(\d+),\s*"feed_total":\s*(\d+)')
$n = ([regex]::Matches($out, '"days":')).Count
if ($m.Success -and $LASTEXITCODE -eq 0) {
    Add-Content -Path $Log -Encoding UTF8 -Value "$stamp OK synced=$($m.Groups[1].Value) feed=$($m.Groups[2].Value) qua_han=$n"
} else {
    Add-Content -Path $Log -Encoding UTF8 -Value "$stamp LOI: $($out.Substring(0, [Math]::Min(600, $out.Length)))"
    exit 1
}
