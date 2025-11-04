# PowerShell 脚本：将私钥添加到 GitHub Secrets
# 需要提供 GitHub Personal Access Token

param(
    [string]$Token = $env:GITHUB_TOKEN
)

$REPO_OWNER = "shanddl"
$REPO_NAME = "lingdong-search"
$SECRET_NAME = "CRX_PRIVATE_KEY"
$PRIVATE_KEY_PATH = "private-key.pem"

if (-not $Token) {
    Write-Host "❌ 错误：需要提供 GitHub Personal Access Token" -ForegroundColor Red
    Write-Host ""
    Write-Host "使用方法："
    Write-Host "  方法1：设置环境变量"
    Write-Host "    `$env:GITHUB_TOKEN='your_token'"
    Write-Host "    .\scripts\add-github-secret.ps1"
    Write-Host ""
    Write-Host "  方法2：直接传递参数"
    Write-Host "    .\scripts\add-github-secret.ps1 -Token 'your_token'"
    Write-Host ""
    Write-Host "如何获取 Token："
    Write-Host "1. 访问 https://github.com/settings/tokens"
    Write-Host "2. 点击 'Generate new token' → 'Generate new token (classic)'"
    Write-Host "3. 勾选权限：repo (所有仓库权限)"
    Write-Host "4. 生成并复制 Token"
    exit 1
}

if (-not (Test-Path $PRIVATE_KEY_PATH)) {
    Write-Host "❌ 错误：私钥文件不存在" -ForegroundColor Red
    Write-Host "文件路径：$PRIVATE_KEY_PATH"
    Write-Host ""
    Write-Host "请先运行：npm run generate-key"
    exit 1
}

$privateKey = Get-Content $PRIVATE_KEY_PATH -Raw
$privateKey = $privateKey.Trim()

Write-Host "🔑 准备添加 GitHub Secret..." -ForegroundColor Cyan
Write-Host "仓库：$REPO_OWNER/$REPO_NAME"
Write-Host "Secret 名称：$SECRET_NAME"
Write-Host "私钥文件：$PRIVATE_KEY_PATH"
Write-Host ""

# GitHub API 需要先获取 public key，然后使用 public key 加密 secret
# 1. 获取 repository public key
Write-Host "📡 步骤1：获取仓库 Public Key..." -ForegroundColor Yellow
$publicKeyUrl = "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/secrets/public-key"
$headers = @{
    "Accept" = "application/vnd.github.v3+json"
    "Authorization" = "token $Token"
    "User-Agent" = "PowerShell-Script"
}

try {
    $publicKeyResponse = Invoke-RestMethod -Uri $publicKeyUrl -Method Get -Headers $headers
    $publicKey = $publicKeyResponse.key
    $keyId = $publicKeyResponse.key_id
    
    Write-Host "✅ 成功获取 Public Key" -ForegroundColor Green
    Write-Host "Key ID: $keyId"
} catch {
    Write-Host "❌ 获取 Public Key 失败" -ForegroundColor Red
    Write-Host "错误：$($_.Exception.Message)"
    Write-Host ""
    Write-Host "请检查："
    Write-Host "1. Token 是否有正确的权限（需要 repo 权限）"
    Write-Host "2. 仓库名称是否正确"
    exit 1
}

# 2. 加密 secret
# GitHub 使用 libsodium sealed box 加密
# 在 PowerShell 中加密比较复杂，需要 libsodium 或 Node.js

Write-Host ""
Write-Host "⚠️  注意：GitHub Secrets API 需要 libsodium 加密" -ForegroundColor Yellow
Write-Host "PowerShell 原生不支持 libsodium，建议使用以下方法之一："
Write-Host ""

# 方法1：使用 Node.js 脚本
Write-Host "📋 方法一：使用 Node.js 脚本（推荐）" -ForegroundColor Cyan
Write-Host "如果安装了 Node.js，可以运行："
Write-Host "  npm install sodium-native"
Write-Host "  然后运行：node scripts/add-secret-node.js"
Write-Host ""

# 方法2：使用 GitHub CLI
Write-Host "📋 方法二：使用 GitHub CLI（最简单）" -ForegroundColor Cyan
Write-Host "1. 安装 GitHub CLI: https://cli.github.com/"
Write-Host "2. 登录: gh auth login"
Write-Host "3. 添加 Secret:"
Write-Host "   gh secret set $SECRET_NAME --repo $REPO_OWNER/$REPO_NAME < $PRIVATE_KEY_PATH"
Write-Host ""

# 方法3：手动添加
Write-Host "📋 方法三：通过网页手动添加" -ForegroundColor Cyan
Write-Host "1. 访问：https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
Write-Host "2. 点击 'New repository secret'"
Write-Host "3. Name: $SECRET_NAME"
Write-Host "4. Secret: 粘贴以下内容"
Write-Host ""
Write-Host ("=" * 80)
Write-Host $privateKey
Write-Host ("=" * 80)
Write-Host ""

Write-Host "✅ 添加成功后，GitHub Actions 将自动使用此私钥进行签名" -ForegroundColor Green










