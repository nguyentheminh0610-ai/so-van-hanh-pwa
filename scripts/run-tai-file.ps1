# Runner cho task "Claude - Tai file thang" (goi boi scripts\setup-tai-file-task.ps1).
# Chot 18/11/2026: tu tai bo file THANG TRUOC tu TikTok + Shopee -> Drive -> So Van Hanh.
# Chay HANG NGAY; chay_tai_file.py tu quyet dinh: tu ngay 1 = lan 1 (so tam), tu ngay 15 = lan 2
# (cap nhat don hoan thanh, ghi de cung nhan ky). Moi lan chi lam dung 1 luot nho marker.
# 0 token. Log: logs\tai-file.log
$ErrorActionPreference = "Continue"
$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo
$env:PYTHONUTF8 = "1"

$py = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $py) { $py = (Get-Command py -ErrorAction SilentlyContinue) }
if (-not $py) { Write-Host "[LOI] Khong tim thay Python (python/py)."; exit 1 }

$LogDir = Join-Path $Repo "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }
$Log = Join-Path $LogDir "tai-file.log"

$pyExe = $py.Source
cmd /c "echo ===== $(Get-Date -Format 'yyyy-MM-dd HH:mm') ===== >> `"$Log`" & `"$pyExe`" tools\chay_tai_file.py --lich thang >> `"$Log`" 2>&1"
