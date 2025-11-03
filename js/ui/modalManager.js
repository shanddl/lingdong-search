import { cacheModalElements } from '../dom.js';

// =================================================================
// 模态框管理器
// =================================================================
export const modalManager = {
    // Modal mapping - maps friendly names to actual DOM IDs
    modalMap: {
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
