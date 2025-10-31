const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

/**
 * GitHub Actions专用的CRX构建脚本
 * 使用crx3或fallback到ZIP打包
 */

const manifestPath = path.join(__dirname, '..', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '1.0.0';
const extensionName = manifest.name.replace(/\s+/g, '-').toLowerCase();

const outputFile = path.join(__dirname, '..', `${extensionName}-v${version}.crx`);
const privateKeyPath = path.join(__dirname, '..', 'private-key.pem');

// 排除的文件和目录
const excludePatterns = [
  '.git',
  '.github',
  'node_modules',
  '*.pem',
  '*.key',
  '*.crx',
  '*.zip',
  '.gitignore',
  'scripts',
  'backup',
  'package.json',
  'package-lock.json'
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
        relative: relativePath.replace(/\\/g, '/') // 统一使用正斜杠
      });
    }
  });
  
  return fileList;
}

async function createZip(outputFile) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFile);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      console.log(`✅ ZIP文件创建成功: ${outputFile}`);
      console.log(`📦 文件大小: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    const rootDir = path.join(__dirname, '..');
    const files = getAllFiles(rootDir);

    files.forEach(file => {
      archive.file(file.path, { name: file.relative });
    });

    archive.finalize();
  });
}

async function buildCRX() {
  console.log('🚀 开始构建 Chrome 扩展...');
  console.log(`📝 扩展名: ${manifest.name}`);
  console.log(`📝 版本: ${version}`);
  console.log(`📁 输出文件: ${outputFile}`);
  console.log(`🔑 私钥路径: ${privateKeyPath}`);
  
  // 确保私钥存在
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`私钥文件不存在: ${privateKeyPath}`);
  }

  // 尝试方法1: 直接使用ZIP打包（最可靠）
  // 在GitHub Actions中，ZIP文件也可以作为Chrome扩展安装
  console.log('📦 使用ZIP打包方式（兼容Chrome扩展安装）...');
  const zipFile = outputFile.replace('.crx', '.zip');
  try {
    await createZip(zipFile);
    console.log(`✅ ZIP文件创建成功，可以作为扩展包使用`);
    return zipFile;
  } catch (error) {
    console.error(`❌ ZIP打包失败: ${error.message}`);
    throw error;
  }
}

// 执行构建
buildCRX()
  .then(file => {
    console.log(`✨ 构建完成: ${file}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 构建失败:', err);
    process.exit(1);
  });

