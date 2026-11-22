# CAI DAT MOT LAN tren PC truc: Task Scheduler chay doi soat nguon chat 30 phut/lan.
# Vi sao: luot CSKH ghi moi cuoc chat vao nhat ky nhung hay quen day case len So Van Hanh
# (ra 22/11/2026: lot it nhat 4 khach bao rach / giao nham). Script nay la luoi an toan phia sau.
#
# Chay 1 lan duy nhat:
#   cd C:\sokho\so-van-hanh-pwa
#   powershell -ExecutionPolicy Bypass -File scripts\setup-doi-soat-chat-task.ps1
#
# Go bo sau nay (neu can):
#   Unregister-ScheduledTask -TaskName "Claude - Doi soat chat hau mai" -Confirm:$false

$ErrorActionPreference = "Stop"

$RepoDir  = Split-Path -Parent $PSScriptRoot
$RunFile  = Join-Path $PSScriptRoot "run-doi-soat-chat.ps1"
$TaskName = "Claude - Doi soat chat hau mai"

if (-not (Test-Path $RunFile)) {
    Write-Host "[LOI] Khong thay $RunFile"
    exit 1
}

# Qua wscript //B (run-hidden.vbs) de khong nhay cua so console (chot 31/10/2026).
$HiddenVbs = Join-Path $PSScriptRoot "run-hidden.vbs"
$action = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument "//B //Nologo `"$HiddenVbs`" `"$RunFile`"" `
    -WorkingDirectory $RepoDir

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
    -RepetitionInterval (New-TimeSpan -Minutes 30) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "30 phut/lan: doc nhat ky chat CSKH, khach bao hang loi / giao nham ma chua co tren So Van Hanh thi them the vao khu Chat tab Hau mai. Khong ton token, khong mo trinh duyet. Xem .claude/shared/hau-mai-so-van-hanh.md" `
    -Force | Out-Null

Write-Host "[XONG] Da tao task:"
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State | Format-Table -AutoSize
Write-Host "Xem log: logs\doi-soat-chat.log"
