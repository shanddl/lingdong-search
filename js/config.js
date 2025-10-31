// =================================================================
// 环境配置模块 - 管理开发/生产环境配置
// =================================================================

/**
 * 环境类型枚举
 * @readonly
 * @enum {string}
 */
const ENV = {
    /** 开发环境 */
    DEVELOPMENT: 'development',
    /** 生产环境 */
    PRODUCTION: 'production'
};

/**
 * 当前运行环境
 * 修改此值来切换环境：'development' 或 'production'
 * 生产环境会禁用调试日志和性能监控
 * @type {string}
 */
const CURRENT_ENV = 'production';

/**
 * 应用配置对象
 * 根据当前环境自动调整日志级别、功能开关等
 * @type {Object}
 */
export const config = {
    // 当前环境
    env: CURRENT_ENV,
    
    // 是否为开发环境
    isDevelopment: CURRENT_ENV === ENV.DEVELOPMENT,
    
    // 是否为生产环境
    isProduction: CURRENT_ENV === ENV.PRODUCTION,
    
    // 调试配置
    debug: {
        // 是否启用控制台日志
        enableConsole: CURRENT_ENV === ENV.DEVELOPMENT,
        
        // 日志级别：'none', 'error', 'warn', 'info', 'debug'
        logLevel: CURRENT_ENV === ENV.DEVELOPMENT ? 'debug' : 'error',
        
        // 是否显示性能监控
        enablePerformance: CURRENT_ENV === ENV.DEVELOPMENT,
        
        // 是否启用详细的错误堆栈
        verboseErrors: CURRENT_ENV === ENV.DEVELOPMENT
    },
    
    // 功能开关
    features: {
        // 是否启用书签搜索
        bookmarkSearch: true,
        
        // 是否启用URL隐藏功能
        urlHider: false,
        
        // 是否启用AI搜索
        aiSearch: true
    },
    
    // 性能配置
    performance: {
        // 防抖延迟（毫秒）
        debounceDelay: 300,
        
        // 节流延迟（毫秒）
        throttleDelay: 100,
        
        // 搜索建议最小字符数
        minSearchChars: 1,
        
        // 最大搜索历史记录数
        maxHistoryItems: 100,
        
        // 性能监控
        enablePerformanceMonitoring: CURRENT_ENV === ENV.DEVELOPMENT,
        
        // 虚拟滚动配置
        virtualScroll: {
            enabled: true,           // 是否启用虚拟滚动
            itemHeight: 200,         // 每个项目的高度（px）
            bufferSize: 5,           // 缓冲区大小（屏幕外预渲染的项目数）
            threshold: 100           // 触发虚拟滚动的最小项目数
        },
        
        // 懒加载配置
        lazyLoad: {
            enabled: true,           // 是否启用懒加载
            rootMargin: '200px',     // 预加载边距
            threshold: 0.01,         // 触发加载的阈值
            loadingPlaceholder: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3C/svg%3E'
        },
        
        // 图片优化配置
        imageOptimization: {
            enableWebP: true,         // 是否启用WebP格式
            enableResponsive: true,   // 是否启用响应式图片
            quality: {
                thumbnail: 60,         // 缩略图质量 (0-100)
                preview: 80,           // 预览图质量
                original: 95           // 原图质量
            },
            sizes: {
                thumbnail: { width: 400, height: 300 },
                preview: { width: 1200, height: 900 },
                original: { width: 1920, height: 1080 }
            }
        }
    },
    
    // UI配置
    ui: {
        // 动画持续时间（毫秒）
        animationDuration: 250,
        
        // Toast提示显示时间（毫秒）
        toastDuration: 2000,
        
        // 模态框淡入时间（毫秒）
        modalFadeIn: 200
    }
};

/**
 * 检测浏览器是否支持WebP
 * @returns {Promise<boolean>}
 */
export function supportsWebP() {
    if (!config.performance.imageOptimization.enableWebP) {
        return Promise.resolve(false);
    }
    
    return new Promise((resolve) => {
        const webP = new Image();
        webP.onload = webP.onerror = function () {
            resolve(webP.height === 2);
        };
        webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
    });
}

/**
 * 获取优化后的图片URL
 * @param {string} originalUrl - 原始图片URL
 * @param {string} size - 尺寸类型 ('thumbnail'|'preview'|'original')
 * @param {boolean} useWebP - 是否使用WebP格式
 * @returns {string} 优化后的URL
 */
export function getOptimizedImageUrl(originalUrl, size = 'thumbnail', useWebP = false) {
    if (!originalUrl) return '';
    
    // 如果URL已经是base64或blob，直接返回
    if (originalUrl.startsWith('data:') || originalUrl.startsWith('blob:')) {
        return originalUrl;
    }
    
    // TODO: 如果使用CDN，可以在这里添加URL转换逻辑
    // 例如: return `${CDN_URL}/${size}/${useWebP ? 'webp' : 'jpg'}/${encodeURIComponent(originalUrl)}`;
    
    return originalUrl;
}