# 灵动搜索扩展 - 自动部署脚本
# 使用方法：.\deploy.ps1 -GitHubUser 你的用户名 -RepoName lingdong-search -Version 1.0.0

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubUser,
    
    [Parameter(Mandatory=$false)]
    [string]$RepoName = "lingdong-search",
    
    [Parameter(Mandatory=$false)]
    [string]$Version = "1.0.0"
)

Write-Host "🚀 开始部署流程..." -ForegroundColor Green
Write-Host ""

# 检查 git 状态
Write-Host "📋 检查 Git 状态..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "⚠️  检测到未提交的更改，是否提交？(Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq "Y" -or $response -eq "y") {
        git add .
        $commitMsg = Read-Host "请输入提交信息（默认：更新代码）"
        if ([string]::IsNullOrWhiteSpace($commitMsg)) {
            $commitMsg = "更新代码"
        }
        git commit -m $commitMsg
    }
}

# 检查远程仓库
Write-Host ""
Write-Host "🔗 配置远程仓库..." -ForegroundColor Yellow
$remoteUrl = "https://github.com/$GitHubUser/$RepoName.git"
$existingRemote = git remote get-url origin 2>$null

if ($existingRemote) {
    Write-Host "发现现有远程仓库: $existingRemote" -ForegroundColor Cyan
    $update = Read-Host "是否更新为 $remoteUrl ? (Y/N)"
    if ($update -eq "Y" -or $update -eq "y") {
        git remote set-url origin $remoteUrl
        Write-Host "✅ 远程仓库已更新" -ForegroundColor Green
    }
} else {
    Write-Host "添加远程仓库: $remoteUrl" -ForegroundColor Cyan
    git remote add origin $remoteUrl
    Write-Host "✅ 远程仓库已添加" -ForegroundColor Green
}

# 检查仓库是否存在
Write-Host ""
Write-Host "🔍 检查 GitHub 仓库是否存在..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://github.com/$GitHubUser/$RepoName" -Method Head -ErrorAction SilentlyContinue
    Write-Host "✅ 仓库已存在: https://github.com/$GitHubUser/$RepoName" -ForegroundColor Green
} catch {
    Write-Host "❌ 仓库不存在！请先访问以下链接创建仓库：" -ForegroundColor Red
    Write-Host "   https://github.com/new" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "仓库信息：" -ForegroundColor Yellow
    Write-Host "  - 仓库名: $RepoName"
    Write-Host "  - 描述: 灵动搜索 - Chrome 新标签页扩展"
    Write-Host "  - ⚠️  不要勾选 'Initialize this repository with a README'"
    Write-Host ""
    $continue = Read-Host "创建完成后按 Enter 继续..."
}

# 确保在 main 分支
Write-Host ""
Write-Host "🌿 检查分支..." -ForegroundColor Yellow
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "当前分支: $currentBranch，切换到 main..." -ForegroundColor Cyan
    git branch -M main
}

# 推送代码
Write-Host ""
Write-Host "📤 推送代码到 GitHub..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 代码推送成功！" -ForegroundColor Green
} else {
    Write-Host "❌ 推送失败，请检查网络连接和仓库权限" -ForegroundColor Red
    exit 1
}

# 创建并推送 Tag
Write-Host ""
Write-Host "🏷️  创建版本 Tag v$Version..." -ForegroundColor Yellow
git tag "v$Version"
git push origin "v$Version"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Tag 创建并推送成功！" -ForegroundColor Green
} else {
    Write-Host "⚠️  Tag 推送失败（Tag 可能已存在）" -ForegroundColor Yellow
}

# 输出结果
Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host "🎉 部署完成！" -ForegroundColor Green
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📦 仓库地址：" -ForegroundColor Cyan
Write-Host "   https://github.com/$GitHubUser/$RepoName" -ForegroundColor White
Write-Host ""
Write-Host "📥 Releases（2-3分钟后查看）：" -ForegroundColor Cyan
Write-Host "   https://github.com/$GitHubUser/$RepoName/releases" -ForegroundColor White
Write-Host ""
Write-Host "⚙️  Actions（查看构建状态）：" -ForegroundColor Cyan
Write-Host "   https://github.com/$GitHubUser/$RepoName/actions" -ForegroundColor White
Write-Host ""
Write-Host "🔗 CRX 下载链接（构建完成后）：" -ForegroundColor Cyan
Write-Host "   https://github.com/$GitHubUser/$RepoName/releases/download/v$Version/lingdong-search-v$Version.crx" -ForegroundColor White
Write-Host ""
Write-Host "💡 提示：GitHub Actions 会自动构建 CRX 文件，约需 2-3 分钟" -ForegroundColor Yellow
Write-Host ""

