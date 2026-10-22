# CAI DAT MOT LAN tren PC truc: tao Task Scheduler tu dong dong bo kien thuc
# moi 15 phut, de kien thuc chu shop train o may nao cung tu sang may kia.
#
# Chay 1 lan duy nhat:
#   cd C:\sokho\so-van-hanh-pwa
#   powershell -ExecutionPolicy Bypass -File scripts\setup-sync-task.ps1
#
# Go bo sau nay (neu can):
#   Unregister-ScheduledTask -TaskName "Claude - Dong bo kien thuc" -Confirm:$false

$ErrorActionPreference = "Stop"

$RepoDir  = Split-Path -Parent $PSScriptRoot
$SyncFile = Join-Path $PSScriptRoot "sync-knowledge.ps1"
$TaskName = "Claude - Dong bo kien thuc"

if (-not (Test-Path $SyncFile)) {
    Write-Host "[LOI] Khong thay $SyncFile"
    Write-Host "      Chay truoc: git pull --rebase --autostash origin main"
    exit 1
}
if (-not (Test-Path (Join-Path $RepoDir ".git"))) {
    Write-Host "[LOI] $RepoDir khong phai git repo."
    exit 1
}

Write-Host "Repo       : $RepoDir"
Write-Host "Script sync: $SyncFile"
Write-Host "Ten task   : $TaskName"
Write-Host ""

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$SyncFile`"" `
    -WorkingDirectory $RepoDir

# Chay ngay, sau do lap lai moi 15 phut, keo dai 10 nam (coi nhu vinh vien).
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 15) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

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
    -Description "Tu dong git pull/push kien thuc Claude (.claude/, CLAUDE.md) moi 15 phut, va kiem tra link trong skill. Xem CLAUDE.md." `
    -Force | Out-Null

Write-Host "[XONG] Da tao task. Kiem tra:"
Get-ScheduledTask -TaskName $TaskName |
    Select-Object TaskName, State |
    Format-Table -AutoSize

Write-Host "Chay thu ngay bay gio (khong can doi 15 phut):"
Write-Host "  Start-ScheduledTask -TaskName `"$TaskName`""
Write-Host ""
Write-Host "Xem lan chay gan nhat:"
Write-Host "  Get-ScheduledTaskInfo -TaskName `"$TaskName`""
