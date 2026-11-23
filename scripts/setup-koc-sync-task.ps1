# CAI DAT MOT LAN tren PC truc: tao Task Scheduler tu dong dong bo so lieu KOC
# (TikTok Affiliate -> Supabase) 2 NGAY 1 lan luc 09:00, va task do lenh nut
# "Cap nhat ngay" moi phut. Chay 0 token (khong co Claude).
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
#   Unregister-ScheduledTask -TaskName "Claude - KOC cap nhat ngay" -Confirm:$false

$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $PSScriptRoot
$PyFile  = Join-Path $RepoDir "tools\koc_auto_sync.py"
$TaskName = "Claude - Dong bo KOC"

if (-not (Test-Path $PyFile)) {
    Write-Host "[LOI] Khong thay $PyFile"
    exit 1
}

# Dung DUONG DAN DAY DU toi python.exe (sua 23/11/2026). Truoc day de "py": chay
# tay thi duoc nhung Task Scheduler bao 0x80070002 (khong tim thay file) o MOI
# luot chay theo lich -> so lieu KOC dung im tu 17/11 ma khong ai biet.
$pyCmd = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $pyCmd) { Write-Host "[LOI] Khong tim thay Python."; exit 1 }
$exe  = $pyCmd.Source
# pythonw.exe = python khong co cua so console, cho task do lenh chay moi phut
$exeW = Join-Path (Split-Path -Parent $exe) "pythonw.exe"
if (-not (Test-Path $exeW)) { $exeW = $exe }

Write-Host "Repo    : $RepoDir"
Write-Host "Script  : $PyFile"
Write-Host "Python  : $exe"
Write-Host "Ten task: $TaskName"
Write-Host ""

$action = New-ScheduledTaskAction `
    -Execute $exe `
    -Argument "`"$PyFile`"" `
    -WorkingDirectory $RepoDir

# Lich tu dong: 2 ngay/lan luc 09:00. Can so moi hon thi chu shop bam nut
# "Cap nhat ngay" tren tab Cham diem KOC (task thu 2 ben duoi).
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
    -Description "Tu dong keo so lieu KOC TikTok Affiliate vao Supabase 2 ngay/lan (0 token). Xem tools/koc_auto_sync.py va .claude/shared/reference_auto_data_pull_pattern.md." `
    -Force | Out-Null

# --- Task 2 (23/11/2026): nut "Cap nhat ngay" tren So Van Hanh --------------
# Moi phut do bang koc_sync_requests (scripts/koc-sync-requests.sql). Khong co
# lenh -> thoat ngay (1 request nhe, khong mo Chrome). Co lenh -> chay dong bo.
$TaskName2 = "Claude - KOC cap nhat ngay"
$action2 = New-ScheduledTaskAction `
    -Execute $exeW `
    -Argument "`"$PyFile`" --theo-yeu-cau" `
    -WorkingDirectory $RepoDir
$trigger2 = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask `
    -TaskName $TaskName2 `
    -Action $action2 `
    -Trigger $trigger2 `
    -Settings $settings `
    -Description "Moi phut do lenh 'Cap nhat ngay' tu tab Cham diem KOC (bang koc_sync_requests); co lenh thi chay tools/koc_auto_sync.py. 0 token." `
    -Force | Out-Null

Write-Host "[XONG] Da tao task:"
Get-ScheduledTask -TaskName $TaskName, $TaskName2 | Select-Object TaskName, State | Format-Table -AutoSize
Write-Host "Chay thu ngay:  Start-ScheduledTask -TaskName `"$TaskName`""
Write-Host "Xem lan chay:   Get-ScheduledTaskInfo -TaskName `"$TaskName`""
