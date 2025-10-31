@echo off
chcp 65001 >nul
echo.
echo ============================================
echo  灵动搜索扩展 - 快速部署
echo ============================================
echo.

set /p GITHUB_USER="请输入你的 GitHub 用户名: "
set /p REPO_NAME="请输入仓库名（默认: lingdong-search）: "

if "%REPO_NAME%"=="" set REPO_NAME=lingdong-search

echo.
echo 正在检查并配置远程仓库...
echo.

git remote remove origin 2>nul
git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git

echo.
echo ⚠️  请确保已在 GitHub 上创建了仓库: %REPO_NAME%
echo    如果还没有，请访问: https://github.com/new
echo.
pause

echo.
echo 正在推送代码到 GitHub...
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo ❌ 推送失败！请检查：
    echo    1. 是否已在 GitHub 上创建了仓库
    echo    2. 网络连接是否正常
    echo    3. 是否有仓库的推送权限
    pause
    exit /b 1
)

echo.
echo ✅ 代码推送成功！
echo.
echo 正在创建版本 Tag...
git tag v1.0.0
git push origin v1.0.0

echo.
echo ============================================
echo 🎉 部署完成！
echo ============================================
echo.
echo 📦 仓库地址:
echo    https://github.com/%GITHUB_USER%/%REPO_NAME%
echo.
echo 📥 Releases（2-3分钟后查看）:
echo    https://github.com/%GITHUB_USER%/%REPO_NAME%/releases
echo.
echo ⚙️  Actions（查看构建状态）:
echo    https://github.com/%GITHUB_USER%/%REPO_NAME%/actions
echo.
echo 💡 GitHub Actions 会自动构建 CRX 文件
echo.
pause

