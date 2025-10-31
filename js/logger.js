// =================================================================
// 日志工具模块 - 可控的调试日志输出
// =================================================================

import { config } from './config.js';

/**
 * 日志级别枚举
 */
const LogLevel = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4
};

/**
 * 获取当前日志级别
 */
function getCurrentLogLevel() {
    const levelMap = {
        'none': LogLevel.NONE,
        'error': LogLevel.ERROR,
        'warn': LogLevel.WARN,
        'info': LogLevel.INFO,
        'debug': LogLevel.DEBUG
    };
    
    return levelMap[config.debug.logLevel] || LogLevel.ERROR;
}

/**
 * 格式化日志前缀
 */
function formatPrefix(level, module = '') {
    const timestamp = new Date().toTimeString().split(' ')[0];
    const moduleStr = module ? `[${module}]` : '';
    return `[${timestamp}][${level}]${moduleStr}`;
}

/**
 * 日志工具类
 */
export const logger = {
    /**
     * 错误日志
     */
    error: (...args) => {
        if (config.debug.enableConsole && getCurrentLogLevel() >= LogLevel.ERROR) {
            console.error(formatPrefix('ERROR'), ...args);
        }
    },
    
    /**
     * 警告日志
     */
    warn: (...args) => {
        if (config.debug.enableConsole && getCurrentLogLevel() >= LogLevel.WARN) {
            console.warn(formatPrefix('WARN'), ...args);
        }
    },
    
    /**
     * 信息日志
     */
    info: (...args) => {
        if (config.debug.enableConsole && getCurrentLogLevel() >= LogLevel.INFO) {
            console.info(formatPrefix('INFO'), ...args);
        }
    },
    
    /**
     * 调试日志
     */
    debug: (...args) => {
        if (config.debug.enableConsole && getCurrentLogLevel() >= LogLevel.DEBUG) {
            console.log(formatPrefix('DEBUG'), ...args);
        }
    },
    
    /**
     * 带模块名的日志
     */
    module: (moduleName) => ({
        error: (...args) => {
            if (config.debug.enableConsole && getCurrentLogLevel() >= LogLevel.ERROR) {
                console.error(formatPrefix('ERROR', moduleName), ...args);
            }
        },
        warn: (...args) => {
            if (config.debug.enableConsole && getCurrentLogLevel() >= LogLevel.WARN) {
                console.warn(formatPrefix('WARN', moduleName), ...args);
            }
        },
        info: (...args) => {
            if (config.debug.enableConsole && getCurrentLogLevel() >= LogLevel.INFO) {
                console.info(formatPrefix('INFO', moduleName), ...args);
            }
        },
        debug: (...args) => {
            if (config.debug.enableConsole && getCurrentLogLevel() >= LogLevel.DEBUG) {
                console.log(formatPrefix('DEBUG', moduleName), ...args);
            }
        }
    }),
    
    /**
     * 性能监控
     */
    performance: {
        /**
         * 开始计时
         */
        start: (label) => {
            if (config.debug.enablePerformance) {
                performance.mark(`${label}-start`);
            }
        },
        
        /**
         * 结束计时并输出
         */
        end: (label) => {
            if (!config.debug.enablePerformance) return;
            
            const startMark = `${label}-start`;
            const endMark = `${label}-end`;
            
            performance.mark(endMark);
            
            try {
                performance.measure(label, startMark, endMark);
                const measure = performance.getEntriesByName(label)[0];
                console.log(`⏱️ [Performance] ${label}: ${measure.duration.toFixed(2)}ms`);
                
                // 优化：批量清理性能标记
                performance.clearMarks(startMark);
                performance.clearMarks(endMark);
                performance.clearMeasures(label);
            } catch (e) {
                // 忽略性能监控错误
            }
        }
    },
    
    /**
     * 分组日志
     */
    group: (label) => {
        if (config.debug.enableConsole && getCurrentLogLevel() >= LogLevel.DEBUG) {
            console.group(label);
        }
    },
    
    groupEnd: () => {
        if (config.debug.enableConsole && getCurrentLogLevel() >= LogLevel.DEBUG) {
            console.groupEnd();
        }
    },
    
    /**
     * 表格日志
     */
    table: (data) => {
        if (config.debug.enableConsole && getCurrentLogLevel() >= LogLevel.DEBUG) {
            console.table(data);
        }
    }
};

/**
 * 创建模块专用日志器
 * @param {string} moduleName - 模块名称
 * @returns {Object} 日志器对象
 */
export function createLogger(moduleName) {
    return logger.module(moduleName);
}

