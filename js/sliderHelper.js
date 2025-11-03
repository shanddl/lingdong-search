// =================================================================
// 滑块辅助工具 - 提取通用滑块初始化逻辑，消除代码冗余
// =================================================================

import { eventManager } from './eventManager.js';
import { state } from './state.js';
import { core } from './core.js';
import { utils } from './utils.js';

/**
 * 通用滑块初始化函数
 * 统一处理所有滑块的input和change事件
 * 
 * @param {Object} config - 滑块配置对象
 * @param {HTMLElement} config.slider - 滑块DOM元素
 * @param {HTMLElement} config.valueDisplay - 显示值的DOM元素
 * @param {Function} config.applyFunction - 应用滑块值的函数
 * @param {string} config.userDataKey - 保存到userData的键名
 * @param {string} config.successMessage - 保存成功的提示消息
 * @param {Function} [config.formatValue] - 格式化显示值的函数，默认直接显示
 * @param {Function} [config.transformValue] - 转换值的函数（用于change事件），默认Number
 * @param {boolean} [config.useThrottle] - 是否使用节流（默认true）
 * @param {Array} globalEventIds - 全局事件ID数组，用于存储事件ID
 * @param {Function} throttleFunc - 节流函数（从main.js传入）
 * @returns {void}
 */
export function initSlider(config, globalEventIds, throttleFunc) {
    const {
        slider,
        valueDisplay,
        applyFunction,
        userDataKey,
        successMessage,
        formatValue = (v) => v,
        transformValue = (v) => Number(v),
        useThrottle = true
    } = config;

    // 验证必需参数
    if (!slider || !applyFunction || !userDataKey) {
        console.warn('SliderHelper: Missing required parameters');
        return;
    }

    // Input事件：实时更新显示和应用效果
    globalEventIds.push(
        eventManager.add(slider, 'input', (e) => {
            const value = e.target.value;
            
            // 更新显示值
            if (valueDisplay) {
                valueDisplay.textContent = formatValue(value);
            }
            
            // 应用效果（使用节流或直接调用）
            if (useThrottle && throttleFunc) {
                throttleFunc(() => applyFunction(value), value);
            } else {
                applyFunction(value);
            }
        })
    );

    // Change事件：保存到userData
    globalEventIds.push(
        eventManager.add(slider, 'change', (e) => {
            const value = transformValue(e.target.value);
            
            // 保存到userData
            state.userData[userDataKey] = value;
            
            // 保存并显示提示
            core.saveUserData(() => {
                if (successMessage) {
                }
            });
        })
    );
}

/**
 * 批量初始化多个滑块
 * 
 * @param {Array<Object>} sliders - 滑块配置数组
 * @param {Array} globalEventIds - 全局事件ID数组
 * @param {Function} throttleFunc - 节流函数
 * @returns {void}
 */
export function initSliders(sliders, globalEventIds, throttleFunc) {
    sliders.forEach(config => {
        if (config.slider) {
            initSlider(config, globalEventIds, throttleFunc);
        }
    });
}

/**
 * 初始化嵌套对象的滑块（如 engineSettings.size）
 * 
 * @param {Object} config - 配置对象（扩展版）
 * @param {string} config.parentKey - 父对象键名（如 'engineSettings'）
 * @param {string} config.childKey - 子对象键名（如 'size'）
 * @param {Array} globalEventIds - 全局事件ID数组
 * @param {Function} throttleFunc - 节流函数
 * @returns {void}
 */
export function initNestedSlider(config, globalEventIds, throttleFunc) {
    const {
        slider,
        valueDisplay,
        applyFunction,
        parentKey,
        childKey,
        successMessage,
        formatValue = (v) => v,
        transformValue = (v) => Number(v),
        useThrottle = true
    } = config;

    if (!slider || !applyFunction || !parentKey || !childKey) {
        console.warn('SliderHelper: Missing required parameters for nested slider');
        return;
    }

    // Input事件
    globalEventIds.push(
        eventManager.add(slider, 'input', (e) => {
            const value = e.target.value;
            
            if (valueDisplay) {
                valueDisplay.textContent = formatValue(value);
            }
            
            if (useThrottle && throttleFunc) {
                throttleFunc(() => applyFunction(value), value);
            } else {
                applyFunction(value);
            }
        })
    );

    // Change事件：保存到嵌套对象
    globalEventIds.push(
        eventManager.add(slider, 'change', (e) => {
            const value = transformValue(e.target.value);
            
            // 确保父对象存在
            if (!state.userData[parentKey]) {
                state.userData[parentKey] = {};
            }
            
            // 保存到嵌套对象
            state.userData[parentKey][childKey] = value;
            
            core.saveUserData(() => {
                if (successMessage) {
                }
            });
        })
    );
}

