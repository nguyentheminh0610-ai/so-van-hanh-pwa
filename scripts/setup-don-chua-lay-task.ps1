# CAI DAT MOT LAN tren PC truc: tao Task Scheduler chay 20:00 HANG NGAY, liet ke
# don tao truoc 16:00 ma hang van chuyen CHUA lay (doc Sapo) roi gui Telegram.
# Khong ton token AI. Chot 16/11/2026: chay 20:00 (khong phai 19:00) de bu do tre
# Sapo ghi nhan "hang da lay" (thuong ~10 phut, toi da do duoc ~1,5 gio).
#
# Dieu kien: ~/.config/sapo/credentials.json da co tren PC.
# Telegram: dat bien moi truong TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, hoac tao
#   ~/.config/telegram/credentials.json = {"bot_token":"...","chat_id":"..."}
#   (KHONG de trong repo - repo public). Chua co thi task chi ghi log, khong gui.
#
# Chay 1 lan:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-don-chua-lay-task.ps1
# Chay thu ngay:
#   Start-ScheduledTask -TaskName "Claude - Don chua lay"
# Go bo:
#   Unregister-ScheduledTask -TaskName "Claude - Don chua lay" -Confirm:$false

$ErrorActionPreference = "Stop"

$RepoDir  = Split-Path -Parent $PSScriptRoot
$RunFile  = Join-Path $PSScriptRoot "run-don-chua-lay.ps1"
$TaskName = "Claude - Don chua lay"

if (-not (Test-Path $RunFile)) { Write-Host "[LOI] Khong thay $RunFile"; exit 1 }
$cred = Join-Path $HOME ".config\sapo\credentials.json"
if (-not (Test-Path $cred)) { Write-Host "[CANH BAO] Chua thay $cred - task se loi khi chay." }

$action = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument "//B //Nologo `"$(Join-Path $PSScriptRoot 'run-hidden.vbs')`" `"$RunFile`"" `
    -WorkingDirectory $RepoDir

$trigger = New-ScheduledTaskTrigger -Daily -At 8:00PM

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "20:00 hang ngay: don tao truoc 16:00 ma hang van chuyen chua lay (doc Sapo) -> Telegram. 0 token. Xem tools/check_don_chua_lay.py." `
    -Force | Out-Null

Write-Host "[XONG] Da tao task:"
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State | Format-Table -AutoSize
