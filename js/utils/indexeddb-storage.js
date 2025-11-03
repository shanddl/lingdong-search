// IndexedDB 存储管理器
// 【P0优化】替代localStorage，容量从5MB提升到50MB+

const DB_NAME = 'WallpaperLibraryDB';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';

/**
 * IndexedDB存储管理器
 * 提供类似localStorage的API，但容量更大
 */
class IndexedDBStorage {
    constructor() {
        this.db = null;
        this.isSupported = this.checkSupport();
        this.initPromise = null;
    }

    /**
     * 检查浏览器是否支持IndexedDB
     */
    checkSupport() {
        if (!window.indexedDB) {
            console.warn('⚠️ 浏览器不支持IndexedDB，将使用localStorage降级');
            return false;
        }
        return true;
    }

    /**
     * 初始化数据库
     */
    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        if (!this.isSupported) {
            console.log('📦 使用localStorage作为降级方案');
            return Promise.resolve();
        }

        this.initPromise = new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onerror = () => {
                    console.error('❌ IndexedDB打开失败:', request.error);
                    this.isSupported = false;
                    resolve(); // 降级到localStorage
                };

                request.onsuccess = () => {
                    this.db = request.result;
                    console.log('✅ IndexedDB初始化成功');
                    resolve();
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    // 创建对象存储
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                        objectStore.createIndex('uploadTime', 'uploadTime', { unique: false });
                        console.log('📦 创建IndexedDB对象存储');
                    }
                };
            } catch (error) {
                console.error('❌ IndexedDB初始化异常:', error);
                this.isSupported = false;
                resolve(); // 降级到localStorage
            }
        });

        return this.initPromise;
    }

    /**
     * 保存数据
     * @param {string} key - 存储键
     * @param {any} value - 存储值（会被JSON序列化）
     */
    async setItem(key, value) {
        await this.init();

        // 降级到localStorage
        if (!this.isSupported || !this.db) {
            try {
                localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('❌ localStorage保存失败:', error);
                throw error;
            }
        }

        // 使用IndexedDB
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const objectStore = transaction.objectStore(STORE_NAME);
                
                const data = {
                    id: key,
                    value: value,
                    timestamp: Date.now()
                };
                
                const request = objectStore.put(data);

                request.onsuccess = () => {
                    console.log(`✅ IndexedDB保存成功: ${key}`);
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('❌ IndexedDB保存失败:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('❌ IndexedDB事务失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 获取数据
     * @param {string} key - 存储键
     * @returns {Promise<any>} 存储的值
     */
    async getItem(key) {
        await this.init();

        // 降级到localStorage
        if (!this.isSupported || !this.db) {
            try {
                const value = localStorage.getItem(key);
                return value;
            } catch (error) {
                console.error('❌ localStorage读取失败:', error);
                return null;
            }
        }

        // 使用IndexedDB
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([STORE_NAME], 'readonly');
                const objectStore = transaction.objectStore(STORE_NAME);
                const request = objectStore.get(key);

                request.onsuccess = () => {
                    if (request.result) {
                        resolve(request.result.value);
                    } else {
                        resolve(null);
                    }
                };

                request.onerror = () => {
                    console.error('❌ IndexedDB读取失败:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('❌ IndexedDB事务失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 删除数据
     * @param {string} key - 存储键
     */
    async removeItem(key) {
        await this.init();

        // 降级到localStorage
        if (!this.isSupported || !this.db) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('❌ localStorage删除失败:', error);
                return false;
            }
        }

        // 使用IndexedDB
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const objectStore = transaction.objectStore(STORE_NAME);
                const request = objectStore.delete(key);

                request.onsuccess = () => {
                    console.log(`✅ IndexedDB删除成功: ${key}`);
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('❌ IndexedDB删除失败:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('❌ IndexedDB事务失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 清空所有数据
     */
    async clear() {
        await this.init();

        // 降级到localStorage
        if (!this.isSupported || !this.db) {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.error('❌ localStorage清空失败:', error);
                return false;
            }
        }

        // 使用IndexedDB
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const objectStore = transaction.objectStore(STORE_NAME);
                const request = objectStore.clear();

                request.onsuccess = () => {
                    console.log('✅ IndexedDB清空成功');
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('❌ IndexedDB清空失败:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('❌ IndexedDB事务失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 获取所有键
     */
    async getAllKeys() {
        await this.init();

        // 降级到localStorage
        if (!this.isSupported || !this.db) {
            try {
                return Object.keys(localStorage);
            } catch (error) {
                console.error('❌ localStorage获取键列表失败:', error);
                return [];
            }
        }

        // 使用IndexedDB
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([STORE_NAME], 'readonly');
                const objectStore = transaction.objectStore(STORE_NAME);
                const request = objectStore.getAllKeys();

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = () => {
                    console.error('❌ IndexedDB获取键列表失败:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('❌ IndexedDB事务失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 获取存储空间使用情况
     */
    async getStorageEstimate() {
        if (!navigator.storage || !navigator.storage.estimate) {
            return {
                usage: 0,
                quota: 0,
                percentage: 0,
                supported: false
            };
        }

        try {
            const estimate = await navigator.storage.estimate();
            const usage = estimate.usage || 0;
            const quota = estimate.quota || 0;
            const percentage = quota > 0 ? ((usage / quota) * 100).toFixed(2) : 0;

            return {
                usage: (usage / (1024 * 1024)).toFixed(2), // MB
                quota: (quota / (1024 * 1024)).toFixed(2), // MB
                percentage: percentage,
                supported: true
            };
        } catch (error) {
            console.error('❌ 获取存储空间信息失败:', error);
            return {
                usage: 0,
                quota: 0,
                percentage: 0,
                supported: false
            };
        }
    }

    /**
     * 从localStorage迁移到IndexedDB
     */
    async migrateFromLocalStorage() {
        if (!this.isSupported) {
            console.warn('⚠️ IndexedDB不可用，无法迁移');
            return false;
        }

        await this.init();

        try {
            console.log('🔄 开始从localStorage迁移数据到IndexedDB...');
            let migratedCount = 0;
            const keys = Object.keys(localStorage);

            for (const key of keys) {
                try {
                    const value = localStorage.getItem(key);
                    await this.setItem(key, value);
                    migratedCount++;
                } catch (error) {
                    console.warn(`⚠️ 迁移键 "${key}" 失败:`, error);
                }
            }

            console.log(`✅ 迁移完成，成功迁移 ${migratedCount}/${keys.length} 个项目`);
            return true;
        } catch (error) {
            console.error('❌ 数据迁移失败:', error);
            return false;
        }
    }

    /**
     * 关闭数据库连接（已优化：避免连接泄漏）
     * @returns {void}
     */
    close() {
        if (this.db) {
            try {
                this.db.close();
                this.db = null;
                console.log('✅ IndexedDB连接已关闭');
            } catch (error) {
                console.error('❌ IndexedDB关闭失败:', error);
            }
        }
    }
}

// 创建单例
const indexedDBStorage = new IndexedDBStorage();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = indexedDBStorage;
}

