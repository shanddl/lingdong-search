# 设置迁移备份 - 20251030

## 备份说明
本次备份是为了将所有设置整合到统一的侧边栏面板中（方案一：Tab分类）

## 备份文件
1. `index.html.bak` - 包含所有模态框HTML结构
2. `style.css.bak` - 包含外观设置面板的所有CSS样式
3. `effects-panel.js.bak` - 外观设置面板的JavaScript逻辑
4. `handlers.js.bak` - 包含set-panel-theme等action处理器

## 现有设置模块
- ✅ 外观设置（effects-settings-panel）- 已在侧边栏
- ⏳ 搜索引擎管理（manage-engines-modal）
- ⏳ 搜索范围管理（manage-scopes-modal）
- ⏳ AI设置（ai-settings-modal）
- ⏳ 通用设置（settings-modal）
- ⏳ 时间过滤器管理（manage-time-filters-modal）
- ⏳ 文件过滤器管理（manage-file-filters-modal）
- ⏳ 导航组管理（manage-nav-groups-modal）

## 迁移计划
### 第一阶段：创建框架
- 创建带Tab栏的统一设置面板
- 实现Tab切换逻辑和动画

### 第二阶段：迁移外观设置
- 将现有effects-settings-panel改造为Tab内容区
- 保持现有的流畅动画和交互

### 第三阶段：逐步迁移其他设置
- 搜索Tab：引擎、范围、AI
- 导航Tab：导航组管理
- 系统Tab：数据管理

## 恢复方法
如果出现问题，复制backup中的.bak文件覆盖原文件即可。

