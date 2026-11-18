# CAI DAT MOT LAN tren PC truc: Task Scheduler chay MOI GIO dong bo "hoan ve chua nhan" (Sapo -> Supabase).
# Khong ton token AI. Chay: powershell -ExecutionPolicy Bypass -File scripts\setup-sync-returns-task.ps1
# Chay thu: Start-ScheduledTask -TaskName "Claude - Dong bo hoan ve"
# Go bo:    Unregister-ScheduledTask -TaskName "Claude - Dong bo hoan ve" -Confirm:$false
$ErrorActionPreference = "Stop"
$RepoDir  = Split-Path -Parent $PSScriptRoot
$RunFile  = Join-Path $PSScriptRoot "run-sync-returns-feed.ps1"
$Hidden   = Join-Path $PSScriptRoot "run-hidden.vbs"
$TaskName = "Claude - Dong bo hoan ve"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "//B //Nologo `"$Hidden`" `"$RunFile`"" -WorkingDirectory $RepoDir
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours 1)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "Moi gio: dong bo phieu tra hang Sapo -> Supabase (Hoan ve chua nhan tren So Kho). 0 token. Xem scripts/sync_returns_feed.py." -Force | Out-Null
Write-Host "[XONG] Da tao task:"
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State | Format-Table -AutoSize
