import { TransferRule } from '../models/TransferRule';
import ValidationService from '../services/ValidationService';

/**
 * RuleController - Manages transfer rule operations
 */
class RuleController {
  createRule(ruleData, rules) {
    const rule = new TransferRule(ruleData);
    
    const errors = ValidationService.validateTransferRule(rule);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    
    return [...rules, rule];
  }

  updateRule(ruleId, ruleData, rules) {
    return rules.map(rule =>
      rule.id === ruleId ? new TransferRule({ ...rule, ...ruleData }) : rule
    );
  }

  deleteRule(ruleId, rules) {
    return rules.filter(rule => rule.id !== ruleId);
  }

  getRuleById(ruleId, rules) {
    return rules.find(rule => rule.id === ruleId);
  }
}

export default new RuleController();