# CAI DAT MOT LAN tren PC truc: Task `Claude - Watchdog` (0 token).
# Chay 30 phut/lan + 2 phut sau khi PC khoi dong. Xem scripts/watchdog.py.
#   powershell -ExecutionPolicy Bypass -File scripts\setup-watchdog-task.ps1
$ErrorActionPreference = "Stop"
$RepoDir = Split-Path -Parent $PSScriptRoot
$py = (Get-Command python).Source
# 26/11/2026: dung pythonw.exe (khong co cua so console). python.exe bat 1 cua so den
# moi 30 phut -> game fullscreen cua chu shop bi day ra desktop.
$pyw = Join-Path (Split-Path -Parent $py) "pythonw.exe"
if (Test-Path $pyw) { $py = $pyw }
$name = "Claude - Watchdog"
$a1 = New-ScheduledTaskAction -Execute $py -Argument "scripts\watchdog.py" -WorkingDirectory $RepoDir
$t1 = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 30)
$t2 = New-ScheduledTaskTrigger -AtStartup; $t2.Delay = "PT2M"
$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew
$desc = "Canh he thong 0 token: bao Telegram khi review-return-check ket, phieu gui bu dung im."
try { Register-ScheduledTask -TaskName $name -Action $a1 -Trigger @($t1,$t2) -Settings $s -Description $desc -Force | Out-Null }
catch {
  # Trigger AtStartup can quyen Admin. Khong co -> chi lap 30 phut; StartWhenAvailable van chay bu ngay sau khi PC bat lai.
  Register-ScheduledTask -TaskName $name -Action $a1 -Trigger $t1 -Settings $s -Description $desc -Force | Out-Null
}
Write-Host "[OK] Da tao $name"
