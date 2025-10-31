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

async function buildCRX(crxOutputFile, privateKeyPath) {
  console.log('📦 尝试使用 crx3 打包 CRX 文件...');
  try {
    execSync(`npx -y crx3@1.1.15 . -p "${privateKeyPath}" -o "${crxOutputFile}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'production' },
      maxBuffer: 10 * 1024 * 1024
    });
    
    if (fs.existsSync(crxOutputFile)) {
      const stats = fs.statSync(crxOutputFile);
      console.log(`✅ CRX 文件构建成功！`);
      console.log(`📦 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      return crxOutputFile;
    } else {
      throw new Error('CRX文件未生成');
    }
  } catch (error) {
    console.log(`⚠️ crx3 构建失败: ${error.message}`);
    return null;
  }
}

async function buildExtension() {
  console.log('🚀 开始构建 Chrome 扩展...');
  console.log(`📝 扩展名: ${manifest.name}`);
  console.log(`📝 版本: ${version}`);
  
  const baseName = `${extensionName}-v${version}`;
  const zipFile = path.join(__dirname, '..', `${baseName}.zip`);
  const crxFile = path.join(__dirname, '..', `${baseName}.crx`);
  
  // 确保输出目录存在
  const outputDir = path.dirname(zipFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 生成私钥（如果不存在）
  if (!fs.existsSync(privateKeyPath)) {
    console.log('🔑 生成私钥文件...');
    execSync(`openssl genrsa -out "${privateKeyPath}" 2048`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
  }
  
  const files = [];
  
  // 1. 创建 ZIP 文件（总是创建）
  console.log('📦 创建 ZIP 文件...');
  await createZip(zipFile);
  if (fs.existsSync(zipFile)) {
    files.push(zipFile);
    console.log(`✅ ZIP文件创建成功: ${zipFile}`);
  } else {
    throw new Error('ZIP文件创建失败');
  }
  
  // 2. 尝试创建 CRX 文件
  const crxResult = await buildCRX(crxFile, privateKeyPath);
  if (crxResult && fs.existsSync(crxFile)) {
    files.push(crxFile);
  } else {
    console.log('⚠️ CRX文件生成失败，仅提供ZIP文件');
  }
  
  console.log(`✨ 构建完成，共生成 ${files.length} 个文件`);
  return files;
}

// 执行构建
buildExtension()
  .then(files => {
    files.forEach(file => {
      console.log(`📦 文件: ${file}`);
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 构建失败:', err);
    process.exit(1);
  });

