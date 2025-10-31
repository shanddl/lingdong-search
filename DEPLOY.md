# 部署指南

## GitHub Actions 自动构建

项目已配置 GitHub Actions 工作流，支持自动构建和发布 Chrome 扩展。

### 工作流触发条件

1. **推送代码到 main/master 分支**
   - 自动构建 CRX 文件
   - 上传构建产物到 Artifacts
   - **不会**自动创建 Release

2. **创建版本 Tag**
   - 自动构建 CRX 文件
   - 自动创建 GitHub Release
   - 上传 CRX 文件到 Release
   - 生成下载链接

3. **手动触发**
   - 在 GitHub Actions 页面可以手动触发工作流

### 创建 Release 的步骤

1. **更新版本号**
   ```json
   // manifest.json
   {
     "version": "1.0.2"  // 更新版本号
   }
   ```

2. **提交更改**
   ```bash
   git add manifest.json
   git commit -m "Bump version to 1.0.2"
   git push origin main
   ```

3. **创建版本 Tag**
   ```bash
   git tag -a v1.0.2 -m "Release version 1.0.2"
   git push origin v1.0.2
   ```

4. **GitHub Actions 会自动**
   - 检测到 Tag 推送
   - 构建 CRX 文件
   - 创建 Release
   - 上传 CRX 文件
   - 生成下载链接

### 查看构建结果

1. **访问 Actions 页面**
   - 前往 `https://github.com/你的用户名/lingdong-search/actions`
   - 查看最新的工作流运行状态

2. **下载构建产物**
   - 在 Actions 页面点击最新的工作流运行
   - 在 Artifacts 部分下载构建的 CRX 文件

3. **访问 Releases**
   - 前往 `https://github.com/你的用户名/lingdong-search/releases`
   - 查看所有已发布的版本和下载链接

### 直接下载链接格式

每次 Release 后，可以使用以下格式的固定链接：

```
https://github.com/shanddl/lingdong-search/releases/download/v{版本号}/lingdong-search-v{版本号}.crx
```

例如：
```
https://github.com/shanddl/lingdong-search/releases/download/v1.0.1/lingdong-search-v1.0.1.crx
```

### 本地构建

如果需要本地构建 CRX 文件：

```bash
# 安装依赖
npm install

# 构建 CRX（需要私钥）
npm run build

# 或打包为 ZIP
npm run package
```

### 注意事项

1. **私钥管理**
   - 私钥文件 `private-key.pem` 已加入 `.gitignore`
   - GitHub Actions 会自动生成临时私钥用于构建
   - 每次构建的私钥可能不同，如需持续更新，建议保存私钥到 GitHub Secrets

2. **版本号规范**
   - 遵循语义化版本控制（SemVer）
   - 格式：`主版本号.次版本号.修订号`（如：1.0.2）

3. **构建环境**
   - GitHub Actions 使用 Ubuntu 最新版
   - Node.js 版本：18
   - 自动缓存 npm 依赖

4. **构建产物**
   - CRX 文件（优先）
   - 如果 CRX 构建失败，会自动回退到 ZIP 打包

### 故障排查

1. **构建失败**
   - 检查 Actions 日志中的错误信息
   - 确认所有依赖已正确安装
   - 验证 manifest.json 格式正确

2. **Release 未创建**
   - 确认 Tag 名称以 `v` 开头（如：`v1.0.2`）
   - 检查 GitHub Token 权限

3. **CRX 文件无法安装**
   - 确保使用正确的私钥签名
   - 检查 manifest.json 版本是否匹配

