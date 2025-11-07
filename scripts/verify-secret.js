const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * 验证 GitHub Secret 是否存在
 * 通过检查工作流运行日志来间接验证
 */

const REPO_OWNER = 'shanddl';
const REPO_NAME = 'lingdong-search';
const SECRET_NAME = 'CRX_PRIVATE_KEY';

console.log('🔍 验证 GitHub Secret 配置...\n');
console.log(`仓库：${REPO_OWNER}/${REPO_NAME}`);
console.log(`Secret 名称：${SECRET_NAME}\n`);

// 方法1: 检查工作流文件是否包含私钥恢复步骤
console.log('📋 方法1: 检查工作流配置...');
const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'build-crx.yml');

if (fs.existsSync(workflowPath)) {
  const workflowContent = fs.readFileSync(workflowPath, 'utf8');
  
  if (workflowContent.includes('Setup private key from secrets')) {
    console.log('✅ 工作流文件包含私钥恢复步骤');
  } else {
    console.log('⚠️  工作流文件未包含私钥恢复步骤');
    console.log('   需要更新工作流文件');
  }
  
  if (workflowContent.includes('CRX_PRIVATE_KEY')) {
    console.log('✅ 工作流文件引用了 CRX_PRIVATE_KEY Secret');
  } else {
    console.log('⚠️  工作流文件未引用 CRX_PRIVATE_KEY Secret');
  }
} else {
  console.log('❌ 工作流文件不存在');
}

console.log('\n📋 方法2: 检查本地配置...');

// 检查本地私钥文件
const privateKeyPath = path.join(__dirname, '..', 'private-key.pem');
if (fs.existsSync(privateKeyPath)) {
  console.log('✅ 本地私钥文件存在');
  const stats = fs.statSync(privateKeyPath);
  console.log(`   文件大小：${(stats.size / 1024).toFixed(2)} KB`);
} else {
  console.log('⚠️  本地私钥文件不存在');
}

console.log('\n📋 验证方法：');
console.log('='.repeat(80));
console.log('由于 GitHub Secrets 无法直接通过 API 查看内容，建议通过以下方式验证：\n');

console.log('方法一：查看 GitHub Actions 日志（最准确）');
console.log('1. 访问：https://github.com/shanddl/lingdong-search/actions');
console.log('2. 打开最近的工作流运行');
console.log('3. 查看 "Setup private key from secrets" 步骤的日志');
console.log('4. 如果看到 "✅ 私钥已恢复"，说明 Secret 已正确配置');
console.log('5. 如果看到 "⚠️ 未找到 CRX_PRIVATE_KEY Secret"，说明还未添加\n');

console.log('方法二：手动检查 GitHub Secrets 页面');
console.log('1. 访问：https://github.com/shanddl/lingdong-search/settings/secrets/actions');
console.log('2. 查看是否有名为 "CRX_PRIVATE_KEY" 的 Secret');
console.log('3. 如果存在，Secret 已正确添加\n');

console.log('方法三：触发测试工作流');
console.log('1. 推送到 main 分支或创建测试标签');
console.log('2. 查看工作流日志确认私钥是否正确恢复\n');

console.log('='.repeat(80));
console.log('\n💡 提示：如果 Secret 已添加，下次工作流运行时会看到 "✅ 私钥已恢复" 的日志\n');
























