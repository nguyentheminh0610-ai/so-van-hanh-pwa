# Entry point cho Task Scheduler tren PC truc: dong bo kien thuc MOI NHAT roi chay
# task tra loi tin nhan khach.
#
# QUAN TRONG: luon goi file NAY tu Task Scheduler, dung goi thang "claude -p",
# vi buoc dong bo o duoi la thu dam bao PC khong chay bang kien thuc cu.
#
# Cai dat trong Task Scheduler:
#   Program/script : powershell.exe
#   Arguments      : -ExecutionPolicy Bypass -File C:\sokho\so-van-hanh-pwa\scripts\run-chat-reply.ps1
#   Start in       : C:\sokho\so-van-hanh-pwa
#   Trigger 1      : hang ngay, lap lai moi 15 phut, tu 09:00 den 02:00 hom sau
#   Trigger 2      : hang ngay, lap lai moi 1 gio,  tu 02:00 den 09:00

$ErrorActionPreference = "Continue"
$RepoDir = Split-Path -Parent $PSScriptRoot
Set-Location $RepoDir

$LogDir = Join-Path $RepoDir "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$LogFile = Join-Path $LogDir ("chat-reply-" + (Get-Date -Format "yyyy-MM-dd") + ".log")

function Log($msg) {
    $line = "[" + (Get-Date -Format "HH:mm:ss") + "] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

Log "=== Bat dau phien tra loi khach ==="

# Buoc 1: dong bo kien thuc moi nhat (bat buoc, khong duoc bo qua)
Log "Dong bo kien thuc tu GitHub..."
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-knowledge.ps1") 2>&1 |
    ForEach-Object { Add-Content -Path $LogFile -Value $_ }

# Buoc 2: chay task tra loi khach bang kien thuc vua dong bo
$prompt = @"
Dung skill size-consultation (doc ca .claude/skills/size-consultation/SKILL.md va
cac file trong references/ de lay quy tac moi nhat, va doc CLAUDE.md o goc du an).

Viec can lam: mo hop thu chat TikTok Shop Seller Center va Shopee Seller Center,
ra soat cac hoi thoai "Chua tra loi", xu ly dung pham vi skill (tu van size, chao
chung, hoi ton kho, dong hoi thoai da xong - phai doc ky ngu canh tung hoi thoai
truoc khi quyet dinh). Cac loai tin ngoai pham vi (khieu nai, giao thieu hang,
logistics, KOC/affiliate) thi KHONG tra loi, chi tong hop bao lai chu shop.

Cuoi phien: bao cao ngan gon da tra loi nhung ai, con lai nhung gi can chu shop xu ly.
"@

Log "Goi Claude Code..."
& claude -p $prompt 2>&1 | ForEach-Object { Add-Content -Path $LogFile -Value $_ }

Log "=== Ket thuc phien ==="
