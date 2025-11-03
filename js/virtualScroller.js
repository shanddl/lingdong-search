// =================================================================
// 虚拟滚动模块 - 优化大量列表的渲染性能
// =================================================================

import { config } from './config.js';
import { logger } from './logger.js';
import { eventManager } from './eventManager.js';
import { timerManager } from './utils/timerManager.js';

/**
 * 虚拟滚动器类
 * 只渲染可见区域的项目，大幅减少DOM节点数量和内存占用
 */
export class VirtualScroller {
    /**
     * @param {Object} options - 配置选项
     * @param {HTMLElement} options.container - 滚动容器
     * @param {Array} options.data - 数据数组
     * @param {Function} options.renderItem - 渲染单个项目的函数 (item, index) => HTMLElement
     * @param {number} options.itemHeight - 每个项目的高度（px）
     * @param {number} options.itemsPerRow - 每行项目数
     */
    constructor(options) {
        this.container = options.container;
        this.data = options.data || [];
        this.renderItem = options.renderItem;
        this.itemHeight = options.itemHeight || config.performance.virtualScroll.itemHeight;
        this.itemsPerRow = options.itemsPerRow || 1;
        this.bufferSize = options.bufferSize || config.performance.virtualScroll.bufferSize;
        
        // 内部状态
        this.visibleItems = [];
        this.startIndex = 0;
        this.endIndex = 0;
        this.scrollTop = 0;
        
        // 创建滚动容器结构
        this.init();
    }
    
    /**
     * 初始化虚拟滚动器
     */
    init() {
        // 创建内容容器
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'virtual-scroller-content';
        this.contentContainer.style.position = 'relative';
        
        // 创建占位容器（撑起滚动高度）
        this.spacer = document.createElement('div');
        this.spacer.style.position = 'absolute';
        this.spacer.style.top = '0';
        this.spacer.style.left = '0';
        this.spacer.style.width = '1px';
        this.spacer.style.height = `${this.getTotalHeight()}px`;
        this.spacer.style.pointerEvents = 'none';
        
        // 清空容器并添加新结构
        this.container.innerHTML = '';
        this.container.appendChild(this.spacer);
        this.container.appendChild(this.contentContainer);
        
        // 设置容器样式
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        
        // 绑定滚动事件
        this.bindEvents();
        
        // 首次渲染
        this.render();
        
        logger.info('[VirtualScroller] 初始化完成', {
            totalItems: this.data.length,
            itemHeight: this.itemHeight,
            itemsPerRow: this.itemsPerRow
        });
    }
    
    /**
     * 获取总高度
     */
    getTotalHeight() {
        const totalRows = Math.ceil(this.data.length / this.itemsPerRow);
        return totalRows * this.itemHeight;
    }
    
    /**
     * 计算可见范围
     */
    calculateVisibleRange() {
        const containerHeight = this.container.clientHeight;
        const scrollTop = this.container.scrollTop;
        
        // 计算可见行范围
        const visibleRowStart = Math.floor(scrollTop / this.itemHeight);
        const visibleRowEnd = Math.ceil((scrollTop + containerHeight) / this.itemHeight);
        
        // 添加缓冲区
        const bufferRowStart = Math.max(0, visibleRowStart - this.bufferSize);
        const bufferRowEnd = Math.min(
            Math.ceil(this.data.length / this.itemsPerRow),
            visibleRowEnd + this.bufferSize
        );
        
        // 转换为项目索引
        this.startIndex = bufferRowStart * this.itemsPerRow;
        this.endIndex = Math.min(
            bufferRowEnd * this.itemsPerRow,
            this.data.length
        );
        
        logger.debug('[VirtualScroller] 可见范围', {
            scrollTop,
            startIndex: this.startIndex,
            endIndex: this.endIndex,
            visibleItems: this.endIndex - this.startIndex
        });
    }
    
    /**
     * 渲染可见项目
     */
    render() {
        this.calculateVisibleRange();
        
        // 创建文档片段
        const fragment = document.createDocumentFragment();
        
        // 渲染可见范围内的项目
        for (let i = this.startIndex; i < this.endIndex; i++) {
            const item = this.data[i];
            if (!item) continue;
            
            const element = this.renderItem(item, i);
            
            // 计算位置
            const row = Math.floor(i / this.itemsPerRow);
            const col = i % this.itemsPerRow;
            const top = row * this.itemHeight;
            
            // 设置绝对定位
            element.style.position = 'absolute';
            element.style.top = `${top}px`;
            
            // 如果是网格布局，设置left
            if (this.itemsPerRow > 1) {
                const itemWidth = 100 / this.itemsPerRow;
                element.style.left = `${col * itemWidth}%`;
                element.style.width = `${itemWidth}%`;
            }
            
            fragment.appendChild(element);
        }
        
        // 清空并重新添加
        this.contentContainer.innerHTML = '';
        this.contentContainer.appendChild(fragment);
        
        // 更新占位高度
        this.spacer.style.height = `${this.getTotalHeight()}px`;
    }
    
    /**
     * 绑定事件（已优化：使用eventManager和timerManager统一管理，避免内存泄漏）
     */
    bindEvents() {
        // 【修复】如果已经绑定过事件，先清理，避免重复绑定导致内存泄漏
        if (this.scrollEventId) {
            eventManager.remove(this.scrollEventId);
            this.scrollEventId = null;
        }
        
        // 创建scroll事件处理函数
        const scrollHandler = () => {
            // 【内存优化】使用timerManager统一管理定时器，避免内存泄漏
            timerManager.clearTimeout(`virtualScroller-${this.container.id || 'default'}`);
            timerManager.setTimeout(`virtualScroller-${this.container.id || 'default'}`, () => {
                if (this.scrollTop !== this.container.scrollTop) {
                    this.scrollTop = this.container.scrollTop;
                    this.render();
                }
            }, 16); // ~60fps
        };
        
        // 【内存优化】使用eventManager统一管理事件监听器，避免内存泄漏
        this.scrollEventId = eventManager.add(this.container, 'scroll', scrollHandler);
    }
    
    /**
     * 更新数据
     * @param {Array} newData - 新数据
     */
    updateData(newData) {
        this.data = newData;
        this.startIndex = 0;
        this.endIndex = 0;
        this.scrollTop = 0;
        this.container.scrollTop = 0;
        this.render();
        
        logger.info('[VirtualScroller] 数据已更新', {
            items: newData.length
        });
    }
    
    /**
     * 追加数据
     * @param {Array} additionalData - 追加的数据
     */
    appendData(additionalData) {
        this.data = [...this.data, ...additionalData];
        this.render();
        
        logger.info('[VirtualScroller] 数据已追加', {
            added: additionalData.length,
            total: this.data.length
        });
    }
    
    /**
     * 销毁虚拟滚动器（已优化：完整清理所有资源，避免内存泄漏）
     */
    destroy() {
        // 【内存优化】移除事件监听器
        if (this.scrollEventId) {
            eventManager.remove(this.scrollEventId);
            this.scrollEventId = null;
        }
        
        // 【内存优化】清理定时器
        timerManager.clearTimeout(`virtualScroller-${this.container.id || 'default'}`);
        
        // 清空容器内容
        this.container.innerHTML = '';
        
        // 清理引用
        this.container = null;
        this.data = null;
        this.renderItem = null;
        this.visibleItems = [];
        
        logger.info('[VirtualScroller] 已销毁');
    }
}

/**
 * 创建虚拟滚动器工厂函数
 * @param {HTMLElement} container - 容器元素
 * @param {Array} data - 数据数组
 * @param {Function} renderItem - 渲染函数
 * @param {Object} options - 额外配置
 * @returns {VirtualScroller|null} 虚拟滚动器实例或null（如果不启用）
 */
export function createVirtualScroller(container, data, renderItem, options = {}) {
    // 检查是否启用虚拟滚动
    if (!config.performance.virtualScroll.enabled) {
        logger.info('[VirtualScroller] 虚拟滚动未启用');
        return null;
    }
    
    // 检查数据量是否达到阈值
    if (data.length < config.performance.virtualScroll.threshold) {
        logger.info('[VirtualScroller] 数据量未达到阈值，使用普通渲染', {
            dataLength: data.length,
            threshold: config.performance.virtualScroll.threshold
        });
        return null;
    }
    
    return new VirtualScroller({
        container,
        data,
        renderItem,
        ...options
    });
}

