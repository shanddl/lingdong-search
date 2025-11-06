import { state } from '../state.js';
import { core } from '../core.js';
import { logger } from '../logger.js';

// =================================================================
// 域名规则处理器 - 根据域名或正则表达式自动启用/禁用扩展或扩展组
// =================================================================
export const domainRuleHandlers = {
    /**
     * 初始化域名规则数据
     */
    initRules() {
        // 确保state.userData已初始化（可能需要延迟初始化）
        if (!state.userData) {
            state.userData = {};
        }
        if (!state.userData.extensionSettings) {
            state.userData.extensionSettings = {};
        }
        if (!Array.isArray(state.userData.extensionSettings.domainRules)) {
            state.userData.extensionSettings.domainRules = [];
        }
    },

    /**
     * 获取所有规则
     */
    getRules() {
        this.initRules();
        return state.userData.extensionSettings.domainRules;
    },

    /**
     * 保存规则
     */
    saveRules() {
        core.saveUserData(() => {});
    },

    /**
     * 添加新规则
     * @param {Object} rule - 规则对象
     * @returns {Object} 新创建的规则
     */
    addRule(rule) {
        const rules = this.getRules();
        const newRule = {
            id: rule.id || `domain_rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: rule.name || '未命名规则',
            type: rule.type || 'extension', // 'extension' 或 'group'
            targetId: rule.targetId, // 扩展ID或分组ID
            domains: rule.domains || [], // 域名列表（支持正则表达式）
            action: rule.action || 'enable', // 'enable' 或 'disable'
            enabled: rule.enabled !== undefined ? rule.enabled : true
        };
        rules.push(newRule);
        this.saveRules();
        logger.debug('[DomainRuleHandlers] 添加规则:', newRule);
        return newRule;
    },

    /**
     * 更新规则
     * @param {string} ruleId - 规则ID
     * @param {Object} updates - 更新内容
     */
    updateRule(ruleId, updates) {
        const rules = this.getRules();
        const index = rules.findIndex(r => r.id === ruleId);
        if (index !== -1) {
            rules[index] = { ...rules[index], ...updates };
            this.saveRules();
            logger.debug('[DomainRuleHandlers] 更新规则:', ruleId, updates);
        }
    },

    /**
     * 删除规则
     * @param {string} ruleId - 规则ID
     */
    deleteRule(ruleId) {
        const rules = this.getRules();
        const index = rules.findIndex(r => r.id === ruleId);
        if (index !== -1) {
            rules.splice(index, 1);
            this.saveRules();
            logger.debug('[DomainRuleHandlers] 删除规则:', ruleId);
        }
    },

    /**
     * 检查域名是否匹配规则
     * @param {string} domain - 当前域名
     * @param {Array<string>} ruleDomains - 规则中的域名列表（支持正则表达式）
     * @returns {boolean} 是否匹配
     */
    matchDomain(domain, ruleDomains) {
        if (!domain || !ruleDomains || ruleDomains.length === 0) {
            return false;
        }

        const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
        
        return ruleDomains.some(ruleDomain => {
            if (!ruleDomain || !ruleDomain.trim()) {
                return false;
            }

            const normalizedRule = ruleDomain.trim();
            
            // 精确匹配
            if (normalizedRule === normalizedDomain) {
                return true;
            }
            
            // 通配符匹配（如 *.example.com）
            if (normalizedRule.startsWith('*.')) {
                const suffix = normalizedRule.substring(2).toLowerCase();
                return normalizedDomain.endsWith('.' + suffix) || normalizedDomain === suffix;
            }
            
            // 正则表达式匹配（如果包含正则特殊字符）
            try {
                // 检查是否看起来像正则表达式（包含 /.../ 或特殊字符）
                let regexPattern = normalizedRule;
                
                // 如果以 / 开头和结尾，提取中间的正则表达式
                if (normalizedRule.startsWith('/') && normalizedRule.endsWith('/')) {
                    regexPattern = normalizedRule.slice(1, -1);
                }
                
                // 尝试编译为正则表达式
                const regex = new RegExp(regexPattern, 'i'); // 不区分大小写
                return regex.test(normalizedDomain);
            } catch (e) {
                // 如果正则表达式无效，尝试作为普通字符串匹配
                return normalizedRule.toLowerCase() === normalizedDomain;
            }
        });
    },

    /**
     * 应用域名规则（在标签页URL变化时调用）
     * @param {string} url - 当前标签页URL
     */
    async applyRules(url) {
        if (!url) return;

        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            
            const rules = this.getRules();
            const enabledRules = rules.filter(r => r.enabled);

            logger.debug('[DomainRuleHandlers] 检查域名规则:', domain, '规则数量:', enabledRules.length);

            for (const rule of enabledRules) {
                if (this.matchDomain(domain, rule.domains)) {
                    logger.info(`[DomainRuleHandlers] 规则匹配: ${rule.name} (${domain})`);
                    await this.applyRule(rule, rule.action === 'enable');
                }
            }
        } catch (error) {
            logger.error('[DomainRuleHandlers] 应用规则失败:', error);
        }
    },

    /**
     * 应用单个规则
     * @param {Object} rule - 规则对象
     * @param {boolean} enable - 是否启用
     */
    async applyRule(rule, enable) {
        try {
            if (rule.type === 'extension') {
                // 直接使用 Chrome Management API 启用/禁用扩展
                if (chrome && chrome.management) {
                    await chrome.management.setEnabled(rule.targetId, enable);
                    logger.info(`[DomainRuleHandlers] ${enable ? '启用' : '禁用'}扩展: ${rule.targetId}`);
                } else {
                    logger.error('[DomainRuleHandlers] Chrome management API 不可用');
                }
            } else if (rule.type === 'group') {
                // 扩展组功能已移除（extension-manager.js 已删除）
                // 如需使用扩展组功能，请使用 popup 窗口中的扩展管理功能
                logger.warn(`[DomainRuleHandlers] 扩展组功能已移除，无法${enable ? '启用' : '禁用'}扩展组: ${rule.targetId}`);
            }
        } catch (error) {
            logger.error(`[DomainRuleHandlers] 应用规则失败: ${rule.name}`, error);
        }
    },

    /**
     * 验证域名格式
     * @param {string} domain - 域名
     * @returns {Object} { valid: boolean, error?: string }
     */
    validateDomain(domain) {
        if (!domain || !domain.trim()) {
            return { valid: false, error: '域名不能为空' };
        }

        const trimmed = domain.trim();
        
        // 检查是否是有效的正则表达式格式（以 / 开头和结尾）
        if (trimmed.startsWith('/') && trimmed.endsWith('/')) {
            try {
                const pattern = trimmed.slice(1, -1);
                new RegExp(pattern);
                return { valid: true };
            } catch (e) {
                return { valid: false, error: '正则表达式格式无效: ' + e.message };
            }
        }

        // 检查是否是有效的域名格式
        // 允许通配符 *.example.com
        if (trimmed.startsWith('*.')) {
            const suffix = trimmed.substring(2);
            if (suffix.length === 0) {
                return { valid: false, error: '通配符域名不能为空' };
            }
            // 验证后缀格式
            if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(suffix)) {
                return { valid: false, error: '域名格式无效' };
            }
            return { valid: true };
        }

        // 普通域名验证
        if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(trimmed)) {
            // 可能是正则表达式，尝试编译
            try {
                new RegExp(trimmed);
                return { valid: true };
            } catch (e) {
                return { valid: false, error: '域名格式无效或正则表达式格式错误' };
            }
        }

        return { valid: true };
    }
};

