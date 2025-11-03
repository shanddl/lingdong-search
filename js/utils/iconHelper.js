// =================================================================
// 图标处理工具 - 统一图标预览和图标源测试功能
// =================================================================

import { eventManager } from '../eventManager.js';
import { sanitizer } from '../security.js';
import { logger } from '../logger.js';
import { timerManager } from './timerManager.js';

/**
 * 图标预览辅助工具
 */
class IconPreviewHelper {
    constructor() {
        this.previews = new Map(); // 存储预览实例
    }
    
    /**
     * 初始化图标预览
     * @param {string|HTMLElement} inputElement - 输入框元素或ID
     * @param {string|HTMLElement} previewElement - 预览图片元素或ID
     * @param {Object} options - 选项
     * @param {string} options.placeholder - 占位符URL
     * @param {number} options.debounceDelay - 防抖延迟（毫秒）
     * @param {Array} globalEventIds - 全局事件ID数组（可选）
     * @returns {string} 事件ID
     */
    init(inputElement, previewElement, options = {}, globalEventIds = null) {
        const input = typeof inputElement === 'string' 
            ? document.getElementById(inputElement) 
            : inputElement;
        const preview = typeof previewElement === 'string'
            ? document.getElementById(previewElement)
            : previewElement;
            
        if (!input || !preview) {
            logger.warn('IconPreviewHelper: Input or preview element not found');
            return null;
        }
        
        const {
            placeholder = 'https://placehold.co/24x24/3c4043/e8eaed?text=?',
            debounceDelay = 500
        } = options;
        
        const updatePreview = () => {
            const iconUrl = input.value.trim();
            if (iconUrl) {
                preview.src = sanitizer.sanitizeIconUrl(iconUrl);
            } else {
                preview.src = placeholder;
            }
        };
        
        // 清除之前的定时器（使用timerManager统一管理）
        const timerId = `iconPreview-${input.id || 'default'}`;
        const cleanup = () => {
            timerManager.clearTimeout(timerId);
        };
        
        // 输入事件（防抖，使用timerManager统一管理）
        const eventId = eventManager.add(input, 'input', () => {
            cleanup();
            // 使用timerManager统一管理定时器，避免内存泄漏
            timerManager.setTimeout(timerId, updatePreview, debounceDelay);
        });
        
        // 失焦时立即更新并清理
        eventManager.add(input, 'blur', () => {
            cleanup();
            updatePreview();
        });
        
        // 初始更新
        updatePreview();
        
        // 存储引用以便清理
        this.previews.set(eventId, { input, preview, cleanup });
        
        if (globalEventIds) {
            globalEventIds.push(eventId);
        }
        
        return eventId;
    }
    
    /**
     * 清理预览实例
     * @param {string} eventId - 事件ID
     * @returns {void}
     */
    cleanup(eventId) {
        const instance = this.previews.get(eventId);
        if (instance) {
            instance.cleanup();
            this.previews.delete(eventId);
        }
    }
}

/**
 * 图标源测试工具
 */
class IconSourceTester {
    /**
     * 测试图标源并显示结果
     * @param {string} url - 要测试的URL
     * @param {string} urlInputId - URL输入框ID
     * @param {string} sourcesListId - 图标源列表容器ID
     * @param {string} sourcesContentId - 图标源内容容器ID
     * @param {string} iconUrlInputId - 图标URL输入框ID（可选）
     * @param {string} iconPreviewId - 图标预览ID（可选）
     * @returns {Promise<void>}
     */
    async test(url, urlInputId, sourcesListId, sourcesContentId, iconUrlInputId = null, iconPreviewId = null) {
        const sourcesList = document.getElementById(sourcesListId);
        const sourcesContent = document.getElementById(sourcesContentId);
        const iconUrlInput = iconUrlInputId ? document.getElementById(iconUrlInputId) : null;
        const iconPreview = iconPreviewId ? document.getElementById(iconPreviewId) : null;
        
        if (!sourcesList || !sourcesContent) {
            logger.error('图标源测试界面未找到', { 
                sourcesListId, 
                sourcesContentId,
                sourcesListExists: !!sourcesList,
                sourcesContentExists: !!sourcesContent
            });
            // 已移除提示
            return;
        }
        
        logger.debug('展开图标源列表', { 
            sourcesListId, 
            sourcesContentId,
            currentDisplay: sourcesList.style.display,
            computedDisplay: window.getComputedStyle(sourcesList).display
        });
        
        // 先显示列表容器（确保展开）
        logger.debug('准备展开图标源列表', {
            sourcesListId,
            sourcesListExists: !!sourcesList,
            currentStyle: sourcesList.style.cssText,
            computedStyle: window.getComputedStyle(sourcesList).display
        });
        
        sourcesList.style.display = 'block';
        sourcesList.style.visibility = 'visible';
        sourcesList.style.opacity = '1';
        sourcesList.removeAttribute('hidden'); // 移除hidden属性（如果有）
        
        // 强制刷新样式和重排
        const forceReflow = sourcesList.offsetHeight;
        
        logger.debug('图标源列表已展开', {
            display: sourcesList.style.display,
            computedDisplay: window.getComputedStyle(sourcesList).display,
            visibility: sourcesList.style.visibility,
            offsetHeight: forceReflow
        });
        
        // 显示加载状态
        sourcesContent.innerHTML = '<div style="color: var(--text-secondary); padding: 8px;">正在测试图标源...</div>';
        
        try {
            // 验证URL格式
            if (!url || typeof url !== 'string') {
                throw new Error('URL不能为空');
            }
            
            // 确保URL是完整的
            let testUrl = url.trim();
            if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
                testUrl = 'https://' + testUrl;
            }
            
            // 尝试解析URL
            try {
                new URL(testUrl);
            } catch (urlError) {
                throw new Error('URL格式不正确: ' + url);
            }
            
            logger.debug('测试图标源，URL:', testUrl);
            
            // 动态导入aiManager（避免循环依赖）
            const { aiManager } = await import('../features/ai-manager.js');
            const sources = aiManager.getIconSources(testUrl);
            
            logger.debug('获取到的图标源数量:', sources ? sources.length : 0);
            
            if (!sources || sources.length === 0) {
                sourcesContent.innerHTML = '<div style="color: var(--text-secondary); padding: 8px;">无法获取图标源，请检查URL格式</div>';
                // 已移除提示
                // 确保列表仍然显示（显示错误信息）
                return;
            }
            
            // 清空并显示图标源列表
            sourcesContent.innerHTML = '';
            
            sources.forEach(source => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'icon-source-item';
                sourceItem.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 8px; cursor: pointer; border-radius: 4px; transition: background 0.2s;';
                
                const img = document.createElement('img');
                img.src = sanitizer.sanitizeIconUrl(source.url);
                img.style.cssText = 'width: 24px; height: 24px; border-radius: 4px; object-fit: cover;';
                img.onerror = () => { img.style.display = 'none'; };
                
                const label = document.createElement('span');
                label.textContent = source.name || source.url;
                label.style.cssText = 'font-size: 12px; color: var(--text-primary);';
                
                sourceItem.appendChild(img);
                sourceItem.appendChild(label);
                
                // 点击选择图标源
                sourceItem.addEventListener('click', () => {
                    if (iconUrlInput) {
                        iconUrlInput.value = source.url;
                    }
                    if (iconPreview) {
                        iconPreview.src = sanitizer.sanitizeIconUrl(source.url);
                    }
                    // 已移除选择成功提示框
                });
                
                sourceItem.addEventListener('mouseenter', () => {
                    sourceItem.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                });
                
                sourceItem.addEventListener('mouseleave', () => {
                    sourceItem.style.backgroundColor = 'transparent';
                });
                
                sourcesContent.appendChild(sourceItem);
            });
            
            // 确保列表显示
            sourcesList.style.display = 'block';
            sourcesList.style.visibility = 'visible';
            
            // 已移除成功提示框
        } catch (error) {
            logger.error('测试图标源失败:', error);
            // 即使出错也显示列表（显示错误信息）
            sourcesList.style.display = 'block';
            sourcesList.style.visibility = 'visible';
            sourcesContent.innerHTML = `<div style="color: var(--error-color, #ff6b6b); padding: 8px;">测试图标源失败: ${error.message}</div>`;
            // 已移除提示
        }
    }
}

// 导出单例实例
export const iconPreviewHelper = new IconPreviewHelper();
export const iconSourceTester = new IconSourceTester();

// 导出类（用于需要多个实例的场景）
export { IconPreviewHelper, IconSourceTester };

