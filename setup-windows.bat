@echo off
setlocal

REM ====================================================================
REM  电池化学料供需管理系统 Demo - Windows 离线依赖安装
REM  Usage: 双击或在 cmd 中执行 setup-windows.bat
REM  作用: 解压前端依赖压缩包，仅联网下载 Windows 原生二进制
REM ====================================================================

echo.
echo ========================================
echo   离线依赖安装脚本 (Windows)
echo ========================================
echo.

REM 1. 检查 Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [X] 未检测到 Node.js，请先安装 Node.js 18+
    echo     下载: https://nodejs.org/
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node --version') do echo [OK] Node.js 版本: %%v
for /f "delims=" %%v in ('npm --version') do echo [OK] npm 版本:    %%v
echo.

REM 2. 定位压缩包
set "TARBALL="
for %%f in (frontend-deps-*.tar.gz) do (
    set "TARBALL=%%f"
    goto :found
)

:found
if "%TARBALL%"=="" (
    echo [X] 未找到 frontend-deps-*.tar.gz，请确认已 git pull
    pause
    exit /b 1
)
echo [OK] 找到压缩包: %TARBALL%
echo.

REM 3. 检查 tar (Windows 10 1809+ 自带)
where tar >nul 2>nul
if errorlevel 1 (
    echo [X] 未检测到 tar 命令，需要 Windows 10 1809 或更高版本
    pause
    exit /b 1
)
echo [OK] tar 命令可用
echo.

REM 4. 解压到 node_modules
if exist node_modules (
    echo [!] node_modules 已存在，正在备份为 node_modules.bak ...
    if exist node_modules.bak rmdir /s /q node_modules.bak
    move node_modules node_modules.bak >nul
)

echo [*] 正在解压 %TARBALL% ...
tar -xzf "%TARBALL%"
if errorlevel 1 (
    echo [X] 解压失败，正在恢复备份 ...
    move node_modules.bak node_modules >nul
    pause
    exit /b 1
)
echo [OK] 解压完成
echo.

REM 5. 拉取 Windows 原生二进制（esbuild / rolldown / prisma / lightningcss / typescript）
echo [*] 正在拉取 Windows 原生二进制 ...
echo     这一步只会下载约 50MB，速度通常很快
echo.
call npm rebuild
if errorlevel 1 (
    echo [!] npm rebuild 失败，请尝试手动执行: npm install --registry=https://registry.npmmirror.com
    pause
    exit /b 1
)
echo [OK] 原生二进制安装完成
echo.

REM 6. 清理备份
if exist node_modules.bak (
    echo [*] 清理备份 ...
    rmdir /s /q node_modules.bak
)

echo.
echo ========================================
echo   [OK] 安装成功！现在可以运行:
echo.
echo      npm run db:reset   REM 首次重置数据库
echo      npm run dev        REM 启动前后端
echo.
echo   前端: http://localhost:5173
echo   后端: http://localhost:8000
echo ========================================
echo.
pause