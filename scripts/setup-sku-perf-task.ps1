# CAI DAT MOT LAN tren PC truc: tao Task Scheduler tu dong cap nhat tab
# "Hieu suat SKU" cua So Van Hanh moi 2 NGAY (keo don Hoan thanh tu Sapo ->
# sku-performance.json -> push -> Vercel deploy). Khong ton token AI.
#
# Dieu kien: ~/.config/sapo/credentials.json da co tren PC (store/api_key/api_secret),
# va git da cau hinh push duoc len repo so-van-hanh-pwa.
#
# Chay 1 lan:
#   cd C:\sokho\so-van-hanh-pwa
#   powershell -ExecutionPolicy Bypass -File scripts\setup-sku-perf-task.ps1
#
# Chay thu ngay (khong doi lich):
#   Start-ScheduledTask -TaskName "Claude - Hieu suat SKU"
#
# Go bo:
#   Unregister-ScheduledTask -TaskName "Claude - Hieu suat SKU" -Confirm:$false

$ErrorActionPreference = "Stop"

$RepoDir   = Split-Path -Parent $PSScriptRoot
$RunFile   = Join-Path $PSScriptRoot "run-sku-perf.ps1"
$TaskName  = "Claude - Hieu suat SKU"

if (-not (Test-Path $RunFile)) { Write-Host "[LOI] Khong thay $RunFile"; exit 1 }
if (-not (Test-Path (Join-Path $RepoDir ".git"))) { Write-Host "[LOI] $RepoDir khong phai git repo."; exit 1 }
$cred = Join-Path $HOME ".config\sapo\credentials.json"
if (-not (Test-Path $cred)) {
    Write-Host "[CANH BAO] Chua thay $cred - task van tao nhung se loi khi chay."
    Write-Host "           Copy credentials.json (store/api_key/api_secret) tu may Mac sang day truoc."
}

Write-Host "Repo    : $RepoDir"
Write-Host "Runner  : $RunFile"
Write-Host "Ten task: $TaskName`n"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunFile`"" `
    -WorkingDirectory $RepoDir

# Moi 2 ngay, 07:30 sang (sau khi may da thuc/online).
$trigger = New-ScheduledTaskTrigger -Daily -DaysInterval 2 -At 7:30AM

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Tu dong keo don Hoan thanh tu Sapo -> sku-performance.json -> push -> Vercel, moi 2 ngay. 0 token. Xem tools/sync_sku_performance.py." `
    -Force | Out-Null

Write-Host "[XONG] Da tao task:"
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State | Format-Table -AutoSize
Write-Host "Chay thu ngay bay gio:"
Write-Host "  Start-ScheduledTask -TaskName `"$TaskName`""
