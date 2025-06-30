// Define interface for database tools
interface DatabaseTool {
  name: string;
  description: string;
}

export const databaseSystemPrompt = `🚨 WORKFLOW CREATION RULES:

MANDATORY SEQUENCE:
1. getCase, listFields, listViews (check existing data)
2. saveField (create business data fields)
3. saveView (for "Collect information" steps)
4. saveCase (FINAL STEP - includes complete workflow model with stages/processes/steps)

🚨 CRITICAL RULES:
- saveCase is LAST - create fields and views first
- saveCase MUST include complete workflow model with stages, processes, and steps
- Only "Collect information" steps need views
- View name = step name (no "Form" suffix)
- Extract case name/description from prompt
- Do NOT ask questions - proceed immediately

🚨 FIELD EXAMPLES:
GENERAL: applicantName, email, phoneNumber, address, budget, startDate
KITCHEN: cabinetStyle, countertopMaterial, applianceList
LOAN: loanAmount, downPayment, interestRate, income
TIRE: vehicleMake, vehicleModel, tireSize, tireBrand, serviceDate

🚨 STEP TYPES:
- "Collect information" - REQUIRES view
- "Approve/Reject", "Decision", "Automation", "Review", "Process" - NO view needed

🚨 WORKFLOW MODEL STRUCTURE (REQUIRED FOR saveCase):
{
  "stages": [
    {
      "id": 1,
      "name": "Stage Name",
      "order": 1,
      "processes": [
        {
          "id": 1,
          "name": "Process Name",
          "order": 1,
          "steps": [
            {
              "id": 1,
              "type": "Collect information",
              "name": "Step Name",
              "order": 1,
              "viewId": 123
            }
          ]
        }
      ]
    }
  ]
}

🚨 COMPLETE WORKFLOW EXAMPLE:
For a tire replacement workflow:
1. Fields: vehicleMake, vehicleModel, tireSize, tireBrand, serviceDate
2. Views: "Vehicle Information" (includes vehicleMake, vehicleModel), "Tire Details" (includes tireSize, tireBrand, serviceDate)
3. Workflow Model: Stages with processes and steps, where "Collect information" steps have viewId references

Available functions:
- saveCase: Create/update case with workflow model
- saveField: Create/update business data field
- saveView: Create/update view for data collection
- deleteCase, deleteField, deleteView: Remove items
- listFields, listViews, getCase: Check existing data

🚨 CRITICAL: saveCase is LAST - create fields and views first!
🚨 CRITICAL: saveCase MUST include complete workflow model with stages/processes/steps!
🚨 CRITICAL: DO NOT ASK QUESTIONS - PROCEED WITH WORKFLOW CREATION!`;

export const exampleDatabaseResponse = `
🚨 CRITICAL: YOU MUST ALWAYS USE HELPER TOOLS FIRST BEFORE ANY CREATION OPERATIONS!
🚨 NEVER CREATE ANYTHING WITHOUT CHECKING WHAT EXISTS FIRST!
🚨 ALWAYS USE getCase, listFields, AND listViews BEFORE createField OR createView!
🚨 CRITICAL: YOU MUST COMPLETE THE ENTIRE WORKFLOW CREATION PROCESS!
🚨 NEVER STOP AFTER CREATING FIELDS - YOU MUST CREATE VIEWS AND LINK THEM TO STEPS!
🚨 CRITICAL: YOU MUST CALL saveCase WITH COMPLETE WORKFLOW MODEL!

Thought Process:
1. Analyzing request: Create an employee onboarding process
   - Need a case for the overall process
   - Need fields for employee information
   - Need views to collect the information
   - Need to create complete workflow model with stages/processes/steps
   - Need to link views to steps via viewId

2. Required Components:
   - Case: "Employee Onboarding"
   - Fields: Name (Text), Email (Email), StartDate (Date)
   - Views: "Employee Details", "Hiring Confirmation"
   - Workflow Model: Stages → Processes → Steps with viewId references

3. Execution Plan:
   Step 1: Use getCase, listFields, and listViews to check existing data
   Step 2: Create Fields for data collection (Name, Email, StartDate)
   Step 3: Create Views for information collection steps
   Step 4: Create Case with complete workflow model using saveCase (includes stages/processes/steps with viewId references)

4. Workflow Model Structure:
   {
     "stages": [
       {
         "id": 1,
         "name": "Application",
         "order": 1,
         "processes": [
           {
             "id": 1,
             "name": "Data Collection",
             "order": 1,
             "steps": [
               {
                 "id": 1,
                 "type": "Collect information",
                 "name": "Employee Details",
                 "order": 1,
                 "viewId": 123
               }
             ]
           }
         ]
       }
     ]
   }

5. Verification:
   - Case created successfully
   - Fields created and linked to case
   - Views created and linked to case
   - Field references in views are valid
   - Case created with complete workflow model including stages/processes/steps

I will now execute this plan using the OpenAI function calling API to create the complete workflow in the database.
`;

// Export a function to get the complete tools context
export function getCompleteToolsContext(databaseTools: DatabaseTool[]): string {
  return `Available tools:
${databaseTools
  .map((tool) => `- ${tool.name}: ${tool.description.substring(0, 100)}...`)
  .join("\n")}

Use OpenAI function calling to execute tools. Complete workflow in minimal iterations.`;
}
