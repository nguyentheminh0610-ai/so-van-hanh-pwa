# CAI DAT MOT LAN tren PC truc: tao Task Scheduler "Claude - Tai file thang".
# Tu dong tai bo file THANG TRUOC (TikTok + Shopee) -> Google Drive -> So Van Hanh. 0 token.
# Chot 18/11/2026 (chu shop Minh): ngay 1 co so thang truoc (tam), tu ngay 15 cap nhat lai
# cac don da hoan thanh (ghi de cung ky). Xem .claude\shared\reference_tai_file_tu_dong.md.
#
# TRUOC KHI CHAY: dang nhap TikTok + Shopee vao Chrome rieng 1 lan (bam dup scripts\dang-nhap-tai-file.bat).
# Chay 1 lan:   powershell -ExecutionPolicy Bypass -File scripts\setup-tai-file-task.ps1
# Chay thu ngay: Start-ScheduledTask -TaskName "Claude - Tai file thang"
# Go bo:        Unregister-ScheduledTask -TaskName "Claude - Tai file thang" -Confirm:$false

$ErrorActionPreference = "Stop"

$RepoDir  = Split-Path -Parent $PSScriptRoot
$RunFile  = Join-Path $PSScriptRoot "run-tai-file.ps1"
$VbsFile  = Join-Path $PSScriptRoot "run-hidden.vbs"
$TaskName = "Claude - Tai file thang"

if (-not (Test-Path $RunFile)) { Write-Host "[LOI] Khong thay $RunFile"; exit 1 }

# Dung wscript + run-hidden.vbs de KHONG nhay cua so (xem ghi chu trong run-hidden.vbs).
$action = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument "//B //Nologo `"$VbsFile`" `"$RunFile`"" `
    -WorkingDirectory $RepoDir

# Chay HANG NGAY 05:30: Task Scheduler khong co trigger "ngay 1 va 15"; runner tu kiem
# ngay + marker nen thuc te chi tai DUNG 1 lan moi moc (1 va 15); cac ngay khac thoat ngay.
# Task loi thi hom sau tu thu lai (chua co marker). Khong chay cung luc voi "Dong bo KOC" (09:00)
# vi chung 1 profile Chrome.
$trigger = New-ScheduledTaskTrigger -Daily -At 5:30AM

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 60) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force `
    -Description "Ngay 1 + 15 hang thang: tu tai file thang truoc tu TikTok/Shopee -> Drive -> So Van Hanh. 0 token. Xem tools/chay_tai_file.py." | Out-Null

# Don task cu (ban 31/10 chua tung cai tren PC, phong khi co)
foreach ($old in @("Claude - Tai file tuan")) {
    if (Get-ScheduledTask -TaskName $old -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $old -Confirm:$false
    }
}

Write-Host "[XONG] Da tao task:"
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State | Format-Table -AutoSize
Write-Host "Chay thu ngay:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Xem log:        Get-Content logs\tai-file.log -Tail 50"
