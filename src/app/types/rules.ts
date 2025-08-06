// These types are now dynamically generated from the rule type registry

export interface Condition {
  field: string;
  operator: "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan";
  value: string | number | boolean;
}

export interface Action {
  type: "setField" | "sendNotification" | "createCase";
  params: {
    field?: string;
    value?: string | number | boolean;
    message?: string;
    caseType?: string;
  };
}

export interface Rule {
  id: number;
  caseid: number;
  name: string;
  description: string;
  conditions: Condition[];
  actions: Action[];
}

export interface RuleExecution {
  id: number;
  caseid: number;
  ruleId: number;
  status: "success" | "failure";
  timestamp: string;
  error?: string;
}
