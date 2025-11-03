import { aiManager } from './ai-manager.js';
import { utils } from '../utils.js';
import { searchModule } from './search.js';
import { logger } from '../logger.js';
import { timerManager } from '../utils/timerManager.js';
// modalManager 和 dom 已不再需要，AI设置已迁移到侧边面板

// =================================================================
// AI设置界面处理器
// =================================================================
export const aiSettings = {
    // 打开AI设置
    async open() {
        // 隐藏AI搜索容器
        searchModule.aiSearchVisible = false;
        searchModule.renderAiOptions();
        
        // 关闭所有下拉菜单
        utils.closeAllDropdowns();
        
        aiManager.init();
        
        // 打开统一设置面板并切换到搜索Tab
        const { openEffectsPanel } = await import('./effects-panel.js');
        openEffectsPanel();
        
        // 【P0内存优化】切换到搜索Tab并展开AI管理手风琴（使用timerManager统一管理）
        timerManager.clearTimeout('ai-settings-open-tab');
        timerManager.clearTimeout('ai-settings-open-accordion');
        
        timerManager.setTimeout('ai-settings-open-tab', () => {
            const panel = document.getElementById('effectsSettingsPanel');
            const searchTab = panel?.querySelector('[data-tab="search"]');
            if (searchTab) searchTab.click();
            
            // 展开AI管理手风琴（数据渲染由面板自动处理）
            timerManager.setTimeout('ai-settings-open-accordion', () => {
                const aiAccordion = panel?.querySelector('[data-accordion="ai-management"]');
                if (aiAccordion && !aiAccordion.classList.contains('expanded')) {
                    const header = aiAccordion.querySelector('.effects-accordion-header');
                    if (header) header.click();
                }
            }, 100);
        }, 100);
    },

    // 渲染AI列表
    renderAIList() {
        const aiList = document.getElementById('ai-list');
        if (!aiList) {
            console.error('[AI Settings] AI list element not found');
            logger.error('AI list element not found');
            return;
        }

        const ais = aiManager.getAllAIs();
        
        // 【P0内存优化】清理旧的图片资源（Blob URL）后再清空innerHTML
        const oldImages = aiList.querySelectorAll('img');
        oldImages.forEach(img => {
            if (img.src && img.src.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(img.src);
                } catch (e) {
                    // ignore
                }
            }
        });
        
        aiList.innerHTML = '';

        ais.forEach(ai => {
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            listItem.dataset.id = ai.id;

            const info = document.createElement('div');
            info.className = 'list-item-info';

            const icon = document.createElement('div');
            icon.className = 'ai-list-icon';
            if (ai.iconUrl) {
                const img = document.createElement('img');
                img.src = ai.iconUrl;
                img.alt = `${ai.name} icon`;
                img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; border-radius: 4px;';
                icon.appendChild(img);
            } else {
                icon.textContent = ai.icon;
            }
            icon.style.cssText = 'width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-right: 12px;';

            const text = document.createElement('div');
            text.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

            const name = document.createElement('p');
            name.textContent = ai.name;
            name.style.cssText = 'margin: 0; font-weight: 500; font-size: 14px;';

            const desc = document.createElement('p');
            desc.textContent = ai.description;
            desc.style.cssText = 'margin: 0; font-size: 12px; color: var(--text-secondary);';

            text.appendChild(name);
            text.appendChild(desc);

            info.appendChild(icon);
            info.appendChild(text);

            const actions = document.createElement('div');
            actions.className = 'list-item-actions';

            const visibilityBtn = document.createElement('button');
            visibilityBtn.className = 'footer-btn';
            visibilityBtn.textContent = ai.showInSearch ? '隐藏' : '显示';
            visibilityBtn.addEventListener('click', () => this.toggleVisibility(ai.id));
            actions.appendChild(visibilityBtn);

            const editBtn = document.createElement('button');
            editBtn.className = 'footer-btn';
            editBtn.textContent = '编辑';
            editBtn.addEventListener('click', () => this.editAI(ai.id));
            actions.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'footer-btn';
            deleteBtn.textContent = '删除';
            deleteBtn.addEventListener('click', () => this.deleteAI(ai.id));
            actions.appendChild(deleteBtn);

            listItem.appendChild(info);
            listItem.appendChild(actions);
            aiList.appendChild(listItem);
        });
    },

    // 切换显示状态
    toggleVisibility(id) {
        const newState = aiManager.toggleSearchVisibility(id);
        this.renderAIList();
    },

    // 编辑AI
    editAI(id) {
        const ai = aiManager.getAIById(id);
        if (!ai) return;

        // 更新表单标题
        const formTitle = document.getElementById('ai-form-title');
        const cancelBtn = document.getElementById('ai-form-cancel');
        
        if (formTitle) {
            formTitle.textContent = '编辑AI';
        }
        if (cancelBtn) {
            cancelBtn.classList.remove('hidden');
        }

        // 填充表单数据
        document.getElementById('ai-edit-id').value = ai.id;
        document.getElementById('ai-name').value = ai.name;
        document.getElementById('ai-description').value = ai.description;
        document.getElementById('ai-website-url').value = ai.websiteUrl || ai.url;
        document.getElementById('ai-search-url').value = ai.url;
        document.getElementById('ai-icon-url').value = ai.iconUrl || '';

        // 更新按钮状态
        const searchBtn = document.getElementById('ai-show-in-search-btn');
        const favoritesBtn = document.getElementById('ai-show-in-favorites-btn');
        if (searchBtn) {
            searchBtn.classList.toggle('selected', ai.showInSearch);
        }
        if (favoritesBtn) {
            favoritesBtn.classList.toggle('selected', ai.showInFavorites);
        }

        // 更新图标预览
        this.updateIconPreview(ai.iconUrl || ai.icon);
    },

    // 删除AI
    deleteAI(id) {
        if (confirm('确定要删除这个AI吗？')) {
            if (aiManager.deleteAI(id)) {
                this.renderAIList();
                this.resetForm();
            }
        }
    },

    // 重置表单
    resetForm() {
        const formTitle = document.getElementById('ai-form-title');
        const cancelBtn = document.getElementById('ai-form-cancel');
        
        if (formTitle) {
            formTitle.textContent = '添加新AI';
        }
        if (cancelBtn) {
            cancelBtn.classList.add('hidden');
        }

        // 重置表单
        const form = document.getElementById('ai-form');
        if (form) form.reset();
        const editId = document.getElementById('ai-edit-id');
        if (editId) editId.value = '';

        // 重置按钮状态
        const searchBtn = document.getElementById('ai-show-in-search-btn');
        const favoritesBtn = document.getElementById('ai-show-in-favorites-btn');
        if (searchBtn) {
            searchBtn.classList.add('selected');
        }
        if (favoritesBtn) {
            favoritesBtn.classList.add('selected');
        }

        // 重置图标预览
        this.updateIconPreview('');
    },

    // 保存AI
    saveAI() {
        logger.debug('aiSettings.saveAI called');
        
        let editId, name, description, websiteUrl, url, iconUrl, showInSearch, showInFavorites;
        
        try {
            editId = document.getElementById('ai-edit-id').value;
            name = document.getElementById('ai-name').value;
            description = document.getElementById('ai-description').value;
            websiteUrl = document.getElementById('ai-website-url').value;
            url = document.getElementById('ai-search-url').value;
            iconUrl = document.getElementById('ai-icon-url').value;
            showInSearch = document.getElementById('ai-show-in-search-btn').classList.contains('selected');
            showInFavorites = document.getElementById('ai-show-in-favorites-btn').classList.contains('selected');

            logger.debug('Form data retrieved:', { editId, name, description, websiteUrl, url, iconUrl, showInSearch, showInFavorites });

            if (!name || !description || !websiteUrl || !url) {
                logger.debug('Validation failed: missing required fields');
                return;
            }
        } catch (error) {
            logger.error('Error in saveAI form data retrieval:', error);
            return;
        }

        const aiData = {
            name,
            description,
            websiteUrl,
            url,
            iconUrl,
            showInSearch,
            showInFavorites
        };

        logger.debug('AI data prepared:', aiData);

        try {
            if (editId) {
                logger.debug('Updating existing AI with ID:', editId);
                // 编辑现有AI
                aiManager.updateAI(editId, aiData, (error, updated) => {
                    logger.debug('Update callback received:', { error, updated });
                    if (error) {
                        logger.error('Update error:', error);
('更新失败: ' + error.message, 'error');
                    } else if (updated) {
                        logger.debug('Update successful, updating UI');
                        this.renderAIList();
                        this.resetForm();
('AI已更新', 'success');
                    } else {
                        logger.debug('Update failed: no result');
('更新失败', 'error');
                    }
                });
            } else {
                logger.debug('Adding new AI');
                // 添加新AI
                aiManager.addAI(aiData, (error, newAI) => {
                    logger.debug('Add callback received:', { error, newAI });
                    if (error) {
                        logger.error('Add error:', error);
('添加失败: ' + error.message, 'error');
                    } else if (newAI) {
                        logger.debug('Add successful, updating UI');
                        this.renderAIList();
                        this.resetForm();
('AI已添加', 'success');
                    } else {
                        logger.debug('Add failed: no result');
('添加失败', 'error');
                    }
                });
            }
        } catch (error) {
            logger.error('Save error:', error);
('保存失败: ' + error.message, 'error');
        }
    },

    // 更新图标预览
    updateIconPreview(iconUrl) {
        const iconPreview = document.getElementById('ai-icon-preview');
        if (!iconPreview) return;

        if (iconUrl && iconUrl.trim()) {
            iconPreview.src = iconUrl;
            iconPreview.style.display = 'block';
        } else {
            iconPreview.src = 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
        }
    },

    // 测试图标源
    async testIconSources() {
        const urlInput = document.getElementById('ai-search-url');
        const iconSourcesList = document.getElementById('icon-sources-list');
        const iconSourcesContent = document.getElementById('icon-sources-content');
        
        if (!urlInput.value) {
('请先输入AI搜索网址', 'error');
            return;
        }

        try {
            const sources = aiManager.getIconSources(urlInput.value);
            if (sources.length === 0) {
('无法获取图标源', 'error');
                return;
            }

            // 清空之前的内容
            iconSourcesContent.innerHTML = '';
            
            // 显示图标源列表
            sources.forEach((source, index) => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'icon-source-item';
                
                sourceItem.innerHTML = `
                    <img src="${source.url}" 
                         onerror="this.style.display='none'">
                    <span style="color: var(--text-primary);">${source.name}</span>
                    <span style="color: var(--text-secondary); font-size: 10px;">${source.description}</span>
                `;
                
                // 点击选择图标源
                sourceItem.addEventListener('click', () => {
                    const iconUrlInput = document.getElementById('ai-icon-url');
                    if (iconUrlInput) iconUrlInput.value = source.url;
                    this.updateIconPreview(source.url);
(`已选择: ${source.name}`, 'success');
                });
                
                iconSourcesContent.appendChild(sourceItem);
            });
            
            // 显示图标源列表
            iconSourcesList.style.display = 'block';
(`找到 ${sources.length} 个图标源`, 'success');
            
        } catch (error) {
            console.error('测试图标源失败:', error);
('测试图标源失败: ' + error.message, 'error');
        }
    },

    // 切换按钮状态
    toggleButton(buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.classList.toggle('selected');
        }
    }
};
