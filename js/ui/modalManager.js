import { cacheModalElements, dom } from '../dom.js';
import { state } from '../state.js';
import { core } from '../core.js';
import { utils } from '../utils.js';
import { navigationModule } from '../features/navigation.js';
import { logger } from '../logger.js';

// =================================================================
// 模态框管理器
// =================================================================
export const modalManager = {
    // Modal mapping - maps friendly names to actual DOM IDs
    modalMap: {
        // 'manageScopes': 已移除，已被侧边面板的搜索Tab替代
        // 'manageEngines': 已移除，已被侧边面板的搜索Tab替代
        // 'appearanceSettings': 已移除，已被侧边面板替代
        // 'settings': 已移除，已被侧边面板的系统Tab替代
        // 'aiSettings': 已移除，已被侧边面板的搜索Tab替代
        // 'manageNavGroups': 已移除，已被侧边面板的导航Tab替代
        'manageTimeFilters': 'manage-time-filters-modal',
        'manageFileFilters': 'manage-file-filters-modal'
    },
    
    /**
     * Show a modal by name
     * @param {string} modalName - The friendly name of the modal (e.g. 'manageScopes')
     */
    show(modalName) {
        const modalId = this.modalMap[modalName];
        if (!modalId) {
            return;
        }
        
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('visible');
            // 动态缓存模态框中的元素
            cacheModalElements();
        }
    },
    
    // [已移除] bindAppearanceSettingsSliders() 和 showSliderPopout()
    // 外观设置已迁移到侧边面板（effects-panel.js）
    
    /**
     * Hide a modal by name
     * @param {string} modalName - The friendly name of the modal
     */
    hide(modalName) {
        const modalId = this.modalMap[modalName];
        if (!modalId) {
            return;
        }
        
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('visible');
        }
    },
    
    /**
     * Hide all modals
     */
    hideAll() {
        document.querySelectorAll('.modal-overlay.visible').forEach(modal => {
            modal.classList.remove('visible');
        });
    }
};
