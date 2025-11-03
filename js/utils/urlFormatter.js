// =================================================================
// URL格式化工具 - 统一URL处理和格式化逻辑
// =================================================================

/**
 * URL格式化工具
 */
export const URLFormatter = {
    /**
     * 格式化范围站点URL
     * @param {string} url - 原始URL
     * @returns {string} 格式化后的URL
     */
    formatScopeSite(url) {
        if (!url || typeof url !== 'string') return '';
        
        let formatted = url.trim();
        
        // 移除协议（如果存在）
        formatted = formatted.replace(/^https?:\/\//i, '');
        
        // 移除www前缀（如果存在）
        formatted = formatted.replace(/^www\./i, '');
        
        // 移除尾部斜杠
        formatted = formatted.replace(/\/$/, '');
        
        return formatted;
    },
    
    /**
     * 格式化搜索引擎URL（添加{query}占位符）
     * @param {string} url - 原始URL
     * @returns {string} 格式化后的URL
     */
    formatEngineUrl(url) {
        if (!url || typeof url !== 'string') return '';
        
        let formatted = url.trim();
        if (!formatted) return '';
        
        // 如果URL不包含协议，添加https://
        if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
            formatted = 'https://' + formatted;
        }
        
        // 如果URL以斜杠结尾，移除尾部斜杠（但保留查询参数前的斜杠）
        if (formatted.includes('?')) {
            const [base, query] = formatted.split('?');
            formatted = base.replace(/\/$/, '') + (query ? '?' + query : '');
        } else {
            formatted = formatted.replace(/\/$/, '');
        }
        
        // 如果没有{query}占位符，尝试添加
        if (!formatted.includes('{query}')) {
            // 检查是否已经是搜索URL格式
            if (formatted.includes('?q=') || formatted.includes('&q=') || 
                formatted.includes('?s=') || formatted.includes('&s=') ||
                formatted.includes('?search=') || formatted.includes('&search=') ||
                formatted.includes('?query=') || formatted.includes('&query=') ||
                formatted.includes('?wd=') || formatted.includes('&wd=') ||
                formatted.includes('?word=') || formatted.includes('&word=')) {
                // 如果已经包含搜索参数，直接替换为{query}
                if (formatted.includes('?')) {
                    const parts = formatted.split('?');
                    const baseUrl = parts[0];
                    const queryParams = parts[1];
                    formatted = `${baseUrl}?${queryParams.replace(/(q|s|search|query|wd|word)=([^&]*)/i, '$1={query}')}`;
                }
            } else {
                // 添加默认的搜索参数
                formatted = formatted + '/search?q={query}';
            }
        }
        
        return formatted;
    },
    
    /**
     * 规范化URL（通用方法）
     * @param {string} url - 原始URL
     * @param {Object} options - 选项
     * @param {string} options.type - 类型：'scope', 'engine', 'normal'
     * @param {boolean} options.requireProtocol - 是否要求协议（默认false）
     * @returns {string} 格式化后的URL
     */
    normalize(url, options = {}) {
        if (!url || typeof url !== 'string') return '';
        
        const {
            type = 'normal',
            requireProtocol = false
        } = options;
        
        let normalized = url.trim();
        
        switch (type) {
            case 'scope':
                return this.formatScopeSite(normalized);
                
            case 'engine':
                return this.formatEngineUrl(normalized);
                
            case 'normal':
            default:
                // 基本规范化
                normalized = normalized.replace(/\/+$/, ''); // 移除尾部斜杠
                
                if (requireProtocol && !/^https?:\/\//i.test(normalized)) {
                    normalized = `https://${normalized}`;
                }
                
                return normalized;
        }
    },
    
    /**
     * 验证URL格式
     * @param {string} url - URL字符串
     * @returns {boolean} 是否有效
     */
    isValid(url) {
        if (!url || typeof url !== 'string') return false;
        
        try {
            // 尝试创建URL对象（需要完整URL）
            const testUrl = url.startsWith('http') ? url : `https://${url}`;
            new URL(testUrl);
            return true;
        } catch {
            return false;
        }
    }
};

