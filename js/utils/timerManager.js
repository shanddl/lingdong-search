// =================================================================
// 定时器管理工具 - 统一管理所有定时器，避免内存泄漏
// =================================================================

/**
 * 定时器管理器
 */
class TimerManager {
    constructor() {
        this.timers = new Map(); // 存储所有定时器
    }
    
    /**
     * 创建setTimeout
     * @param {string} id - 定时器ID（用于后续清理）
     * @param {Function} fn - 要执行的函数
     * @param {number} delay - 延迟时间（毫秒）
     * @returns {number} 定时器ID
     */
    setTimeout(id, fn, delay) {
        // 如果已存在同名定时器，先清除
        this.clearTimeout(id);
        
        const timerId = setTimeout(() => {
            fn();
            this.timers.delete(id);
        }, delay);
        
        this.timers.set(id, { type: 'timeout', id: timerId });
        return timerId;
    }
    
    /**
     * 创建setInterval
     * @param {string} id - 定时器ID
     * @param {Function} fn - 要执行的函数
     * @param {number} interval - 间隔时间（毫秒）
     * @returns {number} 定时器ID
     */
    setInterval(id, fn, interval) {
        // 如果已存在同名定时器，先清除
        this.clearInterval(id);
        
        const timerId = setInterval(fn, interval);
        
        this.timers.set(id, { type: 'interval', id: timerId });
        return timerId;
    }
    
    /**
     * 清除setTimeout
     * @param {string} id - 定时器ID
     * @returns {void}
     */
    clearTimeout(id) {
        const timer = this.timers.get(id);
        if (timer && timer.type === 'timeout') {
            clearTimeout(timer.id);
            this.timers.delete(id);
        }
    }
    
    /**
     * 清除setInterval
     * @param {string} id - 定时器ID
     * @returns {void}
     */
    clearInterval(id) {
        const timer = this.timers.get(id);
        if (timer && timer.type === 'interval') {
            clearInterval(timer.id);
            this.timers.delete(id);
        }
    }
    
    /**
     * 清除所有定时器（已优化：完整清理）
     * @returns {void}
     */
    clearAll() {
        this.timers.forEach((timer, id) => {
            if (timer.type === 'timeout') {
                clearTimeout(timer.id);
            } else if (timer.type === 'interval') {
                clearInterval(timer.id);
            }
        });
        this.timers.clear();
    }
    
    /**
     * 【新增】重置管理器状态（用于页面刷新）
     * 清除所有定时器，但保留实例
     */
    reset() {
        this.clearAll();
    }
    
    /**
     * 获取定时器数量
     * @returns {number}
     */
    count() {
        return this.timers.size;
    }
}

// 导出单例实例
export const timerManager = new TimerManager();

// 【根本修复】页面加载时立即重置，确保每次刷新都是干净状态
// 在DOMContentLoaded之前执行，避免与页面卸载时的清理冲突
if (typeof window !== 'undefined' && document.readyState === 'loading') {
    // 页面正在加载，重置单例状态
    timerManager.reset();
}

