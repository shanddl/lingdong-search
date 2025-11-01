import { STATIC_CONFIG } from './constants.js';
import { logger } from './logger.js';

// =================================================================
// 统一存储模块 - 合并 storage.js 和 storage-manager.js 的功能
// 支持 chrome.storage.local 和 localStorage 双重存储
// =================================================================

// 存储键名常量（原StorageManager.KEYS）
export const STORAGE_KEYS = {
    CURRENT_WALLPAPER: 'currentWallpaper',
    WALLPAPER_LOCKED: 'wallpaperLocked',
    MY_UPLOADS: 'my_uploaded_wallpapers',
    RECENT_COLORS: 'recentColors',
    USER_DATA: 'userData'
};

export const storage = {
    // =================================================================
    // 主用户数据存储（支持chrome.storage同步）
    // =================================================================
    get: (callback) => {
        try {
            // 先从 localStorage 快速读取（避免等待 Service Worker）
            const localData = localStorage.getItem(STATIC_CONFIG.CONSTANTS.STORAGE_KEY);
            const localParsed = localData ? JSON.parse(localData) : null;
            
            // 如果 chrome.storage 不可用，直接返回 localStorage 数据
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                callback(localParsed);
                return;
            }
            
            // 标记是否已调用回调（防止重复调用）
            let callbackCalled = false;
            
            // 创建超时Promise（500ms超时）
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Chrome storage timeout')), 500);
            });
            
            // 尝试从 chrome.storage 读取
            Promise.race([
                chrome.storage.local.get(STATIC_CONFIG.CONSTANTS.STORAGE_KEY),
                timeoutPromise
            ])
            .then(result => {
                if (callbackCalled) return; // 防止重复调用
                callbackCalled = true;
                
                const chromeData = result[STATIC_CONFIG.CONSTANTS.STORAGE_KEY];
                
                if (chromeData) {
                    // 同步到 localStorage（静默失败）
                    try {
                        localStorage.setItem(STATIC_CONFIG.CONSTANTS.STORAGE_KEY, JSON.stringify(chromeData));
                    } catch (e) {
                        logger.warn('Failed to backup to localStorage:', e);
                    }
                    callback(chromeData);
                } else if (localParsed) {
                    // chrome.storage 为空但 localStorage 有数据，返回并同步
                    callback(localParsed);
                    chrome.storage.local.set({ [STATIC_CONFIG.CONSTANTS.STORAGE_KEY]: localParsed })
                        .catch(e => logger.warn('Failed to sync to chrome.storage:', e));
                } else {
                    // 两者都为空
                    callback(null);
                }
            })
            .catch(e => {
                if (callbackCalled) return; // 防止重复调用
                callbackCalled = true;
                
                // chrome.storage 失败，使用 localStorage
                logger.warn('Chrome storage failed or timeout, using localStorage:', e.message);
                callback(localParsed);
            });
            
        } catch (error) {
            logger.error('Storage get error:', error);
            callback(null);
        }
    },
    
    set: (data, callback) => {
        try {
            // 数据验证：确保 data 是有效对象
            if (!data || typeof data !== 'object') {
                const error = new Error('Invalid data: must be an object');
                logger.error('Storage set validation failed:', error);
                if (callback) callback(error);
                return;
            }
            
            // 1. 先保存到 localStorage（主存储）
            try {
                localStorage.setItem(STATIC_CONFIG.CONSTANTS.STORAGE_KEY, JSON.stringify(data));
            } catch (e) {
                // localStorage 失败（可能配额满了）
                logger.error('Failed to save to localStorage:', e);
                if (callback) callback(e);
                return; // localStorage 失败则中止
            }
            
            // 2. localStorage 成功后立即调用回调
            if (callback) callback(null);
            
            // 3. 异步同步到 chrome.storage（不阻塞主流程）
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Chrome storage set timeout')), 1000);
                });
                
                Promise.race([
                    chrome.storage.local.set({ [STATIC_CONFIG.CONSTANTS.STORAGE_KEY]: data }),
                    timeoutPromise
                ])
                .then(() => {
                    logger.debug('Successfully synced to chrome.storage.local');
                })
                .catch(e => {
                    // chrome.storage 失败不影响主流程（localStorage已成功）
                    // 但记录详细日志便于调试跨设备同步问题
                    logger.warn('Chrome storage sync failed (localStorage已保存):', {
                        error: e.message,
                        dataSize: JSON.stringify(data).length,
                        timestamp: new Date().toISOString()
                    });
                    // 注意：不调用callback(error)，因为本地保存已成功
                });
            }
        } catch (error) {
            logger.error('Storage set error:', error);
            if (callback) callback(error);
        }
    },

    // =================================================================
    // 通用存储方法（原StorageManager功能，仅使用localStorage）
    // =================================================================
    
    /**
     * 获取存储项（通用方法，仅localStorage）
     * @param {string} key - 存储键名
     * @param {*} defaultValue - 默认值
     * @returns {*} 存储的值或默认值
     */
    getItem: (key, defaultValue = null) => {
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
            logger.warn(`[Storage] 读取失败: ${key}`, error);
            return defaultValue;
        }
    },

    /**
     * 设置存储项（通用方法，仅localStorage）
     * @param {string} key - 存储键名
     * @param {*} value - 要存储的值
     * @returns {boolean} 是否成功
     */
    setItem: (key, value) => {
        try {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            localStorage.setItem(key, stringValue);
            return true;
        } catch (error) {
            logger.error(`[Storage] 保存失败: ${key}`, error);
            
            if (error.name === 'QuotaExceededError') {
                logger.error('❌ localStorage 配额已满！');
            }
            
            return false;
        }
    },

    /**
     * 删除存储项
     * @param {string} key - 存储键名
     * @returns {boolean} 是否成功
     */
    removeItem: (key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            logger.error(`[Storage] 删除失败: ${key}`, error);
            return false;
        }
    },

    /**
     * 清空所有存储（谨慎使用）
     * @returns {boolean} 是否成功
     */
    clear: () => {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            logger.error('[Storage] 清空失败', error);
            return false;
        }
    },

    /**
     * 获取存储使用情况
     * @returns {Object} {usedBytes, usedMB, usedPercentage}
     */
    getUsage: () => {
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
            logger.error('[Storage] 获取使用情况失败', error);
            return { usedBytes: 0, usedMB: 0, usedPercentage: 0 };
        }
    },

    /**
     * 检查是否有足够空间
     * @param {number} requiredBytes - 需要的字节数
     * @returns {boolean} 是否有足够空间
     */
    hasSpace: (requiredBytes) => {
        const usage = storage.getUsage();
        const maxSize = 5 * 1024 * 1024; // 5MB
        return (usage.usedBytes + requiredBytes) < maxSize;
    },

    /**
     * 获取所有键名
     * @returns {Array<string>} 所有键名
     */
    getAllKeys: () => {
        try {
            return Object.keys(localStorage);
        } catch (error) {
            logger.error('[Storage] 获取键名失败', error);
            return [];
        }
    },

    /**
     * 检查键是否存在
     * @param {string} key - 存储键名
     * @returns {boolean} 是否存在
     */
    has: (key) => {
        try {
            return localStorage.getItem(key) !== null;
        } catch (error) {
            logger.error(`[Storage] 检查键失败: ${key}`, error);
            return false;
        }
    }
};

// 向后兼容：导出 StorageManager 作为别名（逐步迁移后可以移除）
if (typeof window !== 'undefined') {
    window.StorageManager = {
        KEYS: STORAGE_KEYS,
        get: storage.getItem,
        set: storage.setItem,
        remove: storage.removeItem,
        clear: storage.clear,
        getUsage: storage.getUsage,
        hasSpace: storage.hasSpace,
        getAllKeys: storage.getAllKeys,
        has: storage.has
    };
}