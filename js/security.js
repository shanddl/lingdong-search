// =================================================================
// 安全工具模块 - 防止XSS攻击和其他安全漏洞
// =================================================================

/**
 * HTML转义工具类
 */
export const sanitizer = {
    /**
     * 转义HTML特殊字符，防止XSS攻击
     * @param {string} str - 需要转义的字符串
     * @returns {string} 转义后的安全字符串
     */
    escapeHtml: (str) => {
        if (typeof str !== 'string') return '';
        
        const htmlEscapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
        
        return str.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char]);
    },
    
    /**
     * 转义HTML属性值
     * @param {string} str - 需要转义的属性值
     * @returns {string} 转义后的安全属性值
     */
    escapeAttr: (str) => {
        if (typeof str !== 'string') return '';
        return str.replace(/["'<>&]/g, (char) => {
            const map = {'"': '&quot;', "'": '&#x27;', '<': '&lt;', '>': '&gt;', '&': '&amp;'};
            return map[char];
        });
    },
    
    /**
     * 验证URL是否安全
     * @param {string} url - 需要验证的URL
     * @returns {boolean} 是否为安全URL
     */
    isValidUrl: (url) => {
        if (typeof url !== 'string') return false;
        
        try {
            const urlObj = new URL(url);
            // 只允许http和https协议，防止javascript:、data:等危险协议
            return ['http:', 'https:'].includes(urlObj.protocol);
        } catch (e) {
            return false;
        }
    },
    
    /**
     * 清理URL，确保安全
     * @param {string} url - 需要清理的URL
     * @returns {string} 清理后的安全URL或空字符串
     */
    sanitizeUrl: (url) => {
        if (!url || typeof url !== 'string') return '';
        
        const trimmed = url.trim();
        if (!trimmed) return '';
        
        try {
            const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
            // 只允许http和https协议
            if (['http:', 'https:'].includes(urlObj.protocol)) {
                return urlObj.href;
            }
        } catch (e) {
            // URL解析失败
        }
        
        return '';
    },
    
    /**
     * 验证并清理图标URL
     * @param {string} iconUrl - 图标URL
     * @returns {string} 清理后的图标URL或默认占位符
     */
    sanitizeIconUrl: (iconUrl) => {
        if (!iconUrl || typeof iconUrl !== 'string') {
            return 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
        }
        
        const cleaned = sanitizer.sanitizeUrl(iconUrl);
        return cleaned || 'https://placehold.co/24x24/3c4043/e8eaed?text=?';
    }
};

/**
 * 安全的DOM操作工具
 */
export const domSafe = {
    /**
     * 安全地设置文本内容
     * @param {HTMLElement} element - 目标元素
     * @param {string} text - 文本内容
     */
    setText: (element, text) => {
        if (element && element.nodeType === 1) {
            element.textContent = typeof text === 'string' ? text : '';
        }
    },
    
    /**
     * 安全地创建带文本的元素
     * @param {string} tagName - 标签名
     * @param {string} text - 文本内容
     * @param {string} className - CSS类名（可选）
     * @returns {HTMLElement} 创建的元素
     */
    createElement: (tagName, text = '', className = '') => {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    },
    
    /**
     * 安全地设置属性
     * @param {HTMLElement} element - 目标元素
     * @param {string} attr - 属性名
     * @param {string} value - 属性值
     */
    setAttr: (element, attr, value) => {
        if (!element || !attr) return;
        
        // 对于src、href等URL属性，需要验证
        if (['src', 'href'].includes(attr.toLowerCase())) {
            const safeUrl = sanitizer.sanitizeUrl(value);
            if (safeUrl) {
                element.setAttribute(attr, safeUrl);
            }
        } else {
            element.setAttribute(attr, sanitizer.escapeAttr(String(value)));
        }
    },
    
    /**
     * 创建安全的模态框
     * @param {Object} options - 模态框配置
     * @returns {HTMLElement} 模态框元素
     */
    createModal: (options = {}) => {
        const {
            id = `modal-${Date.now()}`,
            title = '提示',
            message = '',
            type = 'info', // 'info', 'confirm', 'error'
            confirmText = '确定',
            cancelText = '取消',
            onConfirm = null,
            onCancel = null
        } = options;
        
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal-overlay visible';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.cssText = 'max-width: 360px; border-radius: 16px; background: var(--card-bg); border: 1px solid var(--border-color); padding: 32px 24px 24px;';
        
        const body = document.createElement('div');
        body.className = 'modal-body';
        body.style.cssText = 'text-align: center; margin-bottom: 28px;';
        
        const messageP = document.createElement('p');
        messageP.style.cssText = 'margin: 0; color: var(--text-primary); font-size: 15px; line-height: 1.6; white-space: pre-line;';
        messageP.textContent = message; // white-space: pre-line 会保留换行符
        
        body.appendChild(messageP);
        content.appendChild(body);
        
        const footer = document.createElement('div');
        footer.className = 'modal-footer justify-center';
        footer.style.cssText = 'gap: 16px; display: flex; justify-content: center; padding: 0;';
        
        if (type === 'confirm') {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'modal-btn modal-btn-secondary';
            cancelBtn.style.cssText = 'padding: 10px 24px; border-radius: 8px; font-size: 14px; min-width: 100px;';
            cancelBtn.textContent = cancelText;
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
                if (onCancel) onCancel();
            });
            footer.appendChild(cancelBtn);
        }
        
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'modal-btn modal-btn-primary';
        confirmBtn.style.cssText = 'padding: 10px 24px; border-radius: 8px; font-size: 14px; min-width: 100px;';
        if (type === 'error' || type === 'confirm') {
            confirmBtn.style.background = type === 'error' ? 'var(--red)' : '';
            confirmBtn.style.border = type === 'error' ? 'none' : '';
        }
        confirmBtn.textContent = confirmText;
        confirmBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            if (onConfirm) onConfirm();
        });
        footer.appendChild(confirmBtn);
        
        content.appendChild(footer);
        modal.appendChild(content);
        
        // 点击外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                if (onCancel) onCancel();
            }
        });
        
        return modal;
    },
    
    /**
     * 显示提示模态框
     * @param {string} message - 提示消息
     * @param {string} type - 类型 ('info', 'error')
     */
    showAlert: (message, type = 'info') => {
        const modal = domSafe.createModal({
            message,
            type,
            confirmText: '确定'
        });
        document.body.appendChild(modal);
    },
    
    /**
     * 显示确认模态框
     * @param {string} message - 确认消息
     * @param {Function} onConfirm - 确认回调
     * @param {Function} onCancel - 取消回调
     */
    showConfirm: (message, onConfirm, onCancel) => {
        const modal = domSafe.createModal({
            message,
            type: 'confirm',
            confirmText: '确定',
            cancelText: '取消',
            onConfirm,
            onCancel
        });
        document.body.appendChild(modal);
    },
    
    /**
     * 安全地清空并重建元素内容
     * @param {HTMLElement} element - 目标元素
     * @param {Array<HTMLElement>} children - 子元素数组
     */
    replaceChildren: (element, children = []) => {
        if (!element || element.nodeType !== 1) return;
        
        // 清空现有内容
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        
        // 添加新的子元素
        children.forEach(child => {
            if (child && child.nodeType === 1) {
                element.appendChild(child);
            }
        });
    }
};

/**
 * 输入验证工具
 */
export const validator = {
    /**
     * 验证搜索引擎URL格式
     * @param {string} url - 搜索引擎URL
     * @returns {Object} {valid: boolean, message: string}
     */
    validateEngineUrl: (url) => {
        if (!url || typeof url !== 'string') {
            return { valid: false, message: '请输入搜索引擎URL' };
        }
        
        const trimmed = url.trim();
        if (!trimmed) {
            return { valid: false, message: 'URL不能为空' };
        }
        
        // 检查是否包含{query}占位符
        if (!trimmed.includes('{query}')) {
            return { valid: false, message: 'URL必须包含{query}占位符' };
        }
        
        // 验证URL格式
        if (!sanitizer.isValidUrl(trimmed.replace('{query}', 'test'))) {
            return { valid: false, message: 'URL格式不正确' };
        }
        
        return { valid: true, message: '' };
    },
    
    /**
     * 验证网站URL
     * @param {string} url - 网站URL
     * @returns {Object} {valid: boolean, message: string}
     */
    validateSiteUrl: (url) => {
        if (!url || typeof url !== 'string') {
            return { valid: false, message: '请输入网站地址' };
        }
        
        const trimmed = url.trim();
        if (!trimmed) {
            return { valid: false, message: 'URL不能为空' };
        }
        
        if (!sanitizer.isValidUrl(trimmed)) {
            return { valid: false, message: 'URL格式不正确' };
        }
        
        return { valid: true, message: '' };
    },
    
    /**
     * 清理和验证用户输入的名称
     * @param {string} name - 名称
     * @param {number} maxLength - 最大长度
     * @returns {Object} {valid: boolean, cleaned: string, message: string}
     */
    cleanName: (name, maxLength = 50) => {
        if (!name || typeof name !== 'string') {
            return { valid: false, cleaned: '', message: '名称不能为空' };
        }
        
        const trimmed = name.trim();
        if (!trimmed) {
            return { valid: false, cleaned: '', message: '名称不能为空' };
        }
        
        if (trimmed.length > maxLength) {
            return { 
                valid: false, 
                cleaned: trimmed.substring(0, maxLength), 
                message: `名称长度不能超过${maxLength}个字符` 
            };
        }
        
        // 移除潜在的危险字符
        const cleaned = trimmed.replace(/[<>]/g, '');
        
        return { valid: true, cleaned, message: '' };
    }
};

