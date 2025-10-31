// =================================================================
// 拖拽辅助工具 - 提取通用拖拽处理逻辑，消除代码冗余
// =================================================================

/**
 * 通用列表项拖拽处理器工厂
 * 用于处理列表项的上下拖拽排序
 * 
 * @param {Object} config - 配置对象
 * @param {string} config.itemSelector - 列表项选择器（如'.list-item'）
 * @param {string} config.draggingClass - 拖拽中的样式类（默认'dragging'）
 * @param {Function} config.onReorder - 重新排序回调函数，接收(draggedIndex, targetIndex, insertIndex)
 * @returns {Object} 包含拖拽事件处理器的对象
 */
export function createListDragHandlers(config) {
    const {
        itemSelector,
        draggingClass = 'dragging',
        onReorder
    } = config;

    return {
        /**
         * 开始拖拽
         */
        onDragStart: (e) => {
            const item = e.target.closest(itemSelector);
            if (item) {
                item.classList.add(draggingClass);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.dataset.id);
            }
        },

        /**
         * 拖拽经过
         */
        onDragOver: (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const targetItem = e.target.closest(itemSelector);
            if (!targetItem) return;

            const draggedId = e.dataTransfer.getData('text/plain');
            const draggedItem = document.querySelector(`${itemSelector}[data-id="${draggedId}"]`);
            if (!draggedItem || draggedItem === targetItem) return;

            // 计算插入位置（上半部分或下半部分）
            const rect = targetItem.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;

            // 添加视觉指示器
            if (e.clientY < midpoint) {
                targetItem.classList.add('drag-over-top');
                targetItem.classList.remove('drag-over-bottom');
            } else {
                targetItem.classList.add('drag-over-bottom');
                targetItem.classList.remove('drag-over-top');
            }
        },

        /**
         * 拖拽结束
         */
        onDragEnd: (e) => {
            // 清理所有样式
            document.querySelectorAll(itemSelector).forEach(item => {
                item.classList.remove(draggingClass, 'drag-over-top', 'drag-over-bottom');
            });
        },

        /**
         * 放置
         */
        onDrop: (e) => {
            e.preventDefault();

            // 清理所有视觉指示器
            document.querySelectorAll(itemSelector).forEach(item => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            const targetItem = e.target.closest(itemSelector);
            if (!targetItem) return;

            const draggedId = e.dataTransfer.getData('text/plain');
            if (!draggedId || draggedId === targetItem.dataset.id) return;

            // 计算插入位置
            const rect = targetItem.getBoundingClientRect();
            const insertBefore = e.clientY < (rect.top + rect.height / 2);

            // 调用重新排序回调
            if (onReorder) {
                onReorder(draggedId, targetItem.dataset.id, insertBefore);
            }
        }
    };
}

/**
 * 通用标签页拖拽处理器工厂
 * 用于处理标签页的左右拖拽排序
 * 
 * @param {Object} config - 配置对象
 * @param {string} config.tabSelector - 标签选择器（如'.tab-btn'）
 * @param {string} config.containerSelector - 容器选择器
 * @param {Function} config.onReorder - 重新排序回调函数
 * @returns {Object} 包含拖拽事件处理器的对象
 */
export function createTabDragHandlers(config) {
    const {
        tabSelector,
        containerSelector,
        onReorder
    } = config;

    let state = {
        draggedTab: null,
        startingIndex: null
    };

    return {
        /**
         * 开始拖拽标签
         */
        onDragStart: (e) => {
            const tab = e.target.closest(tabSelector);
            if (tab && tab.draggable) {
                state.draggedTab = tab;

                // 计算并存储初始位置
                const container = document.querySelector(containerSelector);
                if (container) {
                    const tabs = Array.from(container.querySelectorAll(tabSelector));
                    state.startingIndex = tabs.indexOf(tab);
                }

                e.dataTransfer.effectAllowed = 'move';
                tab.classList.add('dragging');
            }
        },

        /**
         * 拖拽结束
         */
        onDragEnd: (e) => {
            const tab = e.target.closest(tabSelector);
            if (tab) {
                tab.classList.remove('dragging');
            }

            // 重置变量
            state.draggedTab = null;
            state.startingIndex = null;
        },

        /**
         * 拖拽经过
         */
        onDragOver: (e) => {
            e.preventDefault();

            const tab = e.target.closest(tabSelector);
            if (!tab || !state.draggedTab) return;

            // 阻止在自身上放置
            if (tab === state.draggedTab) return;

            // 获取目标元素的边界矩形
            const rect = tab.getBoundingClientRect();

            // 确定光标在目标元素的左侧还是右侧
            const midpoint = rect.left + rect.width / 2;

            // 根据光标位置决定插入位置
            if (e.clientX < midpoint) {
                // 光标在左侧，将拖拽元素插入到目标元素之前
                tab.parentNode.insertBefore(state.draggedTab, tab);
            } else {
                // 光标在右侧，将拖拽元素插入到目标元素之后
                tab.parentNode.insertBefore(state.draggedTab, tab.nextSibling);
            }
        },

        /**
         * 放置标签
         */
        onDrop: (e) => {
            e.preventDefault();

            if (!state.draggedTab || state.startingIndex === null) return;

            // 计算最终索引
            const container = document.querySelector(containerSelector);
            if (!container) return;

            const tabs = Array.from(container.querySelectorAll(tabSelector));
            const finalIndex = tabs.indexOf(state.draggedTab);

            // 比较起始索引和最终索引
            if (state.startingIndex !== finalIndex && onReorder) {
                onReorder(state.startingIndex, finalIndex);
            }
        },

        // 导出state供外部访问
        getState: () => state
    };
}

/**
 * 为数组数据重新排序（通用辅助函数）
 * 
 * @param {Array} array - 要排序的数组
 * @param {string} draggedId - 被拖拽项的ID
 * @param {string} targetId - 目标项的ID
 * @param {boolean} insertBefore - 是否插入到目标之前
 * @param {string} idKey - ID字段名（默认'id'）
 * @returns {Array} 重新排序后的数组
 */
export function reorderArray(array, draggedId, targetId, insertBefore, idKey = 'id') {
    const draggedIndex = array.findIndex(item => item[idKey] === draggedId);
    const targetIndex = array.findIndex(item => item[idKey] === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return array;

    // 移动元素
    const [movedItem] = array.splice(draggedIndex, 1);

    // 计算插入位置
    const insertIndex = insertBefore ? targetIndex : targetIndex + 1;

    array.splice(insertIndex, 0, movedItem);

    return array;
}

/**
 * 为标签页数组重新排序
 * 
 * @param {Array} tabsArray - 标签页数组
 * @param {number} startIndex - 起始索引
 * @param {number} endIndex - 结束索引
 * @returns {Array} 重新排序后的数组
 */
export function reorderTabs(tabsArray, startIndex, endIndex) {
    const [movedTab] = tabsArray.splice(startIndex, 1);
    tabsArray.splice(endIndex, 0, movedTab);
    return tabsArray;
}

