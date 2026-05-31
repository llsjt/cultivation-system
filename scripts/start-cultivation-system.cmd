@echo off
cd /d "%~dp0.."
if not exist logs mkdir logs
echo [%date% %time%] Starting CultivationSystem from %CD%> logs\startup.log
where corepack>> logs\startup.log 2>&1
call corepack pnpm dev>> logs\startup.log 2>&1
echo [%date% %time%] Exited with %ERRORLEVEL%>> logs\startup.log
