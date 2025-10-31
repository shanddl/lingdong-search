# 🚀 快速部署指南

## 步骤 1：在 GitHub 上创建仓库

访问 https://github.com/new 创建新仓库：
- **仓库名称**：`lingdong-search` （或你喜欢的名称）
- **描述**：灵动搜索 - Chrome 新标签页扩展
- **可见性**：Public（公开）或 Private（私有）
- **⚠️ 不要勾选** "Initialize this repository with a README"（本地已有）

## 步骤 2：配置远程仓库并推送

创建仓库后，运行以下命令：

```bash
# 替换 你的用户名 为你的 GitHub 用户名
git remote add origin https://github.com/你的用户名/lingdong-search.git
git push -u origin main
```

## 步骤 3：触发自动构建

推送完成后，创建版本 Tag 以触发自动构建和 Release：

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 📥 查看构建结果

构建完成后（约 2-3 分钟），访问：
- **仓库地址**：`https://github.com/你的用户名/lingdong-search`
- **Releases**：`https://github.com/你的用户名/lingdong-search/releases`
- **Actions**：`https://github.com/你的用户名/lingdong-search/actions`

## 🎯 下载 CRX 文件

构建成功后，在 Releases 页面下载 `.crx` 文件，或使用直接链接：
```
https://github.com/你的用户名/lingdong-search/releases/download/v1.0.0/lingdong-search-v1.0.crx
```

## ⚙️ 配置 GitHub Secrets（可选但推荐）

为了保持扩展 ID 一致，建议设置私钥：

1. 在 GitHub 仓库：Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 名称：`CRX_PRIVATE_KEY`
4. 值：运行 `openssl genrsa -out private-key.pem 2048` 后，将 `private-key.pem` 的内容粘贴进去

