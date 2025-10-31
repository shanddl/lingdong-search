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
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      try {
        const filePath = path.join(dir, file);
        const relativePath = path.relative(path.join(__dirname, '..'), filePath);
        
        // 规范化路径，统一使用正斜杠
        const normalizedPath = relativePath.replace(/\\/g, '/');
        
        if (shouldExclude(normalizedPath)) {
          return;
        }
        
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          getAllFiles(filePath, fileList);
        } else {
          fileList.push({
            path: filePath,
            relative: normalizedPath
          });
        }
      } catch (err) {
        // 忽略单个文件的错误，继续处理其他文件
        console.warn(`警告: 无法处理文件 ${file}: ${err.message}`);
      }
    });
  } catch (err) {
    console.error(`错误: 无法读取目录 ${dir}: ${err.message}`);
  }
  
  return fileList;
}

async function createZip(outputFile) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFile);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    let hasError = false;

    output.on('close', () => {
      if (!hasError) {
        console.log(`✅ ZIP文件创建成功: ${outputFile}`);
        console.log(`📦 文件大小: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
        resolve();
      }
    });

    output.on('error', (err) => {
      hasError = true;
      reject(new Error(`输出流错误: ${err.message}`));
    });

    archive.on('error', (err) => {
      hasError = true;
      reject(new Error(`压缩错误: ${err.message}`));
    });

    archive.pipe(output);

    const rootDir = path.join(__dirname, '..');
    console.log(`📂 扫描目录: ${rootDir}`);
    const files = getAllFiles(rootDir);
    
    console.log(`📋 找到 ${files.length} 个文件需要打包`);
    
    if (files.length === 0) {
      hasError = true;
      reject(new Error('没有找到需要打包的文件'));
      return;
    }

    files.forEach(file => {
      try {
        if (fs.existsSync(file.path)) {
          archive.file(file.path, { name: file.relative });
        } else {
          console.warn(`警告: 文件不存在，跳过: ${file.path}`);
        }
      } catch (err) {
        console.warn(`警告: 无法添加文件 ${file.relative}: ${err.message}`);
      }
    });

    archive.finalize();
  });
}

async function buildCRX() {
  console.log('🚀 开始构建 Chrome 扩展...');
  console.log(`📝 扩展名: ${manifest.name}`);
  console.log(`📝 版本: ${version}`);
  
  // 直接使用ZIP打包（最可靠）
  // ZIP文件可以作为Chrome扩展安装（开发者模式下）
  console.log('📦 使用ZIP打包方式（兼容Chrome扩展安装）...');
  const zipFile = path.join(__dirname, '..', `${extensionName}-v${version}.zip`);
  
  console.log(`📁 输出文件: ${zipFile}`);
  
  // 确保输出目录存在
  const outputDir = path.dirname(zipFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  await createZip(zipFile);
  console.log(`✅ ZIP文件创建成功，可以作为扩展包使用`);
  
  // 验证文件是否存在
  if (!fs.existsSync(zipFile)) {
    throw new Error('ZIP文件创建失败，文件不存在');
  }
  
  return zipFile;
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

