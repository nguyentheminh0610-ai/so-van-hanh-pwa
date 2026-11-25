# Runner cho task "Claude - Don chua lay" (goi boi scripts\setup-don-chua-lay-task.ps1).
# Chi DOC Sapo -> liet ke don tao truoc 16:00 ma hang van chuyen chua lay -> ghi log.
# Chot 17/11/2026: KHONG gui bao cao hang ngay len Telegram, chi bao khi script LOI.
# Chi DOC Sapo. Tu 17/11/2026 chay them tools\sync_cutoff_daily.py --ghi-so: dem mau/tu "don truoc 16h" ghi vao
# Supabase (warehouse_cutoff_daily + warehouse_cutoff_orders, chi tiet tu xoa sau 40 ngay) cho So Kho. Khong commit/push.
# Log: logs\don-chua-lay.log
$ErrorActionPreference = "Continue"
$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo
$env:PYTHONUTF8 = "1"

$py = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $py) { $py = (Get-Command py -ErrorAction SilentlyContinue) }
if (-not $py) { Write-Host "[LOI] Khong tim thay Python (python/py)."; exit 1 }

$LogDir = Join-Path $Repo "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }
$Log = Join-Path $LogDir "don-chua-lay.log"

# Ghi log qua cmd de giu nguyen byte UTF-8 (PowerShell 5.1 pipe se lam vo dau tieng Viet).
$pyExe = $py.Source
cmd /c "echo ===== $(Get-Date -Format 'yyyy-MM-dd HH:mm') ===== >> `"$Log`" & `"$pyExe`" tools\check_don_chua_lay.py --telegram-loi >> `"$Log`" 2>&1"
cmd /c "echo ===== cutoff $(Get-Date -Format 'yyyy-MM-dd HH:mm') ===== >> `"$Log`" & `"$pyExe`" tools\sync_cutoff_daily.py --ghi-so >> `"$Log`" 2>&1"
# Tu 25/11/2026: canh bao don tre cho So Kho (warehouse_late_orders) + bao Telegram chu shop don tre tu 2 ngay.
cmd /c "echo ===== don tre $(Get-Date -Format 'yyyy-MM-dd HH:mm') ===== >> `"$Log`" & `"$pyExe`" tools\sync_late_orders.py --ghi-so --telegram >> `"$Log`" 2>&1"
