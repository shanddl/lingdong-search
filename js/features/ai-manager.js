import { state } from '../state.js';
import { utils } from '../utils.js';
import { storage } from '../storage.js';
import { logger } from '../logger.js';

// =================================================================
// AI管理模块
// =================================================================
export const aiManager = {
    // 默认AI数据
    defaultAIs: [
        {
            id: 'metaso',
            name: '秘塔',
            description: 'AI搜索引擎',
            websiteUrl: 'https://metaso.cn',
            url: 'https://metaso.cn/?q={query}',
            icon: '🔍',
            showInSearch: true,
            showInFavorites: true
        },
        {
            id: 'kimi',
            name: 'Kimi AI',
            description: '月之暗面AI助手',
            websiteUrl: 'https://kimi.moonshot.cn',
            url: 'https://kimi.moonshot.cn/_prefill_chat?prefill_prompt={query}&send_immediately=true&force_search=false',
            icon: '🤖',
            showInSearch: true,
            showInFavorites: true
        },
        {
            id: 'felo',
            name: 'Felo AI',
            description: 'AI搜索引擎',
            websiteUrl: 'https://felo.ai',
            url: 'https://felo.ai/search/?q={query}',
            icon: '🔎',
            showInSearch: true,
            showInFavorites: true
        },
        {
            id: 'perplexity',
            name: 'Perplexity AI',
            description: 'AI搜索引擎',
            websiteUrl: 'https://www.perplexity.ai',
            url: 'https://www.perplexity.ai/search?q={query}',
            icon: '🧠',
            showInSearch: true,
            showInFavorites: true
        }
    ],

    // 初始化AI设置
    init() {
        if (!state.userData.aiSettings) {
            state.userData.aiSettings = [...this.defaultAIs];
            storage.set(state.userData, (error) => {
                if (error) logger.error('Failed to save default AI settings:', error);
            });
        }
    },

    // 获取所有AI
    getAllAIs() {
        return state.userData.aiSettings || this.defaultAIs;
    },

    // 获取在搜索中显示的AI
    getSearchAIs() {
        return this.getAllAIs().filter(ai => ai.showInSearch !== false);
    },

    // 获取在收藏中显示的AI
    getFavoriteAIs() {
        return this.getAllAIs().filter(ai => ai.showInFavorites !== false);
    },

    // 根据ID获取AI
    getAIById(id) {
        return this.getAllAIs().find(ai => ai.id === id);
    },

    // 添加AI
    addAI(aiData, callback) {
        if (!state.userData.aiSettings) {
            state.userData.aiSettings = [];
        }
        
        const newAI = {
            id: aiData.name.toLowerCase().replace(/\s+/g, '-'),
            name: aiData.name,
            description: aiData.description,
            websiteUrl: aiData.websiteUrl || aiData.url, // 如果没有websiteUrl，使用url作为回退
            url: aiData.url,
            iconUrl: aiData.iconUrl || '',
            icon: aiData.icon || '🤖',
            showInSearch: aiData.showInSearch !== false,
            showInFavorites: aiData.showInFavorites !== false
        };
        
        state.userData.aiSettings.push(newAI);
        storage.set(state.userData, (error) => {
            if (callback) callback(error, newAI);
        });
        return newAI;
    },

    // 更新AI
    updateAI(id, aiData, callback) {
        if (!state.userData.aiSettings) {
            state.userData.aiSettings = [];
        }
        
        const index = state.userData.aiSettings.findIndex(ai => ai.id === id);
        if (index > -1) {
            state.userData.aiSettings[index] = {
                ...state.userData.aiSettings[index],
                name: aiData.name,
                description: aiData.description,
                websiteUrl: aiData.websiteUrl || aiData.url, // 如果没有websiteUrl，使用url作为回退
                url: aiData.url,
                iconUrl: aiData.iconUrl || '',
                icon: aiData.icon || '🤖',
                showInSearch: aiData.showInSearch !== false,
                showInFavorites: aiData.showInFavorites !== false
            };
            storage.set(state.userData, (error) => {
                if (callback) callback(error, state.userData.aiSettings[index]);
            });
            return state.userData.aiSettings[index];
        }
        if (callback) callback(new Error('AI not found'), null);
        return null;
    },

    // 删除AI
    deleteAI(id) {
        if (!state.userData.aiSettings) {
            return false;
        }
        
        const index = state.userData.aiSettings.findIndex(ai => ai.id === id);
        if (index > -1) {
            state.userData.aiSettings.splice(index, 1);
            storage.set(state.userData, (error) => {
                if (error) logger.error('Failed to save after delete:', error);
            });
            return true;
        }
        return false;
    },

    // 切换AI在搜索中的显示状态
    toggleSearchVisibility(id) {
        const ai = this.getAIById(id);
        if (ai) {
            ai.showInSearch = !ai.showInSearch;
            storage.set(state.userData, (error) => {
                if (error) logger.error('Failed to save after toggle search visibility:', error);
            });
            return ai.showInSearch;
        }
        return false;
    },

    // 切换AI在收藏中的显示状态
    toggleFavoritesVisibility(id) {
        const ai = this.getAIById(id);
        if (ai) {
            ai.showInFavorites = !ai.showInFavorites;
            storage.set(state.userData, (error) => {
                if (error) logger.error('Failed to save after toggle favorites visibility:', error);
            });
            return ai.showInFavorites;
        }
        return false;
    },

    // 获取所有可用的图标源（用于测试）
    getIconSources(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            
            return [
                {
                    name: 'Google Favicon',
                    url: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
                    description: 'Google图标服务，最稳定'
                },
                {
                    name: 'DuckDuckGo',
                    url: `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
                    description: 'DuckDuckGo图标服务'
                },
                {
                    name: '网站原生',
                    url: `${urlObj.protocol}//${hostname}/favicon.ico`,
                    description: '网站原生favicon'
                },
                {
                    name: 'Icon.bqb.cool',
                    url: `https://icon.bqb.cool/?url=${encodeURIComponent(urlObj.origin)}`,
                    description: '第三方图标服务'
                },
                {
                    name: 'GitHub Favicons',
                    url: `https://favicons.githubusercontent.com/${hostname}`,
                    description: 'GitHub图标服务'
                },
                {
                    name: 'Statvoo',
                    url: `https://api.statvoo.com/favicon/?url=${encodeURIComponent(urlObj.origin)}`,
                    description: 'Statvoo图标服务'
                }
            ];
        } catch (error) {
            return [];
        }
    }
};
