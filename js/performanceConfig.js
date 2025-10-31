// =================================================================
// 性能优化配置模块 - 集中管理性能优化开关
// =================================================================

/**
 * 性能优化配置
 * 用于独立脚本文件的日志控制和性能优化
 */
export const performanceConfig = {
    // 是否启用控制台日志（生产环境应设为false）
    enableConsoleLogs: true,  // 开发时设为true，发布前改为false
    
    // 是否启用调试模式
    debugMode: true,
    
    // 是否启用性能监控
    enablePerformanceMonitoring: true,
    
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
};

/**
 * 条件日志工具 - 根据配置决定是否输出日志
 */
export const conditionalLogger = {
    log: (...args) => {
        if (performanceConfig.enableConsoleLogs) {
            console.log(...args);
        }
    },
    
    warn: (...args) => {
        if (performanceConfig.enableConsoleLogs) {
            console.warn(...args);
        }
    },
    
    error: (...args) => {
        // 错误日志始终输出
        console.error(...args);
    },
    
    debug: (...args) => {
        if (performanceConfig.debugMode && performanceConfig.enableConsoleLogs) {
            console.log('[DEBUG]', ...args);
        }
    }
};

/**
 * 检测浏览器是否支持WebP
 * @returns {Promise<boolean>}
 */
export function supportsWebP() {
    if (!performanceConfig.imageOptimization.enableWebP) {
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

