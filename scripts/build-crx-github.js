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

  // 尝试方法1: 使用crx3 (推荐)
  try {
    console.log('📦 尝试使用 crx3 打包...');
    execSync(`npx -y crx3@1.1.15 . -p "${privateKeyPath}" -o "${outputFile}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'production' },
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    if (fs.existsSync(outputFile)) {
      const stats = fs.statSync(outputFile);
      console.log(`✅ CRX 文件构建成功！`);
      console.log(`📦 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`📍 文件位置: ${outputFile}`);
      return outputFile;
    } else {
      throw new Error('CRX文件未生成');
    }
  } catch (error) {
    console.log(`⚠️ crx3 构建失败: ${error.message}`);
    console.log('📦 尝试其他方法...');
  }

  // 尝试方法2: 使用crx
  try {
    console.log('📦 尝试使用 crx 打包...');
    execSync(`npx -y crx@5.0.1 pack . -o "${outputFile}" -p "${privateKeyPath}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'production' },
      maxBuffer: 10 * 1024 * 1024
    });
    
    if (fs.existsSync(outputFile)) {
      const stats = fs.statSync(outputFile);
      console.log(`✅ CRX 文件构建成功！`);
      console.log(`📦 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`📍 文件位置: ${outputFile}`);
      return outputFile;
    } else {
      throw new Error('CRX文件未生成');
    }
  } catch (error) {
    console.log(`⚠️ crx 构建失败: ${error.message}`);
    console.log('📦 回退到 ZIP 打包方式...');
  }

  // Fallback: 创建ZIP文件
  const zipFile = outputFile.replace('.crx', '.zip');
  await createZip(zipFile);
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

