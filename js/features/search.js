import { state } from '../state.js';
import { utils } from '../utils.js';
import { dom } from '../dom.js';
import { core } from '../core.js';
import { render } from '../ui/render.js';
import { aiManager } from './ai-manager.js';
import { bookmarkSearch } from './bookmarkSearch.js';
import { sanitizer, domSafe, validator } from '../security.js';
import { logger } from '../logger.js';

// =================================================================
// 搜索功能模块
// =================================================================

const log = logger.module('Search');

export const searchModule = {
    // AI搜索相关功能 - 2点前版本
    aiSearchVisible: false,
    
    /**
     * 切换AI搜索显示状态
     */
    toggleAiSearch: () => {
        searchModule.aiSearchVisible = !searchModule.aiSearchVisible;
        searchModule.renderAiOptions();
        
        // 【优化】显示AI搜索时，强制隐藏搜索建议
        if (searchModule.aiSearchVisible) {
            if (dom.searchSuggestionsContainer) {
                dom.searchSuggestionsContainer.classList.remove('visible');
                // 强制隐藏，防止z-index冲突
                dom.searchSuggestionsContainer.style.display = 'none';
            }
        } else {
            // 关闭AI搜索时，恢复搜索建议的显示
            if (dom.searchSuggestionsContainer) {
                dom.searchSuggestionsContainer.style.display = '';
            }
            
            // 【修复】如果搜索框有内容，主动触发搜索建议显示
            if (dom.realSearchInput && dom.realSearchInput.value.trim()) {
                searchModule.debouncedShowSuggestions(false);
            }
        }
    },

    /**
     * 隐藏所有搜索相关容器（除了当前需要的）
     */
    hideAllSearchContainers: (exception) => {
        // 隐藏AI搜索容器
        searchModule.aiSearchVisible = false;
        searchModule.renderAiOptions();
        
        // 隐藏搜索建议
        if (dom.searchSuggestionsContainer) {
            dom.searchSuggestionsContainer.classList.remove('visible');
        }
        
        // 不对搜索范围菜单进行任何操作，让它自己管理状态
        // 注释掉以下代码以避免与搜索范围按钮冲突
        /*
        if (!exception || exception !== dom.searchScopeMenu) {
            if (dom.searchScopeMenu) {
                dom.searchScopeMenu.classList.remove('visible');
            }
        }
        */
        
        // 隐藏时间过滤器
        if (dom.timeFilterMenu) {
            dom.timeFilterMenu.classList.remove('visible');
        }
        
        // 隐藏文件过滤器
        if (dom.fileFilterMenu) {
            dom.fileFilterMenu.classList.remove('visible');
        }
        
        // 隐藏图片搜索选项
        if (dom.imageSearchMenu) {
            dom.imageSearchMenu.classList.remove('visible');
        }
        
        // 不需要关闭所有下拉菜单，避免与toggle操作冲突
        // utils.closeAllDropdowns(); // 注释掉，避免与搜索范围按钮冲突
    },

    /**
     * 显示/隐藏AI搜索容器 - 独立容器，遮盖搜索建议
     */
    renderAiOptions: () => {
        const aiContainer = document.getElementById('ai-search-container');
        if (!aiContainer) return;
        
        if (searchModule.aiSearchVisible) {
            // 动态渲染AI选项
            searchModule.renderDynamicAiOptions();
            
            // 显示AI容器
            aiContainer.classList.add('visible');
            
            // 【优化】重置AI选项索引
            state.activeAiIndex = -1;
            
            // 关闭其他下拉菜单，确保AI容器在最前面
            utils.closeVisibleMenus(aiContainer);
        } else {
            // 隐藏AI容器
            aiContainer.classList.remove('visible');
            
            // 重置索引
            state.activeAiIndex = -1;
        }
    },

    /**
     * 动态渲染AI选项
     */
    renderDynamicAiOptions: () => {
        const aiOptions = document.querySelector('#ai-search-container .ai-options');
        const aiFavoritesBar = document.getElementById('ai-favorites-bar');
        
        if (!aiOptions || !aiFavoritesBar) return;

        // 初始化AI管理器
        aiManager.init();

        // 获取在搜索中显示的AI
        const enabledAIs = aiManager.getSearchAIs();
        // 获取在收藏中显示的AI
        const favoriteAIs = aiManager.getFavoriteAIs();

        // 清空现有选项
        aiOptions.innerHTML = '';
        aiFavoritesBar.innerHTML = '';

        // 渲染AI收藏栏
        favoriteAIs.forEach(ai => {
            const chip = document.createElement('div');
            chip.className = 'ai-favorite-chip';
            chip.dataset.action = 'ai-favorite-click';
            chip.dataset.ai = ai.id;
            chip.title = `点击打开 ${ai.name}`;
            
            // 使用iconUrl如果存在，否则使用文本图标
            if (ai.iconUrl) {
                const img = document.createElement('img');
                img.src = ai.iconUrl;
                img.alt = `${ai.name} icon`;
                chip.appendChild(img);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'icon-placeholder';
                placeholder.textContent = ai.icon;
                chip.appendChild(placeholder);
            }
            
            const span = document.createElement('span');
            span.textContent = ai.name;
            chip.appendChild(span);
            
            aiFavoritesBar.appendChild(chip);
        });

        // 动态生成AI选项（安全版本）
        enabledAIs.forEach(ai => {
            const optionItem = document.createElement('div');
            optionItem.className = 'ai-option-item';
            optionItem.dataset.action = 'ai-search';
            optionItem.dataset.ai = ai.id;
            
            // 创建左侧容器
            const leftDiv = document.createElement('div');
            leftDiv.className = 'ai-option-left';
            
            // 创建图标容器
            const iconDiv = document.createElement('div');
            iconDiv.className = 'ai-option-icon';
            if (ai.iconUrl) {
                // 使用安全的图标URL
                const safeIconUrl = sanitizer.sanitizeIconUrl(ai.iconUrl);
                const img = document.createElement('img');
                img.src = safeIconUrl;
                img.alt = sanitizer.escapeHtml(ai.name) + ' icon';
                img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; border-radius: 4px;';
                iconDiv.appendChild(img);
            } else {
                iconDiv.className += ` ${ai.id}-icon`;
                iconDiv.innerHTML = ai.icon; // SVG icon (safe - 来自预定义配置)
            }
            
            // 创建文本容器
            const textDiv = document.createElement('div');
            textDiv.className = 'ai-option-text';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'ai-option-name';
            nameSpan.textContent = ai.name; // 安全设置文本
            
            const descSpan = document.createElement('span');
            descSpan.className = 'ai-option-desc';
            descSpan.textContent = ai.description; // 安全设置文本
            
            textDiv.appendChild(nameSpan);
            textDiv.appendChild(descSpan);
            leftDiv.appendChild(iconDiv);
            leftDiv.appendChild(textDiv);
            
            // 创建右侧箭头
            const arrowDiv = document.createElement('div');
            arrowDiv.className = 'ai-option-arrow';
            arrowDiv.textContent = '→';
            
            optionItem.appendChild(leftDiv);
            optionItem.appendChild(arrowDiv);
            aiOptions.appendChild(optionItem);
        });
    },


    /**
     * 执行AI搜索
     */
    performAiSearch: (aiType, query) => {
        // 初始化AI管理器
        aiManager.init();
        
        // 查找对应的AI
        const ai = aiManager.getAIById(aiType);
        if (ai && ai.url) {
            // 替换URL中的{query}占位符
            const searchUrl = ai.url.replace('{query}', encodeURIComponent(query));
            window.open(searchUrl, '_blank');
            
            // 关闭AI容器
            searchModule.aiSearchVisible = false;
            searchModule.renderAiOptions();
            
            // 关闭其他所有下拉菜单
            utils.closeAllDropdowns();
        } else {
            log.warn(`AI类型 ${aiType} 未找到或URL未配置`);
        }
    },
    /**
     * 获取搜索建议（多级回退机制）
     * @param {string} q - 查询词
     * @returns {Promise<Array>} 建议列表
     */
    fetchBaiduSuggestions: async (q) => {
        // 多级回退：首选必应，失败时尝试备用方案
        
        // 方案 1: 必应国际版（通过 CORS 代理）
        try {
            const response = await fetch(`https://cors.eu.org/https://api.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`, {
                signal: AbortSignal.timeout(3000)
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data[1] && data[1].length > 0) {
                    log.debug("✅ 成功从 [必应国际版] 获取建议");
                    return data[1];
                }
            }
        } catch (error) {
            log.debug("⚠️ 必应国际版失败:", error.message);
        }
        
        // 方案 2: 必应中国版（直接访问，可能更快）
        try {
            const response = await fetch(`https://cors.eu.org/https://cn.bing.com/AS/Suggestions?pt=page.home&mkt=zh-cn&qry=${encodeURIComponent(q)}&cp=1&cvid=test`, {
                signal: AbortSignal.timeout(3000)
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.AS && data.AS.Results && data.AS.Results[0] && data.AS.Results[0].Suggests) {
                    const suggestions = data.AS.Results[0].Suggests.map(s => s.Txt);
                    if (suggestions.length > 0) {
                        log.debug("✅ 成功从 [必应中国版] 获取建议");
                        return suggestions;
                    }
                }
            }
        } catch (error) {
            log.debug("⚠️ 必应中国版失败:", error.message);
        }
        
        // 方案 3: 搜狗建议（国内服务器，速度快）
        try {
            const response = await fetch(`https://cors.eu.org/https://www.sogou.com/suggnew/ajajjson?key=${encodeURIComponent(q)}&type=web`, {
                signal: AbortSignal.timeout(3000)
            });
            
            if (response.ok) {
                const text = await response.text();
                // 搜狗返回 JSONP 格式: window.sogou.sug(["query",[...]])
                const match = text.match(/\[.*\]/);
                if (match) {
                    const data = JSON.parse(match[0]);
                    if (data[1] && data[1].length > 0) {
                        log.debug("✅ 成功从 [搜狗] 获取建议");
                        return data[1];
                    }
                }
            }
        } catch (error) {
            log.debug("⚠️ 搜狗建议失败:", error.message);
        }
        
        // 所有方案都失败
        log.debug("❌ 所有搜索建议源均失败，返回空结果");
        return [];
    },
    
    // 统一使用utils中的工具函数，避免重复代码
    // 懒加载防抖函数以避免模块初始化顺序问题
    debouncedShowSuggestions: (() => {
        let debouncedFn = null;
        return function(isFocusEvent = false) {
            if (!debouncedFn) {
                debouncedFn = utils.debounce(async(isFocusEvent = false) => {
                    if (!dom.realSearchInput || !dom.suggestionTabs) return;
                    
                    // 【修复】如果AI搜索正在显示，不显示搜索建议
                    if (searchModule.aiSearchVisible) {
                        return;
                    }
                    const q = dom.realSearchInput.value.trim();
        
        // 确定模式：
        // 1. 如果是焦点事件且无输入 → 显示历史
        // 2. 如果有查询内容且当前是历史模式 → 自动切换到搜索建议
        // 3. 如果用户手动切换到书签模式 → 保持书签模式
        // 4. 否则使用当前激活的标签
        let mode = state.suggestionViewMode || 'suggestion';
        if (isFocusEvent && !q) {
            mode = 'history';
        } else if (q && mode === 'history') {
            // 修复：当有输入内容且当前是历史模式时，自动切换到搜索建议模式
            // 但如果用户手动切换到了书签模式，则保持书签模式
            mode = 'suggestion';
        }
        state.suggestionViewMode = mode;
        
        const tabs = dom.suggestionTabs;
        const currentActive = tabs.querySelector('.active');
        if (currentActive) currentActive.classList.remove('active');
        const newActive = tabs.querySelector(`[data-type="${mode}"]`);
        if (newActive) newActive.classList.add('active');

        if (dom.clearHistoryBtn) dom.clearHistoryBtn.classList.toggle('hidden', mode !== 'history');

        // 对于书签模式，即使没有查询也显示所有书签
        if (!q && mode === 'suggestion') {
            utils.setDropdownsVisibility(dom.searchScopeMenu.classList.contains('visible'), false);
            return;
        }
        
        // 根据模式获取不同的数据
        let items = [];
        log.debug('📌 当前模式:', mode, '查询词:', q);
        
        // 先显示建议容器（如果有查询内容）
        if (mode === 'suggestion' && q) {
            // 立即显示建议容器，并显示加载状态
            utils.setDropdownsVisibility(dom.searchScopeMenu.classList.contains('visible'), true);
            // 显示加载提示
            if (dom.suggestionContent) {
                dom.suggestionContent.innerHTML = '<div class="dropdown-item" style="justify-content:center;color:var(--text-secondary);">正在获取建议...</div>';
            }
        }
        
        if (mode === 'history') {
            items = state.userData.searchHistory;
            log.debug('📜 历史记录数量:', items.length);
        } else if (mode === 'bookmarks') {
            // 书签搜索 - 空查询时显示所有书签
            log.debug('📖 进入书签搜索模式');
            log.debug('bookmarkSearch 模块:', bookmarkSearch);
            log.debug('bookmarkSearch.searchAndFormatBookmarks:', typeof bookmarkSearch.searchAndFormatBookmarks);
            
            const bookmarks = await bookmarkSearch.searchAndFormatBookmarks(q || '').catch((err) => {
                log.error('❌ 书签搜索调用失败:', err);
                log.error('错误堆栈:', err.stack);
                return [];
            });
            items = bookmarks;
            log.debug('📚 书签搜索结果:', items);
        } else {
            // 搜索建议
            items = await searchModule.fetchBaiduSuggestions(q).catch(() => []);
            log.debug('💡 搜索建议数量:', items.length);
        }
        
        log.debug('🎨 准备渲染，项目数量:', items.length);
        render.suggestions(items, mode);

        // 修复：当输入框有内容时，即使没有建议结果也显示建议容器
        // 这样用户可以看到"正在加载"或"无相关建议"的提示
        const shouldBeVisible = (mode === 'suggestion' && q) || 
                               (mode === 'history') || 
                               (mode === 'bookmarks');
        
        utils.setDropdownsVisibility(dom.searchScopeMenu.classList.contains('visible'), shouldBeVisible);
                }, 150);
            }
            return debouncedFn(isFocusEvent);
        };
    })(),
    
    /**
     * 更新搜索容器状态
     */
    updateSearchContainerState: () => {
        if (!dom.searchContainer || !dom.realSearchInput) return;
        const hasContent = state.activeSearchPills.length > 0 || dom.realSearchInput.value.length > 0;
        dom.searchContainer.classList.toggle('has-content', hasContent);
    },
    
    /**
     * 处理输入框按键事件
     */
    handleInputKeydown: async e => {
        if (!dom.searchSuggestionsContainer || !dom.suggestionContent || !dom.realSearchInput) return;
        
        const suggestionsVisible = dom.searchSuggestionsContainer.classList.contains('visible');
        const aiContainer = document.getElementById('ai-search-container');
        const aiSearchVisible = aiContainer && aiContainer.classList.contains('visible');
        
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            const shouldOpen = !dom.searchScopeMenu.classList.contains('visible');
            utils.setDropdownsVisibility(shouldOpen, shouldOpen && !!dom.realSearchInput.value);
            if (shouldOpen) searchModule.debouncedShowSuggestions(true);
            return;
        }
        
        // 【优化】处理AI搜索菜单的键盘导航
        if (aiSearchVisible && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            const aiOptions = aiContainer.querySelectorAll('.ai-option-item');
            if (aiOptions.length === 0) return;
            
            // 移除当前高亮
            const currentActive = aiOptions[state.activeAiIndex || 0];
            if (currentActive) currentActive.classList.remove('active');
            
            // 计算新索引
            const currentIndex = state.activeAiIndex !== undefined ? state.activeAiIndex : -1;
            state.activeAiIndex = (currentIndex + (e.key === 'ArrowDown' ? 1 : -1) + aiOptions.length) % aiOptions.length;
            
            // 高亮新选项
            const newActive = aiOptions[state.activeAiIndex];
            newActive.classList.add('active');
            
            // 滚动到可见区域
            newActive.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return;
        }
        
        // 处理搜索建议的键盘导航
        if (suggestionsVisible && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            const items = dom.suggestionContent.querySelectorAll('.suggestion-item');
            if (items.length === 0) return;
            const currentActive = items[state.activeSuggestionIndex];
            if (currentActive) currentActive.classList.remove('active');
            state.activeSuggestionIndex = (state.activeSuggestionIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            const newActive = items[state.activeSuggestionIndex];
            newActive.classList.add('active');
            dom.realSearchInput.value = newActive.dataset.value;
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // 【优化】处理AI搜索菜单的回车键
            if (aiSearchVisible && state.activeAiIndex !== undefined && state.activeAiIndex >= 0) {
                const aiOptions = aiContainer.querySelectorAll('.ai-option-item');
                const activeAiOption = aiOptions[state.activeAiIndex];
                if (activeAiOption) {
                    activeAiOption.click();
                }
            } else if (suggestionsVisible && state.activeSuggestionIndex > -1) {
                const activeItem = dom.suggestionContent.querySelector('.suggestion-item.active');
                if (activeItem) {
                    // 点击文本元素而不是容器，因为容器的 pointer-events 是 none
                    const textElement = activeItem.querySelector('.suggestion-text');
                    if (textElement) {
                        textElement.click();
                    } else {
                        // 如果是书签项，点击整个容器
                        activeItem.click();
                    }
                }
            } else {
                core.initiateSearch();
            }
        }
    }
};