# CAI DAT MOT LAN tren PC truc: tao 2 Task Scheduler tu dong tai file bao cao
# sàn -> Drive (va bo thang -> So Van Hanh). Chay 0 token (khong co Claude).
# Chot 31/10/2026 — xem .claude\shared\reference_tai_file_tu_dong.md.
#
# TRUOC KHI CHAY SCRIPT NAY, lam 1 lan tren PC:
#   py -m pip install playwright openpyxl
#   py -m playwright install chromium
#   cd C:\sokho\so-van-hanh-pwa
#   py tools\tai_file_san.py --login tiktok     # dang nhap TikTok 1 lan
#   py tools\tai_file_san.py --login shopee      # dang nhap Shopee 1 lan
#
# (Tuy chon) de script bao Telegram: dat bien moi truong cap May (System)
#   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
# (Tuy chon) neu o Google Drive for Desktop KHONG phai "G:\My Drive":
#   dat bien moi truong SVH_DRIVE_ROOT = duong dan that (vd "H:\My Drive").
#
# Roi tao task:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-tai-file-task.ps1
#
# Go bo sau nay:
#   Unregister-ScheduledTask -TaskName "Claude - Tai file thang" -Confirm:$false
#   Unregister-ScheduledTask -TaskName "Claude - Tai file tuan"  -Confirm:$false

$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $PSScriptRoot
$PyFile  = Join-Path $RepoDir "tools\chay_tai_file.py"

if (-not (Test-Path $PyFile)) { Write-Host "[LOI] Khong thay $PyFile"; exit 1 }

$pyCmd = (Get-Command py -ErrorAction SilentlyContinue)
if ($pyCmd) { $exe = "py" } else {
    $pyCmd = (Get-Command python -ErrorAction SilentlyContinue)
    if (-not $pyCmd) { Write-Host "[LOI] Khong tim thay Python (py/python)."; exit 1 }
    $exe = "python"
}

Write-Host "Repo   : $RepoDir"
Write-Host "Runner : $PyFile"
Write-Host "Python : $exe`n"

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 40) `
    -MultipleInstances IgnoreNew

# ---- Task THANG: chay HANG NGAY 05:00 ----
# Task Scheduler (PowerShell) khong co trigger "ngay 21 hang thang" san. Cach ben:
# chay hang ngay, runner chay_tai_file.py tu kiem "da qua ngay 20 chua" + marker
# "da hoan tat ky nay chua" -> thuc te chi tai + luu DUNG 1 LAN moi ky, sau ngay
# 20; cac ngay con lai thoat ngay, khong tai gi.
$aThang = New-ScheduledTaskAction -Execute $exe `
    -Argument "`"$PyFile`" --lich thang" -WorkingDirectory $RepoDir
$tThang = New-ScheduledTaskTrigger -Daily -At 5:00AM
Register-ScheduledTask -TaskName "Claude - Tai file thang" -Action $aThang `
    -Trigger $tThang -Settings $settings -Force `
    -Description "Tu dong tai bo file thang -> Drive -> So Van Hanh (0 token). Chay hang ngay 05:00; up_so_van_hanh.py tu chot chan 'qua ngay 20 moi upload'. Xem tools/chay_tai_file.py." | Out-Null

# ---- Task TUAN: Thu Hai 05:30, tai bo file tuan truoc -> Drive ----
$aTuan = New-ScheduledTaskAction -Execute $exe `
    -Argument "`"$PyFile`" --lich tuan" -WorkingDirectory $RepoDir
$tTuan = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 5:30AM
Register-ScheduledTask -TaskName "Claude - Tai file tuan" -Action $aTuan `
    -Trigger $tTuan -Settings $settings -Force `
    -Description "Tu dong tai bo file tuan truoc -> Drive (Theo tuan). 0 token. Xem tools/chay_tai_file.py." | Out-Null

Write-Host "[XONG] Da tao 2 task:"
Get-ScheduledTask -TaskName "Claude - Tai file thang","Claude - Tai file tuan" |
    Select-Object TaskName, State | Format-Table -AutoSize
Write-Host "Chay thu ngay:  Start-ScheduledTask -TaskName 'Claude - Tai file tuan'"
Write-Host "Xem lan chay:   Get-ScheduledTaskInfo -TaskName 'Claude - Tai file thang'"
