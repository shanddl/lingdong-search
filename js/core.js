import { STATIC_CONFIG } from './constants.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { utils } from './utils.js';
import { render } from './ui/render.js';
import { navigationModule } from './features/navigation.js';
import { logger } from './logger.js';

// =================================================================
// 核心功能模块 - 数据加载、保存、设置应用、搜索执行
// =================================================================

const log = logger.module('Core');

/**
 * 简单的字符串哈希函数（用于数据变化检测）
 * @param {string} str - 要哈希的字符串
 * @returns {number} 哈希值
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

// 保存操作的防抖机制，防止并发saveUserData调用导致数据覆盖
let saveDebounceTimer = null;
let pendingCallbacks = [];
const SAVE_DEBOUNCE_DELAY = 800; // 800ms防抖延迟（优化性能，减少频繁I/O和内存占用）
let lastSavedDataHash = null; // 上次保存的数据哈希，用于检测变化

/**
 * 核心功能模块
 * 负责用户数据的加载、保存、设置应用和搜索执行
 */
export const core = {
    /**
     * 从存储加载用户数据
     * 会合并默认数据和存储数据，并进行数据验证和迁移
     */
    loadUserData: () => {
        storage.get((storedData) => {
            const defaultData = JSON.parse(JSON.stringify(STATIC_CONFIG.DEFAULT_USER_DATA));
            log.debug('Loading user data, storedData:', storedData);
            log.debug('Default data:', defaultData);
            
            // 修复数据合并逻辑 - 确保分类数据正确保留
            if (storedData) {
                // 深度合并导航组数据，确保用户创建的分类不会丢失
                state.userData = {
                    ...defaultData,
                    ...storedData,
                    navigationGroups: storedData.navigationGroups || defaultData.navigationGroups,
                    dynamicFilters: { 
                        ...defaultData.dynamicFilters, 
                        ...(storedData.dynamicFilters || {})
                    }
                };
                
                // 验证和修复动态过滤器
                if (!state.userData.dynamicFilters || !state.userData.dynamicFilters.timeRange || 
                    state.userData.dynamicFilters.timeRange.some(r => typeof r === 'object' && r.hasOwnProperty('value'))) {
                    state.userData.dynamicFilters = defaultData.dynamicFilters;
                }
                
                // 验证搜索引擎（添加完整性检查）
                if (!storedData.searchEngines || !Array.isArray(storedData.searchEngines) || storedData.searchEngines.length === 0) {
                    state.userData.searchEngines = defaultData.searchEngines;
                    log.debug('Restored default search engines');
                }
                
                // 确保活跃搜索引擎存在（添加null检查）
                if (state.userData.searchEngines && state.userData.searchEngines.length > 0) {
                    const activeEngineExists = state.userData.searchEngines.some(e => e && e.id === state.userData.activeSearchEngineId);
                    if (!activeEngineExists) {
                        state.userData.activeSearchEngineId = state.userData.searchEngines[0].id;
                        log.debug('Reset active search engine to first engine');
                    }
                } else {
                    // 极端情况：searchEngines为空，重置为默认值
                    state.userData.searchEngines = defaultData.searchEngines;
                    state.userData.activeSearchEngineId = defaultData.searchEngines[0].id;
                    log.warn('Search engines was empty, reset to defaults');
                }
                
                // 注意：搜索引擎菜单会在 applyAllSettings() 中统一渲染，此处无需重复调用
                
                // 验证导航组（添加完整性检查）
                if (!state.userData.navigationGroups || !Array.isArray(state.userData.navigationGroups) || state.userData.navigationGroups.length === 0) {
                    state.userData.navigationGroups = defaultData.navigationGroups;
                    state.userData.activeNavigationGroupId = defaultData.activeNavigationGroupId;
                    log.warn('Navigation groups was empty, reset to defaults');
                } else {
                    // 验证活跃导航组ID
                    const activeGroupExists = state.userData.navigationGroups.some(g => g && g.id === state.userData.activeNavigationGroupId);
                    if (!activeGroupExists) {
                        state.userData.activeNavigationGroupId = state.userData.navigationGroups[0].id;
                        log.debug('Auto-corrected active group ID to:', state.userData.activeNavigationGroupId);
                    }
                }
                
                // 验证引擎设置（确保旧版本数据兼容）
                if (!state.userData.engineSettings || typeof state.userData.engineSettings !== 'object') {
                    state.userData.engineSettings = defaultData.engineSettings || { size: 16, spacing: 8 };
                    log.debug('Initialized default engine settings');
                } else {
                    // 确保 size 和 spacing 字段存在
                    if (typeof state.userData.engineSettings.size !== 'number') {
                        state.userData.engineSettings.size = 16;
                    }
                    if (typeof state.userData.engineSettings.spacing !== 'number') {
                        state.userData.engineSettings.spacing = 8;
                    }
                }
                
                // AI数据迁移：为旧版本的AI数据添加websiteUrl字段
                if (state.userData.aiSettings && Array.isArray(state.userData.aiSettings)) {
                    let needsSave = false;
                    state.userData.aiSettings = state.userData.aiSettings.map(ai => {
                        if (!ai.websiteUrl && ai.url) {
                            // 如果没有websiteUrl，使用url作为websiteUrl
                            ai.websiteUrl = ai.url.replace('{query}', '');
                            needsSave = true;
                        }
                        return ai;
                    });
                    
                    // 如果进行了数据迁移，保存更新后的数据
                    if (needsSave) {
                        log.info('AI data migrated, saving updated data');
                        core.saveUserData((error) => {
                            if (error) {
                                log.error('Failed to save migrated AI data:', error);
                            }
                        });
                    }
                }
                

            } else {
                // 没有存储数据时使用默认数据并保存
                state.userData = defaultData;
                log.debug('No stored data, using default data:', defaultData);
                core.saveUserData((error) => {
                    if (error) {
                        log.error('Failed to save default user data:', error);
                    }
                });
            }
            
            // activeNavigationGroupId 现在通过 Proxy 自动同步，无需手动赋值
            core.applyAllSettings();
        });
    },
    
    /**
     * 保存用户数据到存储（带防抖和变化检测）
     * - 在300ms内的多次调用会合并为一次，防止数据覆盖和频繁I/O
     * - 数据未变化时跳过保存，避免不必要的I/O操作
     * - 性能监控：记录保存时间和数据大小
     * @param {Function} callback - 保存完成后的回调函数，参数为error
     */
    saveUserData: (callback) => {
        // 收集callback
        if (callback) {
            pendingCallbacks.push(callback);
        }
        
        // 清除之前的定时器
        if (saveDebounceTimer) {
            clearTimeout(saveDebounceTimer);
        }
        
        // 设置新的定时器
        saveDebounceTimer = setTimeout(() => {
            // activeNavigationGroupId 通过 Proxy 自动同步，无需手动操作
            
            // 保存当前的callbacks列表
            const callbacks = [...pendingCallbacks];
            pendingCallbacks = [];
            saveDebounceTimer = null;
            
            // 运行时数据验证：在保存前检查数据完整性
            try {
                // 验证searchEngines数组
                if (!Array.isArray(state.userData.searchEngines) || state.userData.searchEngines.length === 0) {
                    log.warn('Invalid searchEngines detected, restoring defaults');
                    const defaultData = JSON.parse(JSON.stringify(STATIC_CONFIG.DEFAULT_USER_DATA));
                    state.userData.searchEngines = defaultData.searchEngines;
                    state.userData.activeSearchEngineId = defaultData.searchEngines[0].id;
                }
                
                // 验证navigationGroups数组
                if (!Array.isArray(state.userData.navigationGroups) || state.userData.navigationGroups.length === 0) {
                    log.warn('Invalid navigationGroups detected, restoring defaults');
                    const defaultData = JSON.parse(JSON.stringify(STATIC_CONFIG.DEFAULT_USER_DATA));
                    state.userData.navigationGroups = defaultData.navigationGroups;
                    state.userData.activeNavigationGroupId = defaultData.activeNavigationGroupId;
                }
                
                // 验证engineSettings对象
                if (!state.userData.engineSettings || typeof state.userData.engineSettings !== 'object') {
                    log.warn('Invalid engineSettings detected, using defaults');
                    state.userData.engineSettings = { size: 16, spacing: 8 };
                } else {
                    if (typeof state.userData.engineSettings.size !== 'number' || state.userData.engineSettings.size < 10 || state.userData.engineSettings.size > 32) {
                        log.warn('Invalid engineSettings.size, resetting to 16');
                        state.userData.engineSettings.size = 16;
                    }
                    if (typeof state.userData.engineSettings.spacing !== 'number' || state.userData.engineSettings.spacing < 0 || state.userData.engineSettings.spacing > 20) {
                        log.warn('Invalid engineSettings.spacing, resetting to 8');
                        state.userData.engineSettings.spacing = 8;
                    }
                }
            } catch (validationError) {
                log.error('Data validation error:', validationError);
            }
            
            // [性能优化] 数据变化检测 - 避免保存相同的数据
            const dataStr = JSON.stringify(state.userData);
            const currentHash = simpleHash(dataStr);
            
            if (lastSavedDataHash === currentHash) {
                log.debug('Data unchanged, skipping save');
                // 数据未变化，直接调用callbacks（返回成功）
                callbacks.forEach(cb => {
                    try {
                        cb(null);
                    } catch (e) {
                        log.error('Callback error in saveUserData:', e);
                    }
                });
                return;
            }
            
            // [性能监控] 检测数据大小
            const dataSize = dataStr.length;
            if (dataSize > 1024 * 1024) { // 大于1MB
                log.warn('User data size is large:', Math.round(dataSize / 1024), 'KB');
            }
            
            // 执行实际的保存操作
            const saveStartTime = performance.now();
            storage.set(state.userData, (error) => {
                if (!error) {
                    lastSavedDataHash = currentHash; // 保存成功，更新哈希
                    const saveTime = Math.round(performance.now() - saveStartTime);
                    if (saveTime > 100) {
                        log.warn('Slow save operation:', saveTime, 'ms');
                    }
                }
                
                // 依次调用所有pending的callbacks
                callbacks.forEach(cb => {
                    try {
                        cb(error);
                    } catch (e) {
                        log.error('Callback error in saveUserData:', e);
                    }
                });
            });
        }, SAVE_DEBOUNCE_DELAY);
    },
    
    /**
     * 应用所有用户设置到UI
     * 包括搜索框位置、宽度、导航样式等
     */
    applyAllSettings: () => {
        render.searchPills();
        render.searchEngineSwitcher(true); // 跳过菜单渲染，稍后统一渲染
        core.applySearchboxPosition(state.userData.searchboxTop);
        if (dom.positionSlider) dom.positionSlider.value = state.userData.searchboxTop;
        if (dom.positionValue) dom.positionValue.textContent = state.userData.searchboxTop;
        core.applySearchboxWidth(state.userData.searchboxWidth);
        if (dom.widthSlider) dom.widthSlider.value = state.userData.searchboxWidth;
        if (dom.widthValue) dom.widthValue.textContent = state.userData.searchboxWidth;
        core.applyScopeMenuWidth(state.userData.scopeMenuWidth);
        if (dom.scopeWidthSlider) dom.scopeWidthSlider.value = state.userData.scopeMenuWidth;
        if (dom.scopeWidthValue) dom.scopeWidthValue.textContent = state.userData.scopeMenuWidth;
        render.scopeMenu();
        render.customFilters();
        render.searchEngineMenu(); // 统一在此处渲染一次

        navigationModule.utils.applyAppearanceSettings(state.userData.navigationItemSize, state.userData.navigationGridGap);
        if(dom.navItemSizeSlider) {
            dom.navItemSizeSlider.value = state.userData.navigationItemSize;
            dom.navItemSizeValue.textContent = state.userData.navigationItemSize;
            dom.navGridGapSlider.value = state.userData.navigationGridGap;
            dom.navGridGapValue.textContent = state.userData.navigationGridGap;
        }
        
        // 应用引擎设置滑块值（确保使用实际加载的数据）
        if (state.userData.engineSettings) {
            const engineSize = state.userData.engineSettings.size || 16;
            const engineSpacing = state.userData.engineSettings.spacing || 8;
            
            if (dom.engineSizeSlider) {
                dom.engineSizeSlider.value = engineSize;
                if (dom.engineSizeValue) {
                    dom.engineSizeValue.textContent = `${engineSize}px`;
                }
            }
            
            if (dom.engineSpacingSlider) {
                dom.engineSpacingSlider.value = engineSpacing;
                if (dom.engineSpacingValue) {
                    dom.engineSpacingValue.textContent = `${engineSpacing}px`;
                }
            }
        }

            // [新增] dock栏缩放
            if (typeof state.userData.dockScale !== 'number') state.userData.dockScale = 1.0;
            document.documentElement.style.setProperty('--dock-scale', state.userData.dockScale);
            if (dom.dockScaleSlider) dom.dockScaleSlider.value = state.userData.dockScale;
            if (dom.dockScaleValue) dom.dockScaleValue.textContent = Number(state.userData.dockScale).toFixed(2);
        
        // Apply saved navigation shape
        if (state.userData.navigationShape && state.userData.navigationShape !== 'square') {
            document.body.classList.add(`shape-${state.userData.navigationShape}`);
        }
        
        // Apply saved navigation alignment and density settings on load
        if (dom.navigationGrid) {
            // Apply alignment
            if (state.userData.navigationAlignment) {
                switch(state.userData.navigationAlignment) {
                    case 'left':
                        dom.navigationGrid.style.marginLeft = '0';
                        dom.navigationGrid.style.marginRight = 'auto';
                        break;
                    case 'center':
                        dom.navigationGrid.style.marginLeft = 'auto';
                        dom.navigationGrid.style.marginRight = 'auto';
                        break;
                    case 'right':
                        dom.navigationGrid.style.marginLeft = 'auto';
                        dom.navigationGrid.style.marginRight = '0';
                        break;
                }
            }
            
            // Apply density (min-width)
            if (state.userData.navigationItemMinWidth) {
                dom.navigationGrid.style.setProperty('--nav-item-min-width', `${state.userData.navigationItemMinWidth}px`);
            }
        }
        
        navigationModule.render.all();
        
        // 应用保存的外观设置CSS变量（wallpaperEffects等）
        // 使用setTimeout确保effects-panel已初始化
        setTimeout(() => {
            if (typeof window.applyEffectsCSSVariables === 'function') {
                window.applyEffectsCSSVariables();
            }
        }, 0);
    },
    
    /**
     * 应用搜索框垂直位置
     * @param {number} v - 位置百分比值（vh）
     */
    applySearchboxPosition: v => {
        const body = dom.body || document.getElementById('body') || document.body;
        if (body) {
            body.style.paddingTop = `${v}vh`;
        } else {
            console.error('❌ applySearchboxPosition: body元素未找到');
        }
    },
    
    /**
     * 应用搜索框宽度
     * @param {number} v - 宽度像素值
     */
    applySearchboxWidth: v => {
        const main = dom.main || document.getElementById('main');
        const navGrid = dom.navigationGrid || document.getElementById('navigation-grid');
        
        if (main) {
            main.style.maxWidth = `${v}px`;
        } else {
            console.error('❌ applySearchboxWidth: main元素未找到');
        }
        
        if (navGrid) {
            navGrid.style.maxWidth = `${v}px`;
        }
    },
    
    /**
     * 应用搜索范围菜单宽度
     * @param {number} v - 宽度像素值
     */
    applyScopeMenuWidth: v => {
        document.documentElement.style.setProperty('--scope-menu-width', `${v}px`);
    },
    
    /**
     * 发起搜索（从搜索框触发）
     * 获取搜索框内容并执行搜索
     */
    initiateSearch: () => {
        let q = dom.realSearchInput.value.trim();
        if (!q && state.activeSearchPills.length === 0) return;
        core.performSearch(q);
    },
    
    /**
     * 执行搜索
     * @param {string} query - 搜索查询字符串
     * 会组合所有激活的搜索条件（pills），保存搜索历史，并在新标签页打开搜索结果
     */
    performSearch: (query) => {
        if (query) {
            state.userData.searchHistory.unshift(query);
            state.userData.searchHistory = [...new Set(state.userData.searchHistory)].slice(0, 20);
            core.saveUserData((error) => {
                if (error) {
                    log.error('Failed to save search history:', error);
                    // 搜索历史保存失败不影响搜索功能，仅记录日志
                }
            });
        }
        const engine = state.userData.searchEngines.find(e => e.id === state.userData.activeSearchEngineId);

        const sitePills = state.activeSearchPills.filter(p => p.type === 'site');
        const otherPills = state.activeSearchPills.filter(p => p.type !== 'site');
        const otherPillsQuery = otherPills.map(p => p.queryPart).join(' ');

        let siteQuery = '';
        if (sitePills.length > 0) {
            siteQuery = sitePills.map(p => p.queryPart).join(' OR ');
            if (sitePills.length > 1) {
                siteQuery = `(${siteQuery})`;
            }
        }

        const finalQuery = `${query} ${otherPillsQuery} ${siteQuery}`.trim().replace(/\s+/g, ' ');
        if (engine) window.open(engine.url.replace(/\{query\}/gi, encodeURIComponent(finalQuery)), '_blank');
        if (dom.realSearchInput) dom.realSearchInput.blur();
        utils.closeAllDropdowns();
    },
    
    /**
     * 更新时钟显示
     * 显示当前时间和星期几
     */
    updateClock: () => {
        if (!dom.searchClock) return;
        const n = new Date();
        dom.searchClock.innerHTML = `${n.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}<div class="day">${n.toLocaleDateString('zh-CN',{weekday:'long'})}</div>`;
    },
};

