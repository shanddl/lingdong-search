const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

/**
 * 自动添加 GitHub Secret 的智能脚本
 * 尝试多种方法自动完成操作
 */

const REPO_OWNER = 'shanddl';
const REPO_NAME = 'lingdong-search';
const SECRET_NAME = 'CRX_PRIVATE_KEY';
const privateKeyPath = path.join(__dirname, '..', 'private-key.pem');

console.log('🔑 自动添加 GitHub Secret 工具\n');

// 检查私钥文件
if (!fs.existsSync(privateKeyPath)) {
  console.error('❌ 私钥文件不存在');
  console.error('请先运行：npm run generate-key');
  process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8').trim();

// 方法1: 尝试使用 GitHub CLI (gh)
console.log('📋 方法1: 尝试使用 GitHub CLI...');
try {
  execSync('gh --version', { stdio: 'ignore' });
  console.log('✅ 检测到 GitHub CLI');
  
  // 检查是否已登录
  try {
    execSync('gh auth status', { stdio: 'ignore' });
    console.log('✅ GitHub CLI 已登录');
    
    console.log('\n🚀 正在使用 GitHub CLI 添加 Secret...');
    const result = execSync(
      `gh secret set ${SECRET_NAME} --repo ${REPO_OWNER}/${REPO_NAME}`,
      { 
        input: privateKey,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf8'
      }
    );
    
    console.log('✅ Secret 添加成功！');
    console.log(`验证：https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/secrets/actions`);
    process.exit(0);
  } catch (error) {
    console.log('⚠️  GitHub CLI 未登录');
    console.log('请运行：gh auth login');
    console.log('然后再次运行此脚本\n');
  }
} catch (error) {
  console.log('⚠️  未安装 GitHub CLI\n');
}

// 方法2: 尝试使用环境变量中的 Token
console.log('📋 方法2: 检查环境变量中的 Token...');
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (token) {
  console.log('✅ 检测到 GitHub Token');
  
  try {
    // 检查是否安装了 sodium-native
    require.resolve('sodium-native');
    console.log('✅ 检测到加密库');
    
    console.log('\n🚀 正在使用 GitHub API 添加 Secret...');
    require('./add-secret-node.js');
    process.exit(0);
  } catch (error) {
    console.log('⚠️  需要安装加密库');
    console.log('正在安装 sodium-native...');
    try {
      execSync('npm install sodium-native --save-dev', { stdio: 'inherit' });
      console.log('✅ 安装完成，再次尝试...');
      require('./add-secret-node.js');
      process.exit(0);
    } catch (installError) {
      console.log('❌ 安装失败，请手动安装：npm install sodium-native');
    }
  }
} else {
  console.log('⚠️  未找到 GitHub Token 环境变量');
  console.log('设置方法：');
  console.log('  Windows: set GITHUB_TOKEN=your_token');
  console.log('  Linux/macOS: export GITHUB_TOKEN=your_token\n');
}

// 方法3: 打开浏览器辅助页面
console.log('📋 方法3: 打开浏览器辅助页面...');
const htmlPath = path.join(__dirname, 'open-github-secrets.html');

if (fs.existsSync(htmlPath)) {
  try {
    const platform = process.platform;
    let command;
    
    if (platform === 'win32') {
      command = `start "" "${htmlPath}"`;
    } else if (platform === 'darwin') {
      command = `open "${htmlPath}"`;
    } else {
      command = `xdg-open "${htmlPath}"`;
    }
    
    execSync(command, { stdio: 'ignore' });
    console.log('✅ 已在浏览器中打开辅助页面');
    console.log('\n📝 请按照页面提示完成操作：');
    console.log('1. 复制私钥内容');
    console.log('2. 打开 GitHub Secrets 页面');
    console.log('3. 添加 Secret（名称：CRX_PRIVATE_KEY）');
    process.exit(0);
  } catch (error) {
    console.log('❌ 无法打开浏览器');
    console.log(`手动打开：${htmlPath}\n`);
  }
} else {
  console.log('⚠️  辅助页面文件不存在\n');
}

// 如果所有方法都失败，显示手动操作指南
console.log('='.repeat(80));
console.log('📋 手动操作指南');
console.log('='.repeat(80));
console.log('由于无法自动完成，请按以下步骤手动添加：');
console.log('\n1. 访问：https://github.com/shanddl/lingdong-search/settings/secrets/actions');
console.log('2. 点击 "New repository secret"');
console.log('3. Name: CRX_PRIVATE_KEY');
console.log('4. Secret: 粘贴以下内容\n');
console.log('='.repeat(80));
console.log(privateKey);
console.log('='.repeat(80));
console.log('\n5. 点击 "Add secret"');
console.log('\n✅ 完成后，GitHub Actions 将自动使用此私钥进行签名');























