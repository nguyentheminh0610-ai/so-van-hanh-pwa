# Runner cho task "Claude - Doi soat chat hau mai" (cai bang scripts\setup-doi-soat-chat-task.ps1).
# 30 phut/lan: doc nhat ky chat C:\sokho\cskh-log, khach bao hang loi / giao nham ma chua co tren
# So Van Hanh thi them 1 the vao khu Chat (bang cskh_chat_errors). Chot 22/11/2026.
# Khong ton token AI, khong mo trinh duyet, khong nhan khach, khong gui Telegram.
# Log: logs\doi-soat-chat.log (1 dong moi luot, tu cat khi qua 200 KB)
$ErrorActionPreference = "Continue"
$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo
$env:PYTHONUTF8 = "1"
$py = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $py) { $py = (Get-Command py -ErrorAction SilentlyContinue) }
if (-not $py) { exit 1 }
$LogDir = Join-Path $Repo "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }
$Log = Join-Path $LogDir "doi-soat-chat.log"
if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 200KB)) { Remove-Item $Log -Force }
$out = & $py.Source -W ignore scripts\doi_soat_chat.py 2>&1 | Out-String
$code = $LASTEXITCODE
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$one = ($out.Trim() -replace "\s*\r?\n\s*", " ; ")
if ($one.Length -gt 600) { $one = $one.Substring(0, 600) }
Add-Content -Path $Log -Encoding UTF8 -Value "$stamp $one"
if ($code -ne 0) { exit 1 }
