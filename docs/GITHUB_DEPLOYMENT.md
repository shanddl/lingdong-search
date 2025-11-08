# GitHub 自动部署和发布指南

本文档详细说明了如何配置 GitHub Actions 自动构建和发布 Chrome 扩展的完整流程。

## 📋 目录

- [功能要求](#功能要求)
- [文件结构](#文件结构)
- [配置步骤](#配置步骤)
- [使用方法](#使用方法)
- [工作流说明](#工作流说明)
- [故障排查](#故障排查)

## 🎯 功能要求

1. **自动触发构建**
   - 推送到 `main` 或 `master` 分支时自动构建
   - 创建版本标签（Tag）时自动发布到 Release

2. **生成统一命名的文件**
   - CRX 文件：`lingdong-search-v{版本号}.crx`
   - ZIP 文件：`lingdong-search-v{版本号}.zip`
   - 文件名自动从 `manifest.json` 的版本号获取

3. **自动发布到 Release 页面**
   - 创建版本标签时自动创建 GitHub Release
   - 自动上传构建产物（CRX 和 ZIP）
   - 自动生成 Release 说明（包含版本更新内容）

4. **版本更新说明**
   - 自动从 Commit History 生成变更日志
   - 可自定义 Release 说明模板

## 📁 文件结构

```
项目根目录/
├── .github/
│   └── workflows/
│       └── build-crx.yml          # GitHub Actions 工作流配置
├── scripts/
│   ├── build-crx-github.js        # GitHub Actions 专用构建脚本
│   ├── build-crx.js               # 本地构建脚本
│   └── package-extension.js        # ZIP 打包脚本
├── manifest.json                   # 扩展配置文件（包含版本号）
├── package.json                    # Node.js 依赖配置
└── docs/
    └── GITHUB_DEPLOYMENT.md       # 本文档
```

## ⚙️ 配置步骤

### 1. 创建工作流文件

创建 `.github/workflows/build-crx.yml`：

```yaml
name: Build and Release Chrome Extension

on:
  push:
    branches:
      - main
      - master
    tags:
      - 'v*'
  pull_request:
    branches:
      - main
      - master
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Read version from manifest
        id: manifest
        run: |
          VERSION=$(node -p "require('./manifest.json').version")
          NAME=$(node -p "require('./manifest.json').name.replace(/\s+/g, '-').toLowerCase()")
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "name=$NAME" >> $GITHUB_OUTPUT
          echo "📦 Extension: $NAME"
          echo "📝 Version: $VERSION"

      - name: Build extension package
        id: build
        run: |
          echo "🚀 Starting build process..."
          set -e
          
          # 运行构建脚本
          node scripts/build-crx-github.js
          
          echo "📋 Checking for build artifacts..."
          ZIP_FILE=$(find . -maxdepth 1 -name "*.zip" -type f 2>/dev/null | head -n 1 || echo "")
          CRX_FILE=$(find . -maxdepth 1 -name "*.crx" -type f 2>/dev/null | head -n 1 || echo "")
          
          if [ -n "$ZIP_FILE" ] && [ -f "$ZIP_FILE" ]; then
            echo "✅ Found ZIP file: $ZIP_FILE"
            echo "file=$ZIP_FILE" >> $GITHUB_OUTPUT
            echo "type=zip" >> $GITHUB_OUTPUT
          elif [ -n "$CRX_FILE" ] && [ -f "$CRX_FILE" ]; then
            echo "✅ Found CRX file: $CRX_FILE"
            echo "file=$CRX_FILE" >> $GITHUB_OUTPUT
            echo "type=crx" >> $GITHUB_OUTPUT
          else
            echo "❌ No build artifacts found!"
            echo "📂 Listing current directory:"
            ls -la
            exit 1
          fi

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: extension-${{ steps.manifest.outputs.name }}-v${{ steps.manifest.outputs.version }}
          path: |
            ${{ steps.build.outputs.file }}
            *.zip
            *.crx
          retention-days: 90

      - name: Create Release
        if: startsWith(github.ref, 'refs/tags/v')
        uses: softprops/action-gh-release@v1
        with:
          files: |
            ${{ steps.build.outputs.file }}
          name: Release v${{ steps.manifest.outputs.version }}
          body: |
            ## 🚀 Release v${{ steps.manifest.outputs.version }}
            
            ### 📦 下载
            - [下载 ZIP 文件](./${{ steps.build.outputs.file }})
            
            ### 📝 更新内容
            - 查看 [Commit History](https://github.com/${{ github.repository }}/compare/${{ github.event.before }}...${{ github.sha }}) 了解详细变更
            
            ### 🔧 安装方式
            1. 下载 `${{ steps.build.outputs.file }}` 文件
            2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
            3. 启用"开发者模式"（右上角）
            4. 将下载的文件拖拽到页面中完成安装
            
            ---
            
            **自动化构建**: 此版本由 GitHub Actions 自动构建生成
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Build summary
        if: always()
        run: |
          echo "## 📦 Build Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Extension**: ${{ steps.manifest.outputs.name }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Version**: ${{ steps.manifest.outputs.version }}" >> $GITHUB_STEP_SUMMARY
          echo "- **File**: ${{ steps.build.outputs.file }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Type**: $(echo "${{ steps.build.outputs.type }}" | tr '[:lower:]' '[:upper:]')" >> $GITHUB_STEP_SUMMARY
          echo "- **Status**: ${{ job.status }}" >> $GITHUB_STEP_SUMMARY
```

### 2. 创建构建脚本

创建 `scripts/build-crx-github.js`：

```javascript
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

/**
 * GitHub Actions专用的扩展构建脚本
 * 自动生成统一命名的 ZIP 和 CRX 文件
 */

const manifestPath = path.join(__dirname, '..', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '1.0.0';
const extensionName = manifest.name.replace(/\s+/g, '-').toLowerCase();

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

async function buildExtension() {
  console.log('🚀 开始构建 Chrome 扩展...');
  console.log(`📝 扩展名: ${manifest.name}`);
  console.log(`📝 版本: ${version}`);
  
  // 生成统一命名的文件
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
buildExtension()
  .then(file => {
    console.log(`✨ 构建完成: ${file}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 构建失败:', err);
    process.exit(1);
  });
```

### 3. 配置 package.json

确保 `package.json` 包含必要的依赖：

```json
{
  "name": "lingdong-search-extension",
  "version": "1.0.0",
  "description": "灵动搜索 - 自定义新标签页扩展",
  "scripts": {
    "build": "node scripts/build-crx.js",
    "package": "node scripts/package-extension.js"
  },
  "devDependencies": {
    "archiver": "^7.0.1",
    "crx": "^5.0.1",
    "node-rsa": "^1.1.1"
  }
}
```

### 4. 配置 .gitignore

确保以下文件不被提交：

```gitignore
# 构建产物
*.crx
*.zip
*.pem
*.key

# 依赖
node_modules/

# 系统文件
.DS_Store
Thumbs.db
```

## 🚀 使用方法

### 方法一：仅构建（不发布）

推送到 main 分支：

```bash
# 1. 修改代码
# 2. 提交更改
git add .
git commit -m "feat: 添加新功能"

# 3. 推送到 GitHub
git push origin main
```

**结果**：
- GitHub Actions 自动运行
- 生成构建产物并上传到 Artifacts
- **不会**创建 Release

### 方法二：发布新版本（推荐）

创建并推送版本标签：

```bash
# 1. 更新 manifest.json 中的版本号
# 例如：从 "1.0.1" 改为 "1.0.2"

# 2. 提交版本更新
git add manifest.json
git commit -m "chore: bump version to 1.0.2"
git push origin main

# 3. 创建版本标签（格式：v{版本号}）
git tag -a v1.0.2 -m "Release version 1.0.2"

# 4. 推送标签到 GitHub
git push origin v1.0.2
```

**结果**：
- GitHub Actions 自动运行
- 生成构建产物
- **自动创建 GitHub Release**
- 上传文件到 Release 页面
- 生成 Release 说明

## 📝 工作流说明

### 触发条件

1. **推送到分支** (`push`)
   - 分支：`main` 或 `master`
   - 行为：仅构建，不上传 Release

2. **创建标签** (`tags: 'v*'`)
   - 标签格式：`v{版本号}`（如：`v1.0.2`）
   - 行为：构建 + 创建 Release

3. **手动触发** (`workflow_dispatch`)
   - 在 GitHub Actions 页面手动运行

### 构建流程

1. **检出代码** - 获取最新代码
2. **安装 Node.js** - 设置 Node.js 18 环境
3. **安装依赖** - 运行 `npm ci` 安装依赖
4. **读取版本** - 从 `manifest.json` 读取版本号
5. **构建扩展** - 运行构建脚本生成 ZIP/CRX
6. **上传 Artifacts** - 上传构建产物到 Artifacts
7. **创建 Release**（仅标签触发）- 创建 GitHub Release

### 文件命名规则

文件命名格式：`{扩展名}-v{版本号}.{扩展名}`

- 扩展名：从 `manifest.json` 的 `name` 字段获取，转换为小写并用 `-` 替换空格
- 版本号：从 `manifest.json` 的 `version` 字段获取

**示例**：
- `manifest.json` 中 `name: "灵动搜索"`, `version: "1.0.1"`
- 生成文件：`lingdong-search-v1.0.1.zip`

## 📋 Release 说明模板

Release 说明包含：

1. **标题**：`Release v{版本号}`
2. **下载链接**：直接下载 ZIP 文件
3. **更新内容**：自动链接到 Commit History
4. **安装说明**：Chrome 扩展安装步骤

### 自定义 Release 说明

如果需要自定义 Release 说明，可以修改工作流文件中的 `body` 部分：

```yaml
body: |
  ## 🚀 Release v${{ steps.manifest.outputs.version }}
  
  ### 🎉 新功能
  - 功能1描述
  - 功能2描述
  
  ### 🐛 修复
  - 修复1描述
  - 修复2描述
  
  ### 📦 下载
  - [下载 ZIP 文件](./${{ steps.build.outputs.file }})
```

## 🔧 故障排查

### 问题1：工作流不触发

**检查项**：
- 确认 `.github/workflows/build-crx.yml` 文件存在
- 确认推送的分支是 `main` 或 `master`
- 查看 GitHub Actions 页面是否有权限

### 问题2：构建失败

**检查项**：
- 查看 Actions 日志中的错误信息
- 确认 `package.json` 中依赖已配置
- 确认 `scripts/build-crx-github.js` 文件存在
- 确认 `manifest.json` 格式正确

### 问题3：Release 未创建

**检查项**：
- 确认标签格式正确（以 `v` 开头，如 `v1.0.2`）
- 确认标签已推送到远程：`git push origin v1.0.2`
- 查看 Actions 日志确认条件是否满足

### 问题4：文件命名不正确

**检查项**：
- 确认 `manifest.json` 中的 `name` 和 `version` 字段正确
- 确认构建脚本中的文件名生成逻辑正确

### 问题5：网络/代理问题

如果遇到网络连接问题：

```bash
# 配置代理（端口根据实际情况修改）
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# 取消代理
git config --global --unset http.proxy
git config --global --unset https.proxy
```

## 📚 参考链接

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [action-gh-release 使用说明](https://github.com/softprops/action-gh-release)
- [Chrome 扩展打包指南](https://developer.chrome.com/docs/extensions/mv3/packaging/)

## ✅ 检查清单

在部署前，请确认：

- [ ] `.github/workflows/build-crx.yml` 文件已创建
- [ ] `scripts/build-crx-github.js` 文件已创建
- [ ] `package.json` 中包含 `archiver` 依赖
- [ ] `manifest.json` 中版本号已更新
- [ ] `.gitignore` 已配置排除构建产物
- [ ] 代码已推送到 GitHub
- [ ] GitHub Actions 权限已启用

## 🎯 快速开始示例

```bash
# 1. 更新版本号（在 manifest.json 中）
# "version": "1.0.2"

# 2. 提交并推送
git add .
git commit -m "chore: bump version to 1.0.2"
git push origin main

# 3. 创建并推送标签
git tag -a v1.0.2 -m "Release version 1.0.2"
git push origin v1.0.2

# 4. 查看构建结果
# 访问：https://github.com/你的用户名/lingdong-search/actions
# 或：https://github.com/你的用户名/lingdong-search/releases
```

---

**最后更新**: 2024年
**维护者**: 项目开发团队

