// =================================================================
// 静态配置和常量
// =================================================================
export const STATIC_CONFIG = {
    DEFAULT_USER_DATA: {
        searchHistory: [],
        searchEngines: [
            { id: 'engine_google', name: 'Google', url: 'https://www.google.com/search?q={query}', icon: 'https://www.google.com/favicon.ico', tab: '通用' },
            { id: 'engine_bing', name: 'Bing', url: 'https://www.bing.com/search?q={query}', icon: 'https://www.bing.com/favicon.ico', tab: '通用' },
            { id: 'engine_baidu', name: '百度', url: 'https://www.baidu.com/s?wd={query}', icon: 'https://www.baidu.com/favicon.ico', tab: '通用' },
            { id: 'engine_github', name: 'GitHub', url: 'https://github.com/search?q={query}', icon: 'https://github.com/favicon.ico', tab: '开发' },
            { id: 'engine_stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q={query}', icon: 'https://stackoverflow.com/favicon.ico', tab: '开发' },
            { id: 'engine_zhihu', name: '知乎', url: 'https://www.zhihu.com/search?q={query}', icon: 'https://www.zhihu.com/favicon.ico', tab: '问答' },
            { id: 'engine_quora', name: 'Quora', url: 'https://www.quora.com/search?q={query}', icon: 'https://www.quora.com/favicon.ico', tab: '问答' },
            { id: 'engine_youtube', name: 'YouTube', url: 'https://www.youtube.com/results?search_query={query}', icon: 'https://www.youtube.com/favicon.ico', tab: '视频' },
            { id: 'engine_bilibili', name: 'B站', url: 'https://search.bilibili.com/all?keyword={query}', icon: 'https://www.bilibili.com/favicon.ico', tab: '视频' },
            { id: 'engine_amazon', name: 'Amazon', url: 'https://www.amazon.com/s?k={query}', icon: 'https://www.amazon.com/favicon.ico', tab: '购物' },
            { id: 'engine_taobao', name: '淘宝', url: 'https://s.taobao.com/search?q={query}', icon: 'https://www.taobao.com/favicon.ico', tab: '购物' },
        ],
        scopes: [
            { id: 'scope_1', tab: '常用', title: 'GitHub', icon: 'https://github.com/favicon.ico', sites: ['github.com'] },
            { id: 'scope_2', tab: '常用', title: '技术博客', icon: 'https://www.zhihu.com/favicon.ico', sites: ['zhihu.com', 'csdn.net', 'juejin.cn'] }
        ],
        dynamicFilters: {
            timeRange: [
                { id: 'any', name: '任何时间' },
                { id: 'd1', name: '过去24小时', type: 'relative', params: { value: 'd1' } },
                { id: 'w1', name: '过去一周', type: 'relative', params: { value: 'w1' } },
                { id: 'm1', name: '过去一月', type: 'relative', params: { value: 'm1' } },
                { id: 'y1', name: '过去一年', type: 'relative', params: { value: 'y1' } }
            ],
            filetype: [
                { value: 'any', text: '任何文件' }, { value: 'pdf', text: 'PDF' },
                { value: 'docx', text: 'Word' }, { value: 'pptx', text: 'PPT' },
                { value: 'xlsx', text: 'Excel' }
            ]
        },
        activeSearchEngineId: 'engine_google',
        searchboxTop: 1,
        searchboxWidth: 1500,
        scopeMenuWidth: 800,
        favoriteScopes: [],
        navigationGroups: [
            {
                id: 'group_default_1',
                name: '常用',
                items: [
                    { id: 'nav_1', title: 'Google', url: 'https://www.google.com', icon: 'https://www.google.com/favicon.ico' },
                    { id: 'nav_2', title: 'GitHub', url: 'https://github.com', icon: 'https://github.com/favicon.ico' }
                ]
            }
        ],
        activeNavigationGroupId: 'group_default_1',
        navigationItemSize: 80,
        navigationGridGap: 24,
        navigationShape: 'square',
        // [新增] 导航对齐方式和图标密度控制的默认值
        navigationAlignment: 'center',
        navigationItemMinWidth: 120,
        // 搜索引擎菜单设置
        engineSettings: {
            size: 16,
            spacing: 8
        },
        // 壁纸背景适配效果设置
        wallpaperEffects: {
            overlayOpacity: 30,
            searchBgOpacity: 15,
            searchBlur: 30,
            searchBorderOpacity: 35,
            iconBgOpacity: 13,
            iconBlur: 15,
            textShadowOpacity: 80
        },
        // 导航设置
        navigationSettings: {
            minWidth: 120
        },
        // Dock栏设置
        dockSettings: {
            scale: 1.0
        },
        // 面板设置
        panelSettings: {
            theme: 'light',
            activeTab: 'appearance'
        },
    },
    CONSTANTS: {
        STORAGE_KEY: '灵动搜索最终版用户数据',
        NEW_TAB_VALUE: '--new-tab--',
        NEW_GROUP_VALUE: '--new-group--'
    },
    // ============================================
    // 时间和延迟常量 (毫秒)
    // ============================================
    TIMING: {
        // 双击检测时间窗口
        DOUBLE_CLICK_THRESHOLD: 300,
        
        // 搜索相关延迟
        SEARCH_DEBOUNCE_DELAY: 150,        // 搜索建议防抖延迟
        SEARCH_BLUR_DELAY: 300,            // 搜索框失焦后隐藏容器的延迟
        PREVENT_HIDE_RESET_DELAY: 1000,    // 阻止隐藏标志的重置时间
        
        // UI交互延迟
        TOAST_DURATION: 2000,              // Toast提示显示时间
        MODAL_FADE_DURATION: 200,          // 模态框淡入淡出时间
        ANIMATION_DURATION: 250,           // 通用动画持续时间
        
        // 其他延迟
        ICON_FORMAT_DELAY: 10,             // 图标格式化延迟
        AUTO_CLOSE_DELAY: 1500,            // 自动关闭窗口延迟 (popup.js)
        
        // 节流延迟
        THROTTLE_DELAY: 100                // 滑块等UI元素的节流延迟
    },
    // ============================================
    // UI尺寸和限制常量
    // ============================================
    LIMITS: {
        MAX_HISTORY_ITEMS: 100,            // 最大搜索历史记录数
        MAX_SEARCH_HISTORY_DISPLAY: 20,    // 显示的最大搜索历史数
        MIN_SEARCH_CHARS: 1,               // 触发搜索建议的最小字符数
        MAX_NAME_LENGTH: 50                // 名称字段的最大长度
    },

    // =================================================================
    // UI样式常量 - 统一样式设置，减少硬编码
    // =================================================================
    STYLES: {
        // 字体大小
        FONT_SIZES: {
            PRIMARY: '14px',      // 主要文本
            SECONDARY: '12px',   // 次要文本
            SMALL: '11px',       // 辅助文本
            LARGE: '16px'        // 大文本
        },

        // 颜色变量
        COLORS: {
            PRIMARY: 'var(--text-primary)',     // 主要文本颜色
            SECONDARY: 'var(--text-secondary)', // 次要文本颜色
            LINK: '#8ab4f8',                    // 链接颜色
            SUCCESS: '#4caf50',                 // 成功颜色
            WARNING: '#ff9800',                 // 警告颜色
            ERROR: '#f44336'                    // 错误颜色
        },

        // 图标尺寸
        ICON_SIZES: {
            SMALL: '16px',      // 小图标
            MEDIUM: '24px',     // 中等图标
            LARGE: '32px'       // 大图标
        },

        // 间距值
        SPACING: {
            XS: '4px',          // 超小间距
            SM: '8px',          // 小间距
            MD: '10px',         // 中等间距
            LG: '16px',         // 大间距
            XL: '24px'          // 超大间距
        },

        // 字体粗细
        FONT_WEIGHTS: {
            NORMAL: 'normal',
            MEDIUM: '500',
            BOLD: 'bold'
        },

        // 常用样式组合
        TEXT_STYLES: {
            PRIMARY_TEXT: 'font-size: 14px; color: var(--text-primary); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
            SECONDARY_TEXT: 'font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
            SMALL_TEXT: 'font-size: 11px; color: #8ab4f8; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
        },

        // 容器样式
        CONTAINER_STYLES: {
            FLEX_CENTER: 'display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;',
            FLEX_WRAP: 'display: flex; flex-wrap: wrap; gap: 4px;',
            PREVIEW_CONTAINER: 'display: flex; align-items: center; gap: 10px;'
        },

        // 图标样式
        ICON_STYLES: {
            SMALL_ICON: 'width: 16px; height: 16px; flex-shrink: 0;',
            MEDIUM_ICON: 'width: 24px; height: 24px; border-radius: 4px;',
            LARGE_ICON: 'width: 32px; height: 32px; border-radius: 6px;'
        }
    }
};