# Runner cho task "Claude - Don chua lay" (goi boi scripts\setup-don-chua-lay-task.ps1).
# Chi DOC Sapo -> liet ke don tao truoc 16:00 ma hang van chuyen chua lay -> gui Telegram.
# Khong ghi gi len Sapo/Supabase, khong commit/push. Log: logs\don-chua-lay.log
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
cmd /c "echo ===== $(Get-Date -Format 'yyyy-MM-dd HH:mm') ===== >> `"$Log`" & `"$pyExe`" tools\check_don_chua_lay.py --telegram >> `"$Log`" 2>&1"
