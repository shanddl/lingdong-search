# 🚀 快速部署 - 3步完成

## ✅ 当前状态

代码已准备就绪，Git 仓库已初始化并完成提交。

## 📝 接下来你需要：

### 方式一：使用自动化脚本（推荐）

**1. 在 GitHub 上创建仓库**

访问 https://github.com/new 创建新仓库：
- 仓库名：`lingdong-search`（或其他你喜欢的名称）
- **⚠️ 重要**：不要勾选 "Initialize this repository with a README"

**2. 运行部署脚本**

在 PowerShell 中运行：
```powershell
.\deploy.ps1 -GitHubUser 你的GitHub用户名 -RepoName lingdong-search -Version 1.0.0
```

或在命令提示符中运行：
```cmd
deploy.bat
```

脚本会自动完成：
- ✅ 配置远程仓库
- ✅ 推送代码
- ✅ 创建版本 Tag
- ✅ 触发自动构建

---

### 方式二：手动命令（适合熟悉 Git 的用户）

**1. 创建 GitHub 仓库**

访问 https://github.com/new，创建名为 `lingdong-search` 的仓库

**2. 配置并推送**

```bash
# 替换 你的用户名 为实际 GitHub 用户名
git remote add origin https://github.com/你的用户名/lingdong-search.git
git push -u origin main
git tag v1.0.0
git push origin v1.0.0
```

---

## 🎯 完成后的结果

**仓库地址：**
```
https://github.com/你的用户名/lingdong-search
```

**Releases（2-3分钟后）：**
```
https://github.com/你的用户名/lingdong-search/releases
```

**CRX 下载链接（构建完成后）：**
```
https://github.com/你的用户名/lingdong-search/releases/download/v1.0.0/lingdong-search-v1.0.crx
```

**Actions（查看构建状态）：**
```
https://github.com/你的用户名/lingdong-search/actions
```

---

## 💡 提示

- GitHub Actions 会自动构建 CRX 文件，约需 2-3 分钟
- 构建完成后，在 Releases 页面下载 `.crx` 文件
- 如需保持扩展 ID 一致，建议配置 GitHub Secrets（见 README-DEPLOY.md）

---

**准备好了吗？** 告诉我你的 GitHub 用户名，我可以帮你直接配置并推送！

