import { STATIC_CONFIG } from './constants.js';
import { logger } from './logger.js';

// =================================================================
// 浏览器存储模块 - 使用 chrome.storage.local 和 localStorage 双重存储
// =================================================================
export const storage = {
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
    }
};