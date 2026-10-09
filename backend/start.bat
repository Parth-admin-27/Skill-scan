@echo off
echo Starting MongoDB...
start /B "MongoDB" "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath C:\data\db --bind_ip 127.0.0.1 --port 27017

timeout /t 3 /nobreak >nul

echo Starting SkillScan Backend Server...
cd /d "%~dp0"
node server.js

pause

