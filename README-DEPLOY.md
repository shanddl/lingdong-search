# GitHub 部署和自动打包指南

## 📋 前置准备

### 1. 初始化 Git 仓库（如果还没有）

```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. 创建 GitHub 仓库并推送代码

1. 在 GitHub 上创建一个新仓库
2. 将本地代码推送到 GitHub：

```bash
git remote add origin https://github.com/你的用户名/你的仓库名.git
git branch -M main
git push -u origin main
```

### 3. 生成私钥（首次构建）

私钥用于签名 Chrome 扩展，**请妥善保管，不要泄露**。

#### 方法一：使用 OpenSSL（推荐）

```bash
openssl genrsa -out private-key.pem 2048
```

#### 方法二：在 GitHub Actions 中自动生成

首次运行工作流时，如果没有设置 `CRX_PRIVATE_KEY` secret，工作流会自动生成一个临时私钥。**请务必保存这个私钥**。

### 4. 配置 GitHub Secrets（可选但推荐）

为了在 GitHub Actions 中使用你的私钥：

1. 进入仓库 Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 名称填写：`CRX_PRIVATE_KEY`
4. 值填写：私钥文件的内容（`private-key.pem` 的完整内容）
5. 保存

**注意：** 如果不想设置 Secret，首次构建时会自动生成私钥，但每次构建都会生成新的，导致扩展ID变化。

## 🚀 自动打包触发方式

### 方式一：推送代码到 main/master 分支

每次推送到 `main` 或 `master` 分支时，会自动构建 CRX 文件，但不会创建 Release。

```bash
git add .
git commit -m "更新功能"
git push origin main
```

### 方式二：创建 Tag（推荐）

创建版本 Tag 会自动触发 Release 并生成下载链接：

```bash
# 更新 manifest.json 中的版本号
# 然后创建 Tag
git tag v1.0.0
git push origin v1.0.0
```

### 方式三：手动触发

1. 进入 GitHub 仓库
2. 点击 Actions 标签页
3. 选择 "Build and Release CRX" 工作流
4. 点击 "Run workflow"
5. 可选填写版本号
6. 点击 "Run workflow" 按钮

## 📥 下载 CRX 文件

### 从 Release 下载（推荐）

1. 进入 GitHub 仓库
2. 点击右侧的 "Releases"
3. 选择最新版本
4. 在 Assets 部分下载 `.crx` 文件

下载链接格式：
```
https://github.com/用户名/仓库名/releases/download/v版本号/扩展名-v版本号.crx
```

### 从 Artifacts 下载

1. 进入 Actions 标签页
2. 点击最新的工作流运行
3. 在页面底部找到 "Artifacts"
4. 下载 `crx-package` 压缩包

## 🔧 本地打包

如果想在本地打包测试：

```bash
# 安装依赖
npm install

# 确保有私钥文件
# 如果没有，生成一个：
openssl genrsa -out private-key.pem 2048

# 打包
npm run build
```

## 📝 版本管理

更新版本号：

1. 编辑 `manifest.json`，更新 `version` 字段
2. 提交并推送代码
3. 创建对应的 Tag：

```bash
git add manifest.json
git commit -m "更新到版本 1.0.1"
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

## ⚠️ 注意事项

1. **私钥安全**：私钥文件包含在 `.gitignore` 中，不会提交到仓库。请妥善保管你的私钥。

2. **扩展ID**：使用不同私钥签名的扩展会有不同的 ID。为了保持扩展 ID 一致，请始终使用同一个私钥。

3. **版本号**：每次发布新版本时，记得更新 `manifest.json` 中的版本号。

4. **Chrome 审核**：如果要在 Chrome 网上应用店发布，需要通过 Chrome Web Store 的审核流程，不能直接安装 `.crx` 文件。

## 🐛 故障排除

### 工作流失败

1. 检查 Actions 标签页中的错误信息
2. 确保 `manifest.json` 格式正确
3. 确保所有必需的文件都存在

### 私钥问题

- 如果提示找不到私钥，检查是否设置了 `CRX_PRIVATE_KEY` secret
- 或在本地创建 `private-key.pem` 文件后提交（不推荐，不安全）

### 打包失败

- 检查 Node.js 版本（需要 18+）
- 确保 `package.json` 和依赖正确安装
- 查看工作流日志中的详细错误信息

