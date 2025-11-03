const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 生成 Chrome 扩展打包所需的私钥文件
 * 生成的私钥应添加到 GitHub Secrets 中（CRX_PRIVATE_KEY）
 * 以确保所有版本使用相同的签名
 */

const privateKeyPath = path.join(__dirname, '..', 'private-key.pem');

console.log('🔑 Chrome 扩展私钥生成工具\n');

// 检查私钥是否已存在
if (fs.existsSync(privateKeyPath)) {
  console.log('⚠️  私钥文件已存在：', privateKeyPath);
  console.log('如果要重新生成，请先删除此文件');
  console.log('⚠️  警告：覆盖私钥会导致之前使用旧私钥签名的 CRX 文件无法更新\n');
  
  // 读取并显示现有私钥内容
  const privateKeyContent = fs.readFileSync(privateKeyPath, 'utf8');
  console.log('='.repeat(80));
  console.log('📋 现有私钥内容（可用于添加到 GitHub Secrets）：');
  console.log('='.repeat(80));
  console.log('Secret 名称：CRX_PRIVATE_KEY');
  console.log('Secret 值：\n');
  console.log(privateKeyContent);
  console.log('='.repeat(80));
  process.exit(0);
}

console.log('正在生成私钥文件...');
console.log('文件路径：', privateKeyPath);

let privateKeyContent = '';

// 方法1: 尝试使用 openssl（如果可用）
try {
  console.log('尝试使用 OpenSSL 生成私钥...');
  execSync(`openssl genrsa -out "${privateKeyPath}" 2048`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  
  if (fs.existsSync(privateKeyPath)) {
    privateKeyContent = fs.readFileSync(privateKeyPath, 'utf8');
    console.log('✅ 使用 OpenSSL 生成私钥成功');
  }
} catch (error) {
  console.log('⚠️  OpenSSL 不可用，尝试使用 Node.js 生成...');
  
  // 方法2: 使用 node-rsa 生成私钥
  try {
    const NodeRSA = require('node-rsa');
    const key = new NodeRSA({ b: 2048 });
    
    // 导出为 PKCS#1 格式（与 OpenSSL 兼容）
    privateKeyContent = key.exportKey('pkcs1-private-pem');
    
    // 保存到文件
    fs.writeFileSync(privateKeyPath, privateKeyContent);
    console.log('✅ 使用 Node.js 生成私钥成功');
  } catch (nodeError) {
    console.error('\n❌ 生成私钥失败：', nodeError.message);
    console.error('\n💡 解决方案：');
    console.error('1. 安装 OpenSSL：');
    console.error('   - Windows: 安装 Git for Windows 或 OpenSSL');
    console.error('   - macOS: brew install openssl');
    console.error('   - Linux: sudo apt-get install openssl');
    console.error('\n2. 或者确保已安装 node-rsa: npm install');
    console.error('\n3. 或者使用在线工具生成 RSA 私钥：');
    console.error('   https://8gwifi.org/rsakeygenerator.jsp');
    console.error('   选择 "PKCS#1 (2048 bits)" 格式，然后保存为 private-key.pem');
    process.exit(1);
  }
}

if (fs.existsSync(privateKeyPath) && privateKeyContent) {
  const stats = fs.statSync(privateKeyPath);
  console.log('\n✅ 私钥文件生成成功！');
  console.log(`📁 文件路径：${privateKeyPath}`);
  console.log(`📦 文件大小：${(stats.size / 1024).toFixed(2)} KB\n`);
  
  console.log('='.repeat(80));
  console.log('📋 请将以下私钥内容添加到 GitHub Secrets：');
  console.log('='.repeat(80));
  console.log('Secret 名称：CRX_PRIVATE_KEY');
  console.log('Secret 值（复制以下全部内容）：\n');
  console.log(privateKeyContent);
  console.log('\n' + '='.repeat(80));
  console.log('\n📝 添加步骤：');
  console.log('1. 访问 GitHub 仓库设置：Settings → Secrets and variables → Actions');
  console.log('2. 点击 "New repository secret"');
  console.log('3. 名称输入：CRX_PRIVATE_KEY');
  console.log('4. 值粘贴上面的私钥内容（包含 -----BEGIN RSA PRIVATE KEY----- 和 -----END RSA PRIVATE KEY-----）');
  console.log('5. 点击 "Add secret"');
  console.log('\n✅ 添加完成后，GitHub Actions 将使用此私钥对所有版本进行签名，确保签名一致性\n');
} else {
  console.error('\n❌ 私钥文件生成失败');
  process.exit(1);
}

