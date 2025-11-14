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

### 自动构建和部署

**⚠️ 重要说明**：本项目支持两种部署方式，**每次部署时会询问用户是否从本地上传文件**。

| 部署方式 | 说明 | 特点 |
|---------|------|------|
| **方式一：从本地上传** | 触发 GitHub Actions 自动构建并发布 | ✅ 自动提交代码和创建标签<br>✅ 触发 GitHub Actions 自动构建 |
| **方式二：自动构建** | GitHub Actions 自动构建和上传（推荐，默认） | ✅ 完全自动化<br>✅ 构建环境一致 |

**部署流程**：

**方式一：从本地上传（触发 GitHub Actions）**
1. 运行 `npm run deploy`
2. **脚本会询问：是否从本地上传文件到 GitHub Releases？**
3. 选择 `y`：触发 GitHub Actions 自动构建并发布
   - 自动提交未提交的更改（需要确认）
   - 自动创建并推送版本标签
   - GitHub Actions 自动构建并上传到 Releases
4. 选择 `n`：手动推送代码和标签，使用 GitHub Actions 自动构建（推荐）

**方式二：自动构建（GitHub Actions）**
1. 推送代码到 `main` 或 `master` 分支（仅构建）
2. 创建版本 Tag（自动创建 Release 并提供下载链接）
3. GitHub Actions 自动构建 ZIP 和 CRX 文件
4. 构建产物自动上传到 GitHub Releases

**本地上传时的文件排除规则**：
- ❌ 不包含 `docs/` 目录（所有文档）
- ❌ 不包含 `*.md` 文件（Markdown 文档）
- ❌ 不包含 `scripts/` 目录（构建脚本）
- ✅ 只上传项目核心文件（manifest.json、HTML、CSS、JS 等）

**构建产物**：
- CRX 文件上传到 GitHub Releases
- ZIP 文件上传到 GitHub Releases
- 提供直接下载链接

详细部署说明请查看 [README-DEPLOY.md](README-DEPLOY.md)

### 生产环境配置

在发布前，建议修改以下配置：

```javascript
// js/config.js
const CURRENT_ENV = 'production';  // 从 'development' 改为 'production'
```

这将：
- 禁用调试日志输出
- 关闭性能监控
- 优化错误提示

---

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

### 开发环境配置

1. **启用开发模式**
   ```javascript
   // js/config.js
   const CURRENT_ENV = 'development';
   ```

2. **查看日志**
   - 打开开发者工具 (F12)
   - 日志会显示在Console标签
   - 包含模块名称和时间戳

3. **实时调试**
   - 修改代码后刷新扩展或新标签页即可看到效果
   - 使用 `logger.debug()` 输出调试信息

### 代码规范

#### 命名约定
- **变量/函数** - 驼峰命名法 (camelCase)
- **常量** - 大写下划线 (UPPER_SNAKE_CASE)
- **DOM元素** - 带dom前缀 (dom.searchInput)
- **模块** - 单数形式 (navigationModule, searchModule)

#### 模块导出
```javascript
// 导出对象
export const moduleName = {
    method1: () => {},
    method2: () => {}
};

// 导出函数
export function helperFunction() {}
```

#### 注释规范
```javascript
/**
 * 函数说明
 * @param {string} param1 - 参数说明
 * @returns {boolean} 返回值说明
 */
function exampleFunction(param1) {
    // 实现细节注释
    return true;
}
```

### 添加新功能

#### 1. 创建功能模块
```javascript
// js/features/myFeature.js
import { logger } from '../logger.js';

const log = logger.module('MyFeature');

export const myFeature = {
    init: () => {
        log.info('MyFeature initialized');
    },
    
    doSomething: () => {
        // 实现功能
    }
};
```

#### 2. 在main.js中引入
```javascript
import { myFeature } from './features/myFeature.js';

function init() {
    // ...
    myFeature.init();
    // ...
}
```

#### 3. 添加到constants.js（如需要）
```javascript
export const STATIC_CONFIG = {
    // ...
    MY_FEATURE_CONFIG: {
        option1: 'value1',
        option2: 'value2'
    }
};
```

### 调试技巧

#### 使用logger模块
```javascript
import { logger } from './logger.js';

// 创建模块专用logger
const log = logger.module('ModuleName');

// 不同级别的日志
log.debug('调试信息', data);
log.info('普通信息', data);
log.warn('警告信息', data);
log.error('错误信息', error);

// 性能监控
logger.performance.start('operation');
// 执行操作...
logger.performance.end('operation');
```

#### 查看错误日志
```javascript
// 在控制台执行
errorHandler.getErrorLog();    // 获取错误日志
errorHandler.exportErrorLog(); // 导出JSON格式日志
```

---

## 🔧 配置说明

### 环境配置 (config.js)

```javascript
export const config = {
    env: 'development',  // 'development' 或 'production'
    
    debug: {
        enableConsole: true,     // 是否启用控制台日志
        logLevel: 'debug',       // 日志级别: debug/info/warn/error
        enablePerformance: true, // 是否启用性能监控
        verboseErrors: true      // 是否显示详细错误堆栈
    },
    
    features: {
        bookmarkSearch: true,    // 书签搜索功能
        aiSearch: true           // AI搜索功能
    },
    
    performance: {
        debounceDelay: 300,      // 防抖延迟（毫秒）
        throttleDelay: 100,      // 节流延迟（毫秒）
        minSearchChars: 1,       // 触发搜索的最小字符数
        maxHistoryItems: 100     // 最大历史记录数
    }
};
```

### 时间常量 (constants.js)

所有时间相关的魔法数字已提取到 `STATIC_CONFIG.TIMING` 对象：

```javascript
TIMING: {
    DOUBLE_CLICK_THRESHOLD: 300,     // 双击检测时间窗口
    SEARCH_DEBOUNCE_DELAY: 150,      // 搜索建议防抖延迟
    SEARCH_BLUR_DELAY: 300,          // 搜索框失焦延迟
    PREVENT_HIDE_RESET_DELAY: 1000,  // 阻止隐藏标志重置时间
    TOAST_DURATION: 2000,            // Toast提示显示时间
    // ...更多
}
```

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

