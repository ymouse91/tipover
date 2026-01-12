@echo off
REM Vaihda tähän kansio, jossa HTML/PWA-tiedostosi sijaitsevat
cd /d "%~dp0"

REM Näytä koneen paikallinen IP-osoite (esim. 192.168.1.123)
echo Your local IP addresses:
ipconfig | findstr /i "IPv4"

REM Käynnistä Pythonin HTTP-palvelin portissa 8007
echo Starting Python HTTP server at port 8007...
python -m http.server 8007 --bind 0.0.0.0

pause
