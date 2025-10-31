const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

/**
 * 备用打包脚本 - 使用 zip + 签名方式创建 crx
 * 注意：这创建一个未签名的 zip 文件，Chrome 扩展可能需要手动签名
 */

const manifestPath = path.join(__dirname, '..', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '1.0.0';

// 需要排除的文件
const excludePatterns = [
  '.git',
  '.github',
  'node_modules',
  '*.pem',
  '*.key',
  '*.crx',
  '*.zip',
  '.gitignore',
  'package.json',
  'package-lock.json',
  'scripts',
  'backup'
];

function shouldExclude(filePath) {
  return excludePatterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  });
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);
    
    if (shouldExclude(relativePath)) {
      return;
    }
    
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push({
        path: filePath,
        relative: relativePath
      });
    }
  });
  
  return fileList;
}

async function packageExtension(outputFile, privateKeyPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFile);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      console.log(`✅ 打包完成: ${outputFile}`);
      console.log(`📦 文件大小: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // 添加所有文件
    const rootDir = path.join(__dirname, '..');
    const files = getAllFiles(rootDir);

    files.forEach(file => {
      archive.file(file.path, { name: file.relative });
    });

    archive.finalize();
  });
}

// 如果直接运行此脚本
if (require.main === module) {
  const outputFile = process.argv[2] || `lingdong-search-v${version}.zip`;
  const privateKeyPath = process.argv[3] || null;

  console.log('🚀 开始打包扩展...');
  console.log(`📝 版本: ${version}`);
  console.log(`📁 输出文件: ${outputFile}`);

  packageExtension(outputFile, privateKeyPath)
    .then(() => {
      console.log('✨ 打包成功！');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ 打包失败:', err);
      process.exit(1);
    });
}

module.exports = { packageExtension };

