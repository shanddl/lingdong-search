// =================================================================
// 按钮组管理工具 - 统一按钮组状态切换逻辑
// =================================================================

import { DOMHelper } from './domHelper.js';

/**
 * 按钮组辅助工具
 */
export const ButtonGroupHelper = {
    /**
     * 创建单选按钮组
     * @param {HTMLElement} container - 容器元素
     * @param {string} buttonSelector - 按钮选择器
     * @param {Function} onSelect - 选择回调函数 (selectedButton, allButtons) => {}
     * @param {Object} options - 选项
     * @param {string[]} options.classes - 激活类名，默认['active', 'selected']
     * @param {string} options.activeValue - 初始激活值（从dataset获取）
     * @returns {void}
     */
    create(container, buttonSelector, onSelect, options = {}) {
        if (!container) return;
        
        const {
            classes = ['active', 'selected'],
            activeValue = null
        } = options;
        
        const buttons = container.querySelectorAll(buttonSelector);
        
        if (!buttons.length) return;
        
        // 设置初始激活状态
        if (activeValue) {
            buttons.forEach(btn => {
                const value = btn.dataset.value || btn.dataset.align || btn.dataset.shape;
                if (value === activeValue) {
                    DOMHelper.toggleButtonGroup(buttons, null, btn, classes);
                }
            });
        }
        
        // 绑定点击事件
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // 切换按钮组状态
                DOMHelper.toggleButtonGroup(buttons, null, btn, classes);
                
                // 调用回调
                if (onSelect) {
                    onSelect(btn, buttons);
                }
            });
        });
    },
    
    /**
     * 更新按钮组激活状态
     * @param {HTMLElement|NodeList} buttons - 按钮列表或容器
     * @param {string} selector - 选择器（如果buttons是容器）
     * @param {string|HTMLElement} activeTarget - 激活目标（值或元素）
     * @param {string[]} classes - 激活类名
     * @param {Function} getValue - 获取按钮值的函数 (btn) => value
     * @returns {void}
     */
    updateActiveState(buttons, selector, activeTarget, classes = ['active', 'selected'], getValue = null) {
        const buttonList = selector 
            ? buttons.querySelectorAll(selector)
            : (buttons instanceof NodeList || Array.isArray(buttons) ? buttons : [buttons]);
        
        buttonList.forEach(btn => {
            const value = getValue 
                ? getValue(btn)
                : (btn.dataset.value || btn.dataset.align || btn.dataset.shape);
            
            const isActive = typeof activeTarget === 'string'
                ? value === activeTarget
                : btn === activeTarget;
            
            if (isActive && btn.classList) {
                DOMHelper.toggleButtonGroup(buttonList, null, btn, classes);
            }
        });
    }
};








