import { state } from '../state.js';
import { dom } from '../dom.js';
import { utils } from '../utils.js';
import { render } from '../ui/render.js';
import { domSafe } from '../security.js';
import { core } from '../core.js';

// =================================================================
// 时间规则处理器
// =================================================================
export const timeRuleHandlers = {
    updateFormVisibility: (type) => {
        dom.timeRuleRelativePanel.classList.toggle('hidden', type !== 'relative');
        dom.timeRuleSinglePanel.classList.toggle('hidden', type !== 'single');
        dom.timeRuleRangePanel.classList.toggle('hidden', type !== 'range');
    },
    resetForm: () => {
        dom.addTimeFilterForm.reset();
        dom.timeRuleId.value = '';
        dom.timeRuleEditorTitle.textContent = '添加新规则';
        dom.cancelTimeRuleEditBtn.classList.add('hidden');
        const typeBtn = dom.timeRuleType;
        typeBtn.dataset.value = 'relative';
        typeBtn.textContent = '相对时间';
        timeRuleHandlers.updateFormVisibility('relative');
    },
    editRule: (id) => {
        const rule = state.userData.dynamicFilters.timeRange.find(r => r.id === id);
        if (!rule) return;

        timeRuleHandlers.resetForm();
        dom.timeRuleId.value = rule.id;
        dom.timeRuleName.value = rule.name;
        dom.timeRuleEditorTitle.textContent = '编辑规则';
        dom.cancelTimeRuleEditBtn.classList.remove('hidden');

        const typeBtn = dom.timeRuleType;
        typeBtn.dataset.value = rule.type;
        if (rule.type === 'relative') typeBtn.textContent = '相对时间';
        if (rule.type === 'single') typeBtn.textContent = '固定日期';
        if (rule.type === 'range') typeBtn.textContent = '日期范围';
        timeRuleHandlers.updateFormVisibility(rule.type);

        if (rule.type === 'relative') {
            dom.timeRuleRelativeValue.value = rule.params.value;
        } else if (rule.type === 'single') {
            const conditionBtn = dom.timeRuleSingleCondition;
            conditionBtn.dataset.value = rule.params.condition;
            conditionBtn.textContent = rule.params.condition === 'after' ? '之后' : '之前';
            dom.timeRuleSingleDate.value = rule.params.date;
        } else if (rule.type === 'range') {
            dom.timeRuleRangeStart.value = rule.params.start;
            dom.timeRuleRangeEnd.value = rule.params.end;
        }
    },
    saveRule: (e) => {
        e.preventDefault();
        const id = dom.timeRuleId.value || `time_${Date.now()}`;
        const name = dom.timeRuleName.value.trim();
        const type = dom.timeRuleType.dataset.value;
        if(!name) { 
            // 使用安全的错误提示对话框
            domSafe.showAlert('请输入显示名称', 'error');
            return; 
        }

        let params = {};
        if (type === 'relative') {
            params.value = dom.timeRuleRelativeValue.value.trim();
            if (!/^[dwmy]\d+$/.test(params.value)) { 
                // 使用安全的错误提示对话框
                domSafe.showAlert('相对时间代码格式不正确 (例如: d7, w1, m3, y1)', 'error');
                return; 
            }
        } else if (type === 'single') {
            params.condition = dom.timeRuleSingleCondition.dataset.value;
            params.date = dom.timeRuleSingleDate.value;
            if(!params.date) { 
                // 使用安全的错误提示对话框
                domSafe.showAlert('请选择一个日期', 'error');
                return; 
            }
        } else if (type === 'range') {
            params.start = dom.timeRuleRangeStart.value;
            params.end = dom.timeRuleRangeEnd.value;
            if(!params.start || !params.end) { 
                // 使用安全的错误提示对话框
                domSafe.showAlert('请输入开始和结束日期', 'error');
                return; 
            }
        }

        const newRule = { id, name, type, params };
        const index = state.userData.dynamicFilters.timeRange.findIndex(r => r.id === id);
        if (index > -1) {
            state.userData.dynamicFilters.timeRange[index] = newRule;
        } else {
            state.userData.dynamicFilters.timeRange.push(newRule);
        }

        core.saveUserData(err => {
            if (err) return;
            render.dynamicFilterManagement('timeRange');
            timeRuleHandlers.resetForm();
        });
    },
    deleteRule: (id) => {
        state.userData.dynamicFilters.timeRange = state.userData.dynamicFilters.timeRange.filter(r => r.id !== id);
        core.saveUserData(() => render.dynamicFilterManagement('timeRange'));
    }
};

