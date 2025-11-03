// =================================================================
// 代码优化工具集 - 消除重复代码，提升可维护性
// =================================================================

/**
 * 事件管理器 - 防止重复注册事件监听器
 */
export const eventManager = {
    listeners: new Map(),
    
    /**
     * 添加事件监听器（防止重复）
     * @param {EventTarget} target - 目标元素
     * @param {string} event - 事件类型
     * @param {Function} handler - 处理函数
     * @param {Object} options - 事件选项
     * @returns {boolean} 是否成功添加
     */
    addOnce(target, event, handler, options = {}) {
        const key = this.getKey(target, event, handler);
        
        if (this.listeners.has(key)) {
            console.warn(`⚠️ 事件监听器已存在: ${event}`, target);
            return false;
        }
        
        target.addEventListener(event, handler, options);
        this.listeners.set(key, { target, event, handler, options });
        return true;
    },
    
    /**
     * 移除特定的事件监听器
     * @param {EventTarget} target - 目标元素
     * @param {string} event - 事件类型
     * @param {Function} handler - 处理函数
     * @returns {boolean} 是否成功移除
     */
    remove(target, event, handler) {
        const key = this.getKey(target, event, handler);
        const listener = this.listeners.get(key);
        
        if (listener) {
            target.removeEventListener(event, handler, listener.options);
            this.listeners.delete(key);
            return true;
        }
        return false;
    },
    
    /**
     * 移除所有事件监听器
     */
    removeAll() {
        for (const { target, event, handler, options } of this.listeners.values()) {
            target.removeEventListener(event, handler, options);
        }
        this.listeners.clear();
    },
    
    /**
     * 生成唯一键
     * @private
     */
    getKey(target, event, handler) {
        const targetId = target.id || target.tagName || target.constructor.name || 'unknown';
        const handlerName = handler.name || 'anonymous';
        const timestamp = Date.now();
        return `${targetId}-${event}-${handlerName}-${timestamp}`;
    },
    
    /**
     * 获取已注册的监听器数量
     * @returns {number}
     */
    count() {
        return this.listeners.size;
    },
    
    /**
     * 检查是否已注册
     * @param {EventTarget} target
     * @param {string} event
     * @returns {boolean}
     */
    has(target, event) {
        for (const [key, listener] of this.listeners.entries()) {
            if (listener.target === target && listener.event === event) {
                return true;
            }
        }
        return false;
    }
};

/**
 * 滑块管理器 - 统一管理所有滑块的事件
 */
export const sliderManager = {
    sliders: new Map(),
    rafId: null,
    pendingApplies: new Map(),
    
    /**
     * 设置单个滑块
     * @param {Object} config - 滑块配置
     * @param {HTMLInputElement} config.slider - 滑块元素
     * @param {HTMLElement} config.valueDisplay - 值显示元素
     * @param {Function} config.applyFn - 实时应用函数
     * @param {Function} config.saveFn - 保存函数
     * @param {Function} config.format - 格式化函数 (可选)
     * @param {boolean} config.throttle - 是否节流 (默认true)
     */
    setup(config) {
        const {
            slider,
            valueDisplay,
            applyFn,
            saveFn,
            format = (v) => v,
            throttle = true
        } = config;
        
        if (!slider) {
            console.warn('⚠️ 滑块元素未找到', config);
            return false;
        }
        
        if (!valueDisplay) {
            console.warn('⚠️ 值显示元素未找到', config);
            return false;
        }
        
        const sliderId = slider.id || `slider_${Date.now()}`;
        
        // 检查是否已设置
        if (this.sliders.has(sliderId)) {
            console.warn(`⚠️ 滑块 ${sliderId} 已经设置过了`);
            return false;
        }
        
        // Input 事件 - 实时更新
        const inputHandler = (e) => {
            const value = Number(e.target.value);
            valueDisplay.textContent = format(value);
            
            if (applyFn) {
                if (throttle) {
                    this.throttledApply(sliderId, applyFn, value);
                } else {
                    applyFn(value);
                }
            }
        };
        
        // Change 事件 - 保存
        const changeHandler = (e) => {
            const value = Number(e.target.value);
            if (saveFn) {
                saveFn(value);
            }
        };
        
        // 使用事件管理器添加监听器
        eventManager.addOnce(slider, 'input', inputHandler);
        eventManager.addOnce(slider, 'change', changeHandler);
        
        // 保存配置
        this.sliders.set(sliderId, {
            slider,
            valueDisplay,
            applyFn,
            saveFn,
            format,
            inputHandler,
            changeHandler
        });
        
        return true;
    },
    
    /**
     * 批量设置多个滑块
     * @param {Array} configs - 滑块配置数组
     * @returns {Object} 设置结果统计
     */
    setupAll(configs) {
        let success = 0;
        let failed = 0;
        
        for (const config of configs) {
            if (this.setup(config)) {
                success++;
            } else {
                failed++;
            }
        }
        
        console.log(`✅ 滑块设置完成: ${success} 成功, ${failed} 失败`);
        
        return { success, failed, total: configs.length };
    },
    
    /**
     * 节流的应用函数（使用 RAF）
     * @private
     */
    throttledApply(sliderId, fn, value) {
        // 保存待执行的函数和值
        this.pendingApplies.set(sliderId, { fn, value });
        
        // 如果已经有RAF在等待，直接返回
        if (this.rafId !== null) {
            return;
        }
        
        // 请求动画帧
        this.rafId = requestAnimationFrame(() => {
            // 执行所有待处理的应用
            for (const { fn, value } of this.pendingApplies.values()) {
                fn(value);
            }
            
            // 清理
            this.pendingApplies.clear();
            this.rafId = null;
        });
    },
    
    /**
     * 移除滑块设置
     * @param {string} sliderId
     */
    remove(sliderId) {
        const config = this.sliders.get(sliderId);
        if (config) {
            eventManager.remove(config.slider, 'input', config.inputHandler);
            eventManager.remove(config.slider, 'change', config.changeHandler);
            this.sliders.delete(sliderId);
            return true;
        }
        return false;
    },
    
    /**
     * 移除所有滑块
     */
    removeAll() {
        for (const sliderId of this.sliders.keys()) {
            this.remove(sliderId);
        }
    },
    
    /**
     * 获取滑块数量
     */
    count() {
        return this.sliders.size;
    }
};

/**
 * 日志管理器 - 环境感知的日志系统
 */
export class LoggerManager {
    constructor() {
        this.isProduction = this.detectEnvironment();
        this.logLevel = this.isProduction ? 'error' : 'debug';
        this.modules = new Map();
    }
    
    /**
     * 检测环境
     * @returns {boolean} 是否为生产环境
     */
    detectEnvironment() {
        // 方法1: 检查 NODE_ENV
        if (typeof process !== 'undefined' && process.env) {
            return process.env.NODE_ENV === 'production';
        }
        
        // 方法2: 检查 URL
        if (typeof location !== 'undefined') {
            const url = location.href;
            return !url.includes('localhost') && 
                   !url.includes('127.0.0.1') &&
                   !url.includes('192.168.');
        }
        
        // 方法3: 检查调试标志
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('DEBUG_MODE') !== 'true';
        }
        
        return false;
    }
    
    /**
     * 设置日志级别
     * @param {string} level - debug, info, warn, error
     */
    setLevel(level) {
        this.logLevel = level;
    }
    
    /**
     * 创建模块日志器
     * @param {string} name - 模块名称
     * @returns {Object} 日志器对象
     */
    module(name) {
        if (this.modules.has(name)) {
            return this.modules.get(name);
        }
        
        const logger = {
            debug: (...args) => this.log('debug', name, ...args),
            info: (...args) => this.log('info', name, ...args),
            warn: (...args) => this.log('warn', name, ...args),
            error: (...args) => this.log('error', name, ...args)
        };
        
        this.modules.set(name, logger);
        return logger;
    }
    
    /**
     * 输出日志
     * @private
     */
    log(level, module, ...args) {
        // 生产环境只输出 warn 和 error
        if (this.isProduction && !['warn', 'error'].includes(level)) {
            return;
        }
        
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        const currentLevel = levels[this.logLevel] || 0;
        const messageLevel = levels[level] || 0;
        
        if (messageLevel >= currentLevel) {
            const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
            const prefix = `[${timestamp}][${level.toUpperCase()}][${module}]`;
            const method = level === 'error' ? 'error' : 
                          level === 'warn' ? 'warn' : 
                          level === 'info' ? 'info' : 'log';
            console[method](prefix, ...args);
        }
    }
    
    /**
     * 清除所有日志器
     */
    clear() {
        this.modules.clear();
    }
}

/**
 * 代码清理工具 - 检测和报告代码质量问题
 */
export const codeCleaner = {
    /**
     * 检测重复的事件监听器
     * @returns {Object} 检测结果
     */
    checkDuplicateListeners() {
        const report = {
            total: 0,
            duplicates: [],
            byType: {}
        };
        
        // 获取所有元素
        const elements = document.querySelectorAll('*');
        
        for (const element of elements) {
            if (typeof getEventListeners === 'function') {
                const listeners = getEventListeners(element);
                
                for (const [type, handlers] of Object.entries(listeners)) {
                    report.total += handlers.length;
                    
                    if (!report.byType[type]) {
                        report.byType[type] = 0;
                    }
                    report.byType[type] += handlers.length;
                    
                    // 检测重复（相同的监听器函数）
                    if (handlers.length > 1) {
                        const seen = new Set();
                        for (const handler of handlers) {
                            const key = handler.listener.toString();
                            if (seen.has(key)) {
                                report.duplicates.push({
                                    element: element.tagName + (element.id ? `#${element.id}` : ''),
                                    type,
                                    count: handlers.length
                                });
                                break;
                            }
                            seen.add(key);
                        }
                    }
                }
            }
        }
        
        return report;
    },
    
    /**
     * 生成代码质量报告
     */
    generateReport() {
        console.group('📊 代码质量报告');
        
        // 事件监听器统计
        console.group('🎧 事件监听器');
        console.log('已注册数量:', eventManager.count());
        const listenerReport = this.checkDuplicateListeners();
        console.log('总计:', listenerReport.total);
        console.log('按类型:', listenerReport.byType);
        if (listenerReport.duplicates.length > 0) {
            console.warn('⚠️ 发现重复监听器:', listenerReport.duplicates);
        } else {
            console.log('✅ 无重复监听器');
        }
        console.groupEnd();
        
        // 滑块统计
        console.group('🎚️ 滑块管理');
        console.log('已管理数量:', sliderManager.count());
        console.groupEnd();
        
        // 内存使用
        if (performance.memory) {
            console.group('💾 内存使用');
            const memory = performance.memory;
            console.log('已用:', (memory.usedJSHeapSize / 1024 / 1024).toFixed(2), 'MB');
            console.log('总计:', (memory.totalJSHeapSize / 1024 / 1024).toFixed(2), 'MB');
            console.log('限制:', (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2), 'MB');
            console.groupEnd();
        }
        
        console.groupEnd();
    },
    
    /**
     * 清理建议
     */
    getSuggestions() {
        const suggestions = [];
        
        // 检查事件监听器
        if (eventManager.count() > 50) {
            suggestions.push({
                type: 'warning',
                message: `事件监听器数量较多 (${eventManager.count()})，考虑使用事件委托`
            });
        }
        
        // 检查重复监听器
        const report = this.checkDuplicateListeners();
        if (report.duplicates.length > 0) {
            suggestions.push({
                type: 'error',
                message: `发现 ${report.duplicates.length} 处重复的事件监听器`,
                details: report.duplicates
            });
        }
        
        // 检查内存
        if (performance.memory) {
            const usage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
            if (usage > 0.8) {
                suggestions.push({
                    type: 'warning',
                    message: `内存使用率较高 (${(usage * 100).toFixed(1)}%)`
                });
            }
        }
        
        return suggestions;
    }
};

// =================================================================
// 导出默认配置
// =================================================================
export default {
    eventManager,
    sliderManager,
    LoggerManager,
    codeCleaner
};

