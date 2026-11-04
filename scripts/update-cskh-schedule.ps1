# CAP NHAT lich task tra loi khach (khong xoa, chi sua trigger).
#
# Lich moi (chot 2026-11-03):
#   01:00 - 10:00  =>  60 phut / lan
#   10:00 - 19:00  =>  20 phut / lan
#   19:00 - 01:00  =>  15 phut / lan
#
# Chay tren PC truc (DESKTOP-N7T8LNP):
#   powershell -ExecutionPolicy Bypass -File scripts\update-cskh-schedule.ps1
#
# Neu muon chi dinh ten task khac:
#   powershell -ExecutionPolicy Bypass -File scripts\update-cskh-schedule.ps1 -TaskName "Ten task cu"

param(
    [string]$TaskName = ""
)

$ErrorActionPreference = "Stop"

# --- Buoc 1: Liet ke tat ca task co "Claude" trong ten ---
Write-Host "=== Danh sach task co 'Claude' tren PC nay ===" -ForegroundColor Cyan
$allClaudeTasks = Get-ScheduledTask | Where-Object { $_.TaskName -like "*Claude*" }
if ($allClaudeTasks.Count -eq 0) {
    Write-Host "  (Khong tim thay task nao)" -ForegroundColor Yellow
} else {
    $allClaudeTasks | Select-Object TaskName, State | Format-Table -AutoSize
}

# --- Buoc 2: Xac dinh ten task can sua ---
if ($TaskName -eq "") {
    # Thu cac ten pho bien
    $candidates = @(
        "Claude - Tra loi khach",
        "Claude - CSKH",
        "Claude - Size consultation",
        "Claude - Tra loi tin nhan"
    )
    foreach ($c in $candidates) {
        if (Get-ScheduledTask -TaskName $c -ErrorAction SilentlyContinue) {
            $TaskName = $c
            Write-Host "Tim thay task: '$TaskName'" -ForegroundColor Green
            break
        }
    }
}

if ($TaskName -eq "") {
    Write-Host ""
    Write-Host "[CAN LAM TAY] Khong tu dong tim thay ten task CSKH." -ForegroundColor Yellow
    Write-Host "Xem danh sach o tren, chon dung ten roi chay lai:"
    Write-Host '  powershell -ExecutionPolicy Bypass -File scripts\update-cskh-schedule.ps1 -TaskName "Ten task cua ban"'
    exit 0
}

# --- Buoc 3: Kiem tra task ton tai ---
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $existingTask) {
    Write-Host "[LOI] Khong tim thay task '$TaskName'." -ForegroundColor Red
    Write-Host "Xem danh sach o tren va chay lai voi ten chinh xac."
    exit 1
}

Write-Host ""
Write-Host "Dang cap nhat task: '$TaskName'" -ForegroundColor Cyan

# --- Buoc 4: Tao 3 trigger moi ---
#
# Trigger 1: 01:00, lap 60 phut, trong 9 gio (het luc 10:00)
$t1 = New-ScheduledTaskTrigger -Daily -At "01:00" `
    -RepetitionInterval (New-TimeSpan -Hours 1) `
    -RepetitionDuration (New-TimeSpan -Hours 9)

# Trigger 2: 10:00, lap 20 phut, trong 9 gio (het luc 19:00)
$t2 = New-ScheduledTaskTrigger -Daily -At "10:00" `
    -RepetitionInterval (New-TimeSpan -Minutes 20) `
    -RepetitionDuration (New-TimeSpan -Hours 9)

# Trigger 3: 19:00, lap 15 phut, trong 6 gio (het luc 01:00)
$t3 = New-ScheduledTaskTrigger -Daily -At "19:00" `
    -RepetitionInterval (New-TimeSpan -Minutes 15) `
    -RepetitionDuration (New-TimeSpan -Hours 6)

# --- Buoc 5: Cap nhat (giu nguyen Action, Settings; chi doi Trigger) ---
Set-ScheduledTask -TaskName $TaskName -Trigger @($t1, $t2, $t3) | Out-Null

Write-Host "[XONG] Da cap nhat lich." -ForegroundColor Green
Write-Host ""
Write-Host "Lich moi:"
Write-Host "  01:00 - 10:00  =>  60 phut / lan"
Write-Host "  10:00 - 19:00  =>  20 phut / lan"
Write-Host "  19:00 - 01:00  =>  15 phut / lan"
Write-Host ""
Write-Host "Kiem tra:"
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State | Format-Table -AutoSize
Get-ScheduledTaskInfo -TaskName $TaskName | Select-Object LastRunTime, NextRunTime | Format-Table -AutoSize
