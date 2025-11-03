// =================================================================
// 全局错误处理模块 - 统一处理和记录各类错误
// =================================================================

import { logger } from './logger.js';
import { domSafe } from './security.js';

/**
 * 错误类型枚举
 */
const ErrorType = {
    RUNTIME: 'runtime',           // 运行时错误
    PROMISE: 'promise',           // Promise未捕获错误
    RESOURCE: 'resource',         // 资源加载错误
    NETWORK: 'network',           // 网络错误
    STORAGE: 'storage',           // 存储错误
    VALIDATION: 'validation'      // 验证错误
};

/**
 * 错误处理器类
 */
class ErrorHandler {
    constructor() {
        this.errorCount = 0;
        this.errorLog = [];
        this.maxLogSize = 50; // 最多保存50条错误日志
        this.isInitialized = false; // 【修复】标记是否已初始化
        this.errorHandler = null; // 【修复】保存error事件处理函数引用
        this.rejectionHandler = null; // 【修复】保存unhandledrejection事件处理函数引用
    }

    /**
     * 初始化全局错误处理器（已优化：防止重复初始化导致监听器累积）
     */
    init() {
        // 【修复】如果已初始化，先清理旧的监听器
        if (this.isInitialized) {
            this.reset();
        }
        
        // 创建错误处理函数
        this.errorHandler = (event) => {
            this.handleError({
                type: ErrorType.RUNTIME,
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                timestamp: new Date().toISOString()
            });
        };

        // 创建Promise拒绝处理函数
        this.rejectionHandler = (event) => {
            this.handleError({
                type: ErrorType.PROMISE,
                message: event.reason?.message || event.reason || 'Unhandled Promise Rejection',
                error: event.reason,
                timestamp: new Date().toISOString()
            });
            
            // 阻止默认的控制台错误输出
            event.preventDefault();
        };

        // 捕获全局未处理的错误
        window.addEventListener('error', this.errorHandler);
        // 捕获未处理的Promise拒绝
        window.addEventListener('unhandledrejection', this.rejectionHandler);

        this.isInitialized = true;
        logger.info('全局错误处理器已初始化');
    }
    
    /**
     * 【新增】重置错误处理器状态（用于页面刷新时）
     * 移除事件监听器并重置内部状态
     */
    reset() {
        // 【修复】移除事件监听器，避免累积
        if (this.errorHandler) {
            window.removeEventListener('error', this.errorHandler);
            this.errorHandler = null;
        }
        if (this.rejectionHandler) {
            window.removeEventListener('unhandledrejection', this.rejectionHandler);
            this.rejectionHandler = null;
        }
        
        // 重置内部状态
        this.errorCount = 0;
        this.errorLog = [];
        this.isInitialized = false;
    }

    /**
     * 处理错误
     * @param {Object} errorInfo - 错误信息对象
     */
    handleError(errorInfo) {
        this.errorCount++;
        
        // 记录到日志
        this.logError(errorInfo);
        
        // 根据错误类型决定处理方式
        switch (errorInfo.type) {
            case ErrorType.RUNTIME:
                this.handleRuntimeError(errorInfo);
                break;
            case ErrorType.PROMISE:
                this.handlePromiseError(errorInfo);
                break;
            case ErrorType.RESOURCE:
                this.handleResourceError(errorInfo);
                break;
            case ErrorType.NETWORK:
                this.handleNetworkError(errorInfo);
                break;
            case ErrorType.STORAGE:
                this.handleStorageError(errorInfo);
                break;
            case ErrorType.VALIDATION:
                this.handleValidationError(errorInfo);
                break;
            default:
                logger.error('未知错误类型:', errorInfo);
        }
    }

    /**
     * 记录错误到日志
     * @param {Object} errorInfo - 错误信息
     */
    logError(errorInfo) {
        // 添加到内存日志
        this.errorLog.push(errorInfo);
        
        // 限制日志大小
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        // 输出到控制台
        logger.error(`[${errorInfo.type}]`, errorInfo.message, errorInfo);
    }

    /**
     * 处理运行时错误
     */
    handleRuntimeError(errorInfo) {
        // 对于关键错误，显示用户友好的错误提示
        if (this.isCriticalError(errorInfo)) {
            this.showUserErrorMessage('应用遇到错误，部分功能可能无法正常使用');
        }
    }

    /**
     * 处理Promise错误
     */
    handlePromiseError(errorInfo) {
        // Promise错误通常是异步操作失败
        logger.warn('Promise错误:', errorInfo.message);
    }

    /**
     * 处理资源加载错误
     */
    handleResourceError(errorInfo) {
        logger.warn('资源加载失败:', errorInfo.resource);
    }

    /**
     * 处理网络错误
     */
    handleNetworkError(errorInfo) {
        this.showUserErrorMessage('网络连接失败，请检查网络设置');
    }

    /**
     * 处理存储错误
     */
    handleStorageError(errorInfo) {
        logger.error('存储操作失败:', errorInfo.message);
        this.showUserErrorMessage('数据保存失败，请重试');
    }

    /**
     * 处理验证错误
     */
    handleValidationError(errorInfo) {
        // 验证错误通常不需要特殊处理，已经在UI层面处理
        logger.debug('验证错误:', errorInfo.message);
    }

    /**
     * 判断是否为关键错误
     * @param {Object} errorInfo - 错误信息
     * @returns {boolean} 是否为关键错误
     */
    isCriticalError(errorInfo) {
        const criticalPatterns = [
            /Cannot read property/i,
            /undefined is not/i,
            /null is not/i,
            /Cannot access/i
        ];

        return criticalPatterns.some(pattern => 
            pattern.test(errorInfo.message)
        );
    }

    /**
     * 显示用户友好的错误消息
     * @param {string} message - 错误消息
     */
    showUserErrorMessage(message) {
        // 避免频繁显示相同错误
        if (this._lastErrorMessage === message && 
            Date.now() - this._lastErrorTime < 5000) {
            return;
        }

        this._lastErrorMessage = message;
        this._lastErrorTime = Date.now();

        // 使用domSafe创建错误提示
        domSafe.showAlert(message, 'error');
    }

    /**
     * 获取错误日志
     * @returns {Array} 错误日志数组
     */
    getErrorLog() {
        return [...this.errorLog];
    }

    /**
     * 清除错误日志
     */
    clearErrorLog() {
        this.errorLog = [];
        this.errorCount = 0;
        logger.info('错误日志已清除');
    }

    /**
     * 导出错误日志
     * @returns {string} JSON格式的错误日志
     */
    exportErrorLog() {
        return JSON.stringify({
            totalErrors: this.errorCount,
            errors: this.errorLog,
            exportTime: new Date().toISOString()
        }, null, 2);
    }
}

// 创建单例
export const errorHandler = new ErrorHandler();

/**
 * 包装异步函数，自动捕获错误
 * @param {Function} fn - 要包装的异步函数
 * @param {string} context - 错误上下文描述
 * @returns {Function} 包装后的函数
 */
export function withErrorHandling(fn, context = 'Unknown') {
    return async function(...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            errorHandler.handleError({
                type: ErrorType.RUNTIME,
                message: `错误发生在 ${context}: ${error.message}`,
                error: error,
                context: context,
                timestamp: new Date().toISOString()
            });
            throw error; // 重新抛出错误，让调用者知道失败了
        }
    };
}

/**
 * 安全执行函数，捕获但不抛出错误
 * @param {Function} fn - 要执行的函数
 * @param {*} defaultValue - 发生错误时返回的默认值
 * @returns {*} 函数返回值或默认值
 */
export function safeExecute(fn, defaultValue = null) {
    try {
        return fn();
    } catch (error) {
        errorHandler.handleError({
            type: ErrorType.RUNTIME,
            message: error.message,
            error: error,
            timestamp: new Date().toISOString()
        });
        return defaultValue;
    }
}

