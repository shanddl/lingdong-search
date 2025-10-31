// =================================================================
// UI常量配置 - 集中管理所有UI相关的魔法数字
// =================================================================

export const UI_CONSTANTS = {
    // 时间相关常量（毫秒）
    TIMING: {
        DOUBLE_CLICK_DELAY: 300,        // 双击检测延迟
        BLUR_HIDE_DELAY: 300,           // 失焦隐藏延迟
        PREVENT_HIDE_RESET: 1000,       // 阻止隐藏标志重置时间
        TOAST_DURATION: 2500,           // Toast提示持续时间
        DEBOUNCE_SEARCH: 150,           // 搜索防抖延迟
        AUTO_CLOSE_POPUP: 1500,         // 自动关闭弹窗延迟
    },

    // 尺寸相关常量（像素）
    DIMENSIONS: {
        // 建议列表
        SUGGESTION_MIN_ITEMS: 10,
        SUGGESTION_ITEM_HEIGHT: 44,
        
        // 引擎设置默认值
        ENGINE_DEFAULT_SIZE: 16,
        ENGINE_DEFAULT_SPACING: 8,
        
        // 图标尺寸
        FAVICON_SIZE: 16,
        ICON_SIZE_SMALL: 16,
        ICON_SIZE_MEDIUM: 24,
        
        // 导航相关
        NAV_ITEM_DEFAULT_SIZE: 80,
        NAV_GRID_DEFAULT_GAP: 24,
        NAV_ITEM_DEFAULT_MIN_WIDTH: 120,
        
        // Dock栏
        DOCK_DEFAULT_SCALE: 1.0,
        
        // 搜索框
        SEARCHBOX_DEFAULT_TOP: 1,
        SEARCHBOX_DEFAULT_WIDTH: 1500,
        SCOPE_MENU_DEFAULT_WIDTH: 800,
    },

    // Z-index层级
    Z_INDEX: {
        BASE: 1,
        DROPDOWN: 1000,
        MODAL: 2000,
        TOAST: 3000,
        CONTEXT_MENU: 2500,
    },

    // CSS类名
    CLASS_NAMES: {
        ACTIVE: 'active',
        VISIBLE: 'visible',
        HIDDEN: 'hidden',
        SELECTED: 'selected',
        DRAGGING: 'dragging',
        DRAG_OVER: 'drag-over',
        DRAG_TARGET: 'drag-target',
        FOCUSED: 'focused',
        HAS_CONTENT: 'has-content',
    },

    // 事件类型
    EVENTS: {
        CLICK: 'click',
        DBLCLICK: 'dblclick',
        KEYDOWN: 'keydown',
        INPUT: 'input',
        FOCUS: 'focus',
        BLUR: 'blur',
        SUBMIT: 'submit',
        DRAGSTART: 'dragstart',
        DRAGEND: 'dragend',
        DRAGOVER: 'dragover',
        DROP: 'drop',
        DRAGLEAVE: 'dragleave',
        DRAGENTER: 'dragenter',
        CONTEXTMENU: 'contextmenu',
        MOUSEDOWN: 'mousedown',
    },

    // 颜色变量（对应CSS变量）
    COLORS: {
        TEXT_PRIMARY: 'var(--text-primary)',
        TEXT_SECONDARY: 'var(--text-secondary)',
        CARD_BG: 'var(--card-bg)',
        BORDER_COLOR: 'var(--border-color)',
        BLUE: 'var(--blue)',
        ERROR_COLOR: 'var(--error-color)',
    },

    // 动画相关
    ANIMATION: {
        TRANSITION_DURATION: 200,       // 标准过渡动画时长（毫秒）
        EASE_OUT: 'ease-out',
        EASE_IN_OUT: 'ease-in-out',
    },

    // 限制数量
    LIMITS: {
        MAX_SEARCH_HISTORY: 20,             // 最大搜索历史记录数
        MAX_FILE_SIZE: 10 * 1024 * 1024,    // 最大文件大小 10MB（上传后自动压缩到1920×1080）
        MAX_TABS_PER_MODAL: 20,             // 模态框最大标签数
        MAX_RESULTS_PER_PAGE: 100,          // 每页最大结果数
    },

    // 快捷键
    KEYS: {
        ENTER: 'Enter',
        ESCAPE: 'Escape',
        TAB: 'Tab',
        DELETE: 'Delete',
        ARROW_UP: 'ArrowUp',
        ARROW_DOWN: 'ArrowDown',
        ARROW_LEFT: 'ArrowLeft',
        ARROW_RIGHT: 'ArrowRight',
        SHIFT: 'Shift',
        CTRL: 'Control',
        ALT: 'Alt',
    },

    // 正则表达式模式
    PATTERNS: {
        URL: /^https?:\/\/.+/i,
        EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        TIME_RULE: /([dwmy])(\d+)/,
    },

    // 默认图标
    DEFAULT_ICONS: {
        SEARCH: '🔍',
        BOOKMARK: '🔖',
        LINK: '🔗',
        STAR: '⭐',
        FOLDER: '📁',
        PLACEHOLDER: 'https://placehold.co/24x24/3c4043/e8eaed?text=?',
    },
};

// 导出常用的子对象，方便直接使用
export const TIMING = UI_CONSTANTS.TIMING;
export const DIMENSIONS = UI_CONSTANTS.DIMENSIONS;
export const CLASS_NAMES = UI_CONSTANTS.CLASS_NAMES;
export const EVENTS = UI_CONSTANTS.EVENTS;
export const KEYS = UI_CONSTANTS.KEYS;

