export interface Field {
  id?: number;
  name: string;
  caseID: number;
  type:
    | "Address"
    | "AutoComplete"
    | "Checkbox"
    | "Currency"
    | "Date"
    | "DateTime"
    | "Decimal"
    | "Dropdown"
    | "Email"
    | "Integer"
    | "Location"
    | "ReferenceValues"
    | "DataReferenceSingle"
    | "DataReferenceMulti"
    | "CaseReferenceSingle"
    | "CaseReferenceMulti"
    | "Percentage"
    | "Phone"
    | "RadioButtons"
    | "RichText"
    | "Status"
    | "Text"
    | "TextArea"
    | "Time"
    | "URL"
    | "UserReference";
  primary?: boolean;
}

export interface View {
  id?: number;
  name: string;
  caseID: number;
  model: {
    fields: {
      fieldId: number;
      required: boolean;
      order: number;
    }[];
    layout?: {
      type: "form" | "table" | "card";
      columns?: number;
    };
  };
}

export interface Case {
  id?: number;
  name: string;
  description: string;
  model: {
    stages: {
      id: string;
      name: string;
      order: number;
      processes: {
        id: string;
        name: string;
        order: number;
        steps: {
          id: string;
          type:
            | "Collect information"
            | "Approve/Reject"
            | "Automation"
            | "Create Case"
            | "Decision"
            | "Generate Document"
            | "Generative AI"
            | "Robotic Automation"
            | "Send Notification";
          viewId?: string; // Required if type is collect_information
          name: string;
          order: number;
        }[];
      }[];
    }[];
  };
}

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
  caseID: number;
  name: string;
  description: string;
  conditions: Condition[];
  actions: Action[];
}

export interface RuleExecution {
  id: number;
  caseID: number;
  ruleId: number;
  status: "success" | "failure";
  timestamp: string;
  error?: string;
}
