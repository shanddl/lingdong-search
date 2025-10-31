const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 使用 crx 包构建 Chrome 扩展
 */

const manifestPath = path.join(__dirname, '..', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '1.0.0';
const extensionName = manifest.name.replace(/\s+/g, '-').toLowerCase();

const outputFile = path.join(__dirname, '..', `${extensionName}-v${version}.crx`);
const privateKeyPath = path.join(__dirname, '..', 'private-key.pem');

// 检查私钥是否存在
if (!fs.existsSync(privateKeyPath)) {
  console.error('❌ 错误: 未找到私钥文件 private-key.pem');
  console.log('💡 提示: 运行以下命令生成私钥:');
  console.log('   openssl genrsa -out private-key.pem 2048');
  process.exit(1);
}

try {
  console.log('🚀 开始构建 CRX 文件...');
  console.log(`📝 扩展名: ${manifest.name}`);
  console.log(`📝 版本: ${version}`);
  console.log(`📁 输出文件: ${outputFile}`);

  // 尝试使用 crx 命令
  try {
    execSync(`npx crx pack . -o "${outputFile}" -p "${privateKeyPath}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ CRX 文件构建成功！');
  } catch (error) {
    console.log('⚠️ crx 命令失败，尝试使用 crx3...');
    try {
      execSync(`npx crx3 pack . -p "${privateKeyPath}" -o "${outputFile}"`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      console.log('✅ CRX 文件构建成功！');
    } catch (error2) {
      console.error('❌ 构建失败，请确保已安装 crx 或 crx3:');
      console.error('   npm install -g crx');
      console.error('   或');
      console.error('   npm install -g crx3');
      process.exit(1);
    }
  }

  // 检查文件是否生成
  if (fs.existsSync(outputFile)) {
    const stats = fs.statSync(outputFile);
    console.log(`📦 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📍 文件位置: ${outputFile}`);
  }

} catch (error) {
  console.error('❌ 构建过程出错:', error.message);
  process.exit(1);
}

