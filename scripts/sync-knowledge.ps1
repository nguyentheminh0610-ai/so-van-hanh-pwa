# Dong bo kien thuc (.claude/skills + CLAUDE.md) giua PC Windows va may Mac qua git.
# Chay dau moi phien lam viec, va BAT BUOC chay truoc moi lan Task Scheduler goi claude -p.
# Chay duoc 2 chieu: tu dong commit+push thay doi cuc bo, roi keo ban moi nhat ve.

$ErrorActionPreference = "Continue"

$RepoDir = Split-Path -Parent $PSScriptRoot
Set-Location $RepoDir

if (-not (Test-Path (Join-Path $RepoDir ".git"))) {
    Write-Host "[LOI] $RepoDir khong phai git repo (co the la ban chep tay)."
    Write-Host "      Can clone lai bang lenh:"
    Write-Host "      git clone https://github.com/nguyentheminh0610-ai/so-van-hanh-pwa.git C:\sokho\so-van-hanh-pwa"
    exit 1
}

Write-Host "[1/3] Commit thay doi kien thuc con sot lai (.claude/, CLAUDE.md)..."
git add -A .claude CLAUDE.md 2>$null
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    $staged = git diff --cached
    if ($staged -match "ghp_|github_pat_|sk-ant-|BEGIN (RSA|OPENSSH) PRIVATE KEY") {
        Write-Host "[DUNG] Phat hien co the co secret trong thay doi. Khong commit."
        Write-Host "       Kiem tra bang: git diff --cached"
        exit 1
    }
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    git commit -m "Dong bo kien thuc tu PC $env:COMPUTERNAME $stamp"
} else {
    Write-Host "      (khong co thay doi moi)"
    git reset --quiet 2>$null
}

Write-Host "[2/3] Keo ban moi nhat tu GitHub..."
git pull --rebase origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "[LOI] Pull that bai (co the dang xung dot). Xu ly thu cong roi chay lai."
    exit 1
}

Write-Host "[3/3] Day len GitHub..."
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "[CANH BAO] Push that bai - kiem tra mang/quyen (repo public thi pull van chay duoc)."
}

Write-Host "[XONG] Kien thuc da dong bo. Commit moi nhat:"
git log --oneline -1
