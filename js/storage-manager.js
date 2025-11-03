// localStorage 统一管理模块
// 提供类型安全的存储操作和错误处理

const StorageManager = {
    // 存储键名常量
    KEYS: {
        CURRENT_WALLPAPER: 'currentWallpaper',
        WALLPAPER_LOCKED: 'wallpaperLocked',
        MY_UPLOADS: 'my_uploaded_wallpapers',
        RECENT_COLORS: 'recentColors',
        USER_DATA: 'userData'
    },
    
    /**
     * 获取存储项
     * @param {string} key - 存储键名
     * @param {*} defaultValue - 默认值
     * @returns {*} 存储的值或默认值
     */
    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;
            
            // 尝试解析JSON
            try {
                return JSON.parse(value);
            } catch {
                // 如果不是JSON，返回原始字符串
                return value;
            }
        } catch (error) {
            console.warn(`[StorageManager] 读取失败: ${key}`, error);
            return defaultValue;
        }
    },
    
    /**
     * 设置存储项
     * @param {string} key - 存储键名
     * @param {*} value - 要存储的值
     * @returns {boolean} 是否成功
     */
    set(key, value) {
        try {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            localStorage.setItem(key, stringValue);
            return true;
        } catch (error) {
            console.error(`[StorageManager] 保存失败: ${key}`, error);
            
            if (error.name === 'QuotaExceededError') {
                console.error('❌ localStorage 配额已满！');
            }
            
            return false;
        }
    },
    
    /**
     * 删除存储项
     * @param {string} key - 存储键名
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`[StorageManager] 删除失败: ${key}`, error);
            return false;
        }
    },
    
    /**
     * 清空所有存储
     */
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('[StorageManager] 清空失败', error);
            return false;
        }
    },
    
    /**
     * 获取存储使用情况
     * @returns {Object} {usedBytes, usedMB, usedPercentage}
     */
    getUsage() {
        try {
            let total = 0;
            const keys = Object.keys(localStorage);
            
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const value = localStorage.getItem(key);
                if (value !== null) {
                    total += value.length + key.length;
                }
            }
            
            const usedMB = (total / (1024 * 1024)).toFixed(2);
            const maxSize = 5 * 1024 * 1024; // 假设5MB限制
            const usedPercentage = Math.round((total / maxSize) * 100);
            
            return {
                usedBytes: total,
                usedMB: parseFloat(usedMB),
                usedPercentage: usedPercentage
            };
        } catch (error) {
            console.error('[StorageManager] 获取使用情况失败', error);
            return { usedBytes: 0, usedMB: 0, usedPercentage: 0 };
        }
    },
    
    /**
     * 检查是否有足够空间
     * @param {number} requiredBytes - 需要的字节数
     * @returns {boolean} 是否有足够空间
     */
    hasSpace(requiredBytes) {
        const usage = this.getUsage();
        const maxSize = 5 * 1024 * 1024; // 5MB
        return (usage.usedBytes + requiredBytes) < maxSize;
    },
    
    /**
     * 获取所有键名
     * @returns {Array<string>} 所有键名
     */
    getAllKeys() {
        try {
            return Object.keys(localStorage);
        } catch (error) {
            console.error('[StorageManager] 获取键名失败', error);
            return [];
        }
    },
    
    /**
     * 检查键是否存在
     * @param {string} key - 存储键名
     * @returns {boolean} 是否存在
     */
    has(key) {
        try {
            return localStorage.getItem(key) !== null;
        } catch (error) {
            console.error(`[StorageManager] 检查键失败: ${key}`, error);
            return false;
        }
    }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}

// 全局可用
if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
}

