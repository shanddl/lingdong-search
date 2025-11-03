// =================================================================
// 数据格式化工具 - 统一数值、时间等格式化逻辑
// =================================================================

/**
 * 数据格式化工具
 */
export const Formatter = {
    /**
     * 格式化数值（带单位）
     * @param {number|string} value - 数值
     * @param {string} unit - 单位（如'px', '%', 'em'）
     * @param {number} decimals - 小数位数（默认0）
     * @returns {string} 格式化后的字符串
     */
    number(value, unit = '', decimals = 0) {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(num)) return '';
        
        const formatted = decimals > 0 ? num.toFixed(decimals) : String(Math.round(num));
        return unit ? `${formatted}${unit}` : formatted;
    },
    
    /**
     * 格式化像素值
     * @param {number|string} value - 数值
     * @returns {string} 格式化后的字符串（如'16px'）
     */
    pixels(value) {
        return this.number(value, 'px', 0);
    },
    
    /**
     * 格式化百分比
     * @param {number|string} value - 数值
     * @param {number} decimals - 小数位数（默认0）
     * @returns {string} 格式化后的字符串（如'50%'）
     */
    percentage(value, decimals = 0) {
        return this.number(value, '%', decimals);
    },
    
    /**
     * 格式化小数（用于缩放等）
     * @param {number|string} value - 数值
     * @param {number} decimals - 小数位数（默认2）
     * @returns {string} 格式化后的字符串
     */
    decimal(value, decimals = 2) {
        return this.number(value, '', decimals);
    },
    
    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的字符串（如'1.5MB'）
     */
    fileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }
};



