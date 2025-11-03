// =================================================================
// LRU缓存工具 - 实现最近最少使用缓存，自动清理最久未使用的项
// =================================================================

/**
 * LRU缓存类
 * 实现最近最少使用（Least Recently Used）缓存机制
 * 当缓存达到上限时，自动删除最久未使用的项
 */
export class LRUCache {
    /**
     * @param {number} maxSize - 最大缓存数量
     * @param {Function} onEvict - 可选：当项被淘汰时的回调函数 (key, value) => void
     */
    constructor(maxSize = 50, onEvict = null) {
        this.maxSize = maxSize;
        this.cache = new Map(); // 存储缓存数据（Map保持插入顺序）
        this.onEvict = onEvict; // 淘汰回调
    }

    /**
     * 获取缓存值
     * @param {string} key - 缓存键
     * @returns {*} 缓存值，如果不存在返回undefined
     */
    get(key) {
        if (!this.cache.has(key)) {
            return undefined;
        }
        
        // 将访问的项移到末尾（最近使用）
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        
        return value;
    }

    /**
     * 设置缓存值
     * @param {string} key - 缓存键
     * @param {*} value - 缓存值
     * @returns {boolean} 是否成功设置
     */
    set(key, value) {
        // 如果已存在，先删除（然后会重新添加到末尾）
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // 如果已达到上限，删除最久未使用的项（Map的第一个项）
        else if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            const firstValue = this.cache.get(firstKey);
            
            // 调用淘汰回调
            if (this.onEvict && typeof this.onEvict === 'function') {
                try {
                    this.onEvict(firstKey, firstValue);
                } catch (error) {
                    console.warn('[LRUCache] onEvict callback error:', error);
                }
            }
            
            this.cache.delete(firstKey);
        }
        
        // 将新项添加到末尾（最近使用）
        this.cache.set(key, value);
        return true;
    }

    /**
     * 检查缓存中是否存在指定键
     * @param {string} key - 缓存键
     * @returns {boolean}
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * 删除缓存项
     * @param {string} key - 缓存键
     * @returns {boolean} 是否成功删除
     */
    delete(key) {
        return this.cache.delete(key);
    }

    /**
     * 清空所有缓存
     */
    clear() {
        this.cache.clear();
    }

    /**
     * 获取缓存大小
     * @returns {number}
     */
    get size() {
        return this.cache.size;
    }

    /**
     * 获取所有键
     * @returns {Iterator}
     */
    keys() {
        return this.cache.keys();
    }

    /**
     * 获取所有值
     * @returns {Iterator}
     */
    values() {
        return this.cache.values();
    }

    /**
     * 获取所有键值对
     * @returns {Iterator}
     */
    entries() {
        return this.cache.entries();
    }

    /**
     * 遍历缓存（从最近使用到最久未使用）
     * @param {Function} callback - 回调函数 (value, key, cache) => void
     * @param {Object} thisArg - 回调函数的this上下文
     */
    forEach(callback, thisArg) {
        // 反向遍历（从最近到最久）
        const entries = Array.from(this.cache.entries()).reverse();
        entries.forEach(([key, value]) => {
            callback.call(thisArg, value, key, this);
        });
    }

    /**
     * 批量清理：删除指定数量的最久未使用项
     * @param {number} count - 要删除的数量
     * @returns {number} 实际删除的数量
     */
    evict(count) {
        let deleted = 0;
        const entries = Array.from(this.cache.entries());
        
        for (let i = 0; i < Math.min(count, entries.length); i++) {
            const [key, value] = entries[i];
            
            // 调用淘汰回调
            if (this.onEvict && typeof this.onEvict === 'function') {
                try {
                    this.onEvict(key, value);
                } catch (error) {
                    console.warn('[LRUCache] onEvict callback error:', error);
                }
            }
            
            this.cache.delete(key);
            deleted++;
        }
        
        return deleted;
    }

    /**
     * 缩减缓存大小到指定值
     * @param {number} newSize - 新的最大缓存数量
     */
    resize(newSize) {
        if (newSize < 0) {
            console.warn('[LRUCache] Invalid newSize:', newSize);
            return;
        }
        
        this.maxSize = newSize;
        
        // 如果当前大小超过新上限，删除最久未使用的项
        if (this.cache.size > newSize) {
            const toEvict = this.cache.size - newSize;
            this.evict(toEvict);
        }
    }
}
