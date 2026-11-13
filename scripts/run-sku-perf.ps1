# Runner cho task "Claude - Hieu suat SKU" (goi boi scripts\setup-sku-perf-task.ps1).
# Keo don Hoan thanh tu Sapo -> sku-performance.json -> commit + push -> Vercel deploy.
# Pull truoc khi push de khong dung dau nhanh voi task dong bo kien thuc 15 phut/lan.
$ErrorActionPreference = "Continue"
$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo

$py = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $py) { $py = (Get-Command py -ErrorAction SilentlyContinue) }
if (-not $py) { Write-Host "[LOI] Khong tim thay Python (python/py)."; exit 1 }

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm')] Dong bo hieu suat SKU..."
git pull --rebase --autostash origin main 2>&1 | Out-Host
& $py.Source "tools\sync_sku_performance.py" "--push" 2>&1 | Out-Host
Write-Host "[XONG]"
