# CAI DAT MOT LAN tren PC truc: tao Task Scheduler tu dong check danh gia &
# tra hang (TikTok Shop + Shopee), nhan khach doi ly do neu la loi shop.
# Chay 2 lan/ngay: 08:00 va 20:00.
#
# Chay 1 lan duy nhat tren PC (DESKTOP-N7T8LNP):
#   cd C:\sokho\so-van-hanh-pwa
#   powershell -ExecutionPolicy Bypass -File scripts\setup-review-return-task.ps1
#
# Go bo sau nay (neu can):
#   Unregister-ScheduledTask -TaskName "Claude - Check danh gia tra hang" -Confirm:$false

$ErrorActionPreference = "Stop"

$RepoDir  = Split-Path -Parent $PSScriptRoot
$TaskName = "Claude - Check danh gia tra hang"

# Tim claude.exe
$claudeCmd = (Get-Command claude -ErrorAction SilentlyContinue)
if (-not $claudeCmd) {
    # Thu duong dan mac dinh cua Claude Code tren Windows
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\claude\claude.exe",
        "$env:LOCALAPPDATA\AnthropicClaude\claude.exe",
        "C:\Users\$env:USERNAME\AppData\Local\Programs\claude\claude.exe"
    )
    $claudeExe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $claudeExe) {
        Write-Host "[LOI] Khong tim thay claude.exe. Dang nhap mac dinh hoac chi dinh duong dan."
        Write-Host "      Kiem tra: Get-Command claude"
        exit 1
    }
} else {
    $claudeExe = $claudeCmd.Source
}

Write-Host "Repo      : $RepoDir"
Write-Host "Claude    : $claudeExe"
Write-Host "Ten task  : $TaskName"
Write-Host ""

# Kiem tra task cu (tranh cai chong)
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[CANH BAO] Task '$TaskName' da ton tai. Dang ghi de..."
}

$action = New-ScheduledTaskAction `
    -Execute $claudeExe `
    -Argument "--print --dangerously-skip-permissions -p `"/review-return-check`"" `
    -WorkingDirectory $RepoDir

# 2 trigger: 08:00 va 20:00 moi ngay
$t1 = New-ScheduledTaskTrigger -Daily -At "08:00"
$t2 = New-ScheduledTaskTrigger -Daily -At "20:00"

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($t1, $t2) `
    -Settings $settings `
    -Description "Check danh gia & tra hang TikTok Shop + Shopee, nhan khach doi ly do neu la loi shop. Chay 08:00 & 20:00. Skill: review-return-check." `
    -Force | Out-Null

Write-Host "[XONG] Da tao task:"
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State | Format-Table -AutoSize
Write-Host ""
Get-ScheduledTaskInfo -TaskName $TaskName | Select-Object LastRunTime, NextRunTime | Format-Table -AutoSize
Write-Host "Chay thu ngay:  Start-ScheduledTask -TaskName `"$TaskName`""
Write-Host "Xem ket qua:    Get-ScheduledTaskInfo -TaskName `"$TaskName`""
