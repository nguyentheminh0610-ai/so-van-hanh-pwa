@echo off
chcp 65001 >nul
cd /d C:\sokho\so-van-hanh-pwa
echo Dang mo Chrome rieng cho script KOC...
echo 1) Dang nhap TikTok Affiliate trong cua so Chrome vua hien ra.
echo 2) Vao duoc trang Trung tam lien ket thi quay lai cua so DEN nay, bam Enter.
echo.
py tools\koc_auto_sync.py --login
echo.
echo Xong. Co the dong cua so nay.
pause
