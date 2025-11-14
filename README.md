# 灵动搜索 (Ling Dong Search)

<div align="center">

一个功能强大、高度可定制的Chrome浏览器新标签页扩展

[![下载最新版](https://img.shields.io/badge/下载-CRX文件-blue?style=for-the-badge&logo=google-chrome)](https://github.com/shanddl/lingdong-search/releases/latest)
[![Releases](https://img.shields.io/badge/查看所有版本-Release-green?style=for-the-badge&logo=github)](https://github.com/shanddl/lingdong-search/releases)

**🔗 直接下载链接（始终指向最新版本）：**
```
ZIP: https://github.com/shanddl/lingdong-search/releases/latest/download/lingdong-search.zip
CRX: https://github.com/shanddl/lingdong-search/releases/latest/download/lingdong-search.crx
```

> **提示**：这些链接会自动指向最新版本的文件，无需手动更新版本号。每次发布新版本时，固定文件名的文件会自动更新为最新版本。

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[功能特性](#-功能特性) • [安装使用](#-安装使用) • [项目架构](#-项目架构) • [开发指南](#-开发指南)

</div>

---

## ✨ 功能特性

### 🔍 智能搜索
- **多引擎切换** - 支持多个搜索引擎（Google、Bing、百度等），可自定义添加
- **搜索范围限定** - 精确控制搜索范围，支持站点限定、文件类型、时间范围等
- **搜索建议** - 实时搜索建议、历史记录、书签搜索
- **AI搜索集成** - 快速访问AI搜索工具（Kimi、秘塔等）

### 📌 导航管理
- **快速导航** - 自定义导航图标，支持分组管理
- **拖拽排序** - 直观的拖拽操作，自由调整顺序
- **右键菜单** - 快捷编辑、删除、新标签页打开
- **Popup快捷添加** - 浏览任何网站时一键添加到导航

### 🎨 外观定制
- **位置调整** - 搜索框位置、大小完全可定制
- **样式选择** - 多种导航图标形状（方形、胶囊形）
- **对齐方式** - 导航项左对齐、居中、右对齐
- **尺寸控制** - 图标大小、间距、密度独立调整

### 🔐 安全与性能
- **XSS防护** - 完整的输入验证和HTML转义
- **CSP策略** - 严格的内容安全策略
- **双重存储** - chrome.storage + localStorage 双重备份
- **防抖节流** - 优化搜索和UI交互性能
- **错误捕获** - 全局错误处理和日志记录

---

## 🚀 安装使用

### 方式一：从 GitHub Releases 安装（推荐）

1. **下载 CRX 文件**
   - **方式一（推荐）**：直接使用上面的固定下载链接，始终获取最新版本
   - **方式二**：点击上方 **"下载最新版"** 按钮跳转到 Releases 页面
   - **方式三**：访问 [Releases](https://github.com/shanddl/lingdong-search/releases) 页面查看所有版本

2. **安装扩展**
   - 打开 Chrome 浏览器
   - 访问 `chrome://extensions/`
   - 启用"开发者模式"（右上角）
   - 将下载的 `.crx` 文件拖拽到页面中完成安装

3. **开始使用**
   - 打开新标签页，即可看到灵动搜索界面
   - 点击扩展图标可快速添加当前网站到导航

### 方式二：开发模式安装

1. **克隆或下载项目**
   ```bash
   git clone <repository-url>
   cd 新标签本地版
   ```

2. **加载扩展**
   - 打开 Chrome 浏览器
   - 访问 `chrome://extensions/`
   - 启用"开发者模式"（右上角）
   - 点击"加载已解压的扩展程序"
   - 选择项目文件夹

## 📁 项目架构

### 模块说明

#### 核心模块
- **main.js** - 应用入口，协调各模块初始化
- **core.js** - 数据加载/保存、设置应用、搜索执行
- **state.js** - 全局状态管理
- **config.js** - 环境配置（开发/生产）

#### 功能模块
- **search.js** - 搜索建议、历史记录、AI搜索
- **navigation.js** - 导航项管理、拖拽排序、右键菜单
- **ai-settings.js** - AI网站管理和配置

#### 工具模块
- **security.js** - XSS防护、URL验证、输入清理
- **logger.js** - 分级日志系统
- **errorHandler.js** - 全局错误捕获和处理
- **eventManager.js** - 事件监听器统一管理

---

## 🛠️ 开发指南

### 技术栈

- **原生JavaScript** (ES6+) - 无外部依赖
- **CSS3** - 现代样式特性
- **Chrome Extension API** - Manifest V3

---

## 🔒 安全特性

### XSS防护
- 所有用户输入经过 `sanitizer.escapeHtml()` 转义
- URL经过 `sanitizer.sanitizeUrl()` 验证
- 使用 `textContent` 而非 `innerHTML`

### CSP策略
```javascript
"content_security_policy": {
    "extension_pages": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;"
}
```

### 输入验证
- `validator.validateEngineUrl()` - 验证搜索引擎URL
- `validator.validateSiteUrl()` - 验证网站URL
- `validator.cleanName()` - 清理和验证名称

---

## 📝 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- 图标服务: [icon.bqb.cool](https://icon.bqb.cool)
- 搜索引擎API: Google, Bing, 百度等

---

## 📮 联系方式

如有问题或建议，欢迎通过以下方式联系：

- 提交 Issue
- 发起 Pull Request

---

<div align="center">

**灵动搜索** - 让每个新标签页都与众不同

Made with ❤️ using native JavaScript

</div>

