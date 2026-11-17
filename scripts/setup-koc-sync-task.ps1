# CAI DAT MOT LAN tren PC truc: tao Task Scheduler tu dong dong bo so lieu KOC
# (TikTok Affiliate -> Supabase) moi TUAN 1 lan. Chay 0 token (khong co Claude).
#
# TRUOC KHI CHAY SCRIPT NAY, lam 1 lan:
#   py -m pip install playwright
#   py -m playwright install chromium
#   cd C:\sokho\so-van-hanh-pwa
#   py tools\koc_auto_sync.py --login     # dang nhap TikTok 1 lan vao profile script
#
# Roi tao task (chay 1 lan duy nhat):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-koc-sync-task.ps1
#
# (Tuy chon) de script bao Telegram khi mat dang nhap, dat bien moi truong
# TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID o cap May (System) truoc khi tao task.
#
# Go bo sau nay:
#   Unregister-ScheduledTask -TaskName "Claude - Dong bo KOC" -Confirm:$false

$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $PSScriptRoot
$PyFile  = Join-Path $RepoDir "tools\koc_auto_sync.py"
$TaskName = "Claude - Dong bo KOC"

if (-not (Test-Path $PyFile)) {
    Write-Host "[LOI] Khong thay $PyFile"
    exit 1
}

# Tim python (py launcher uu tien, roi python)
$pyCmd = (Get-Command py -ErrorAction SilentlyContinue)
if ($pyCmd) { $exe = "py" } else {
    $pyCmd = (Get-Command python -ErrorAction SilentlyContinue)
    if (-not $pyCmd) { Write-Host "[LOI] Khong tim thay Python (py/python)."; exit 1 }
    $exe = "python"
}

Write-Host "Repo    : $RepoDir"
Write-Host "Script  : $PyFile"
Write-Host "Python  : $exe"
Write-Host "Ten task: $TaskName"
Write-Host ""

$action = New-ScheduledTaskAction `
    -Execute $exe `
    -Argument "`"$PyFile`"" `
    -WorkingDirectory $RepoDir

# Chay moi ngay luc 09:00 va 16:00 (chot 17/11/2026). Muc "Can anh xu ly" doi theo
# hang mau TikTok nen can cap nhat hang ngay; moi lan ~1 phut, 0 token.
$trigger = New-ScheduledTaskTrigger -Daily -DaysInterval 2 -At 9:00AM

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Tu dong keo so lieu KOC TikTok Affiliate vao Supabase moi tuan (0 token). Xem tools/koc_auto_sync.py va .claude/shared/reference_auto_data_pull_pattern.md." `
    -Force | Out-Null

Write-Host "[XONG] Da tao task:"
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State | Format-Table -AutoSize
Write-Host "Chay thu ngay:  Start-ScheduledTask -TaskName `"$TaskName`""
Write-Host "Xem lan chay:   Get-ScheduledTaskInfo -TaskName `"$TaskName`""
