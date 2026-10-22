#!/usr/bin/env bash
# Dong bo kien thuc (.claude/skills + CLAUDE.md) giua may Mac va PC Windows qua git.
# Chay dau moi phien lam viec, va truoc moi lan chay task theo lich.
# Chay duoc 2 chieu: tu dong commit+push thay doi cuc bo, roi keo ban moi nhat ve.

set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR" || exit 1

if [ ! -d .git ]; then
  echo "[LOI] $REPO_DIR khong phai git repo. Can clone lai:"
  echo "      git clone https://github.com/nguyentheminh0610-ai/so-van-hanh-pwa.git"
  exit 1
fi

echo "[1/3] Commit thay doi kien thuc con sot lai (.claude/, CLAUDE.md)..."
git add -A .claude CLAUDE.md 2>/dev/null
if ! git diff --cached --quiet 2>/dev/null; then
  if git diff --cached | grep -qiE "ghp_|github_pat_|sk-ant-|BEGIN (RSA|OPENSSH) PRIVATE KEY"; then
    echo "[DUNG] Phat hien co the co secret trong thay doi. Khong commit. Kiem tra bang:"
    echo "       git diff --cached"
    exit 1
  fi
  git commit -m "Dong bo kien thuc tu $(hostname) $(date '+%Y-%m-%d %H:%M')" || true
else
  echo "      (khong co thay doi moi)"
  git reset --quiet 2>/dev/null || true
fi

echo "[2/3] Keo ban moi nhat tu GitHub..."
# --autostash: tu cat cac thay doi dang lam do (vd app.js) roi tra lai nguyen ven,
# neu khong rebase se bao "cannot pull with rebase: You have unstaged changes".
if ! git pull --rebase --autostash origin main; then
  echo "[LOI] Pull that bai (co the dang xung dot). Xu ly thu cong roi chay lai."
  exit 1
fi

echo "[3/3] Day len GitHub..."
git push origin main || echo "[CANH BAO] Push that bai - kiem tra mang/quyen."

echo "[4/4] Kiem tra tham chieu trong .claude/ co tro dung file that khong..."
if command -v python3 >/dev/null 2>&1; then
  python3 scripts/check-skill-links.py || echo "[CANH BAO] Co link hong o tren - sua roi commit lai."
else
  echo "      (bo qua: khong co python3)"
fi

echo "[XONG] Kien thuc da dong bo. Commit moi nhat:"
git log --oneline -1
