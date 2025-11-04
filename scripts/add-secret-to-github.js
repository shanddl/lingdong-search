const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * 将私钥添加到 GitHub Secrets
 * 需要提供 GitHub Personal Access Token (PAT)
 * Token 需要 repo 和 secrets 权限
 */

const REPO_OWNER = 'shanddl';
const REPO_NAME = 'lingdong-search';
const SECRET_NAME = 'CRX_PRIVATE_KEY';
const privateKeyPath = path.join(__dirname, '..', 'private-key.pem');

// 从环境变量或命令行参数获取 GitHub Token
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.argv[2];

if (!GITHUB_TOKEN) {
  console.error('❌ 错误：需要提供 GitHub Personal Access Token');
  console.error('\n使用方法：');
  console.error('  方法1：设置环境变量');
  console.error('    set GITHUB_TOKEN=your_token (Windows)');
  console.error('    export GITHUB_TOKEN=your_token (Linux/macOS)');
  console.error('    node scripts/add-secret-to-github.js');
  console.error('\n  方法2：直接传递参数');
  console.error('    node scripts/add-secret-to-github.js your_token');
  console.error('\n如何获取 Token：');
  console.error('1. 访问 https://github.com/settings/tokens');
  console.error('2. 点击 "Generate new token" → "Generate new token (classic)"');
  console.error('3. 勾选权限：');
  console.error('   - repo (所有仓库权限)');
  console.error('   - write:packages (如果需要)');
  console.error('4. 生成并复制 Token');
  process.exit(1);
}

if (!fs.existsSync(privateKeyPath)) {
  console.error('❌ 错误：私钥文件不存在');
  console.error(`文件路径：${privateKeyPath}`);
  console.error('\n请先运行：npm run generate-key');
  process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8').trim();

console.log('🔑 准备添加 GitHub Secret...');
console.log(`仓库：${REPO_OWNER}/${REPO_NAME}`);
console.log(`Secret 名称：${SECRET_NAME}`);
console.log(`私钥文件：${privateKeyPath}\n`);

// 使用 GitHub API 添加 Secret
// 需要使用 libsodium-wrappers 加密 Secret
// 这是一个简化版本，实际需要：
// 1. 获取仓库的 public key
// 2. 使用 public key 加密 secret
// 3. 发送加密后的 secret

console.log('⚠️  注意：GitHub Secrets API 需要加密处理');
console.log('由于需要额外的加密库，建议使用以下方法手动添加：\n');

console.log('📋 方法一：使用 GitHub CLI (推荐)');
console.log('1. 安装 GitHub CLI: https://cli.github.com/');
console.log('2. 登录: gh auth login');
console.log('3. 添加 Secret:');
console.log(`   gh secret set ${SECRET_NAME} --repo ${REPO_OWNER}/${REPO_NAME} < ${privateKeyPath}`);
console.log('   或直接输入内容:');
console.log(`   echo "${privateKey.replace(/\n/g, '\\n')}" | gh secret set ${SECRET_NAME} --repo ${REPO_OWNER}/${REPO_NAME}\n`);

console.log('📋 方法二：通过网页添加（最简单）');
console.log('1. 访问：https://github.com/shanddl/lingdong-search/settings/secrets/actions');
console.log('2. 点击 "New repository secret"');
console.log('3. Name: CRX_PRIVATE_KEY');
console.log('4. Secret: 粘贴以下内容\n');
console.log('='.repeat(80));
console.log(privateKey);
console.log('='.repeat(80));

console.log('\n📋 方法三：使用 PowerShell 脚本');
console.log('如果安装了 GitHub CLI，可以运行：');
console.log(`gh secret set CRX_PRIVATE_KEY --repo shanddl/lingdong-search --body "${privateKey.replace(/"/g, '\\"')}"`);

console.log('\n✅ 添加成功后，GitHub Actions 将自动使用此私钥进行签名\n');










