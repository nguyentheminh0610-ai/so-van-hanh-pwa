@echo off
chcp 65001 >nul
cd /d C:\sokho\so-van-hanh-pwa
echo Dang mo Chrome rieng (cung Chrome voi script KOC).
echo 1) Dang nhap TikTok Shop Seller o tab 1 va Shopee Kenh Nguoi Ban o tab 2.
echo    (Shopee hoi mat khau muc Tai Chinh thi tu nhap giup.)
echo 2) Dang nhap xong thi DONG cua so Chrome do.
echo.
py tools\tai_file_san.py --login ca-hai
echo.
echo Xong. Co the dong cua so nay.
pause
