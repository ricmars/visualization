// Define interface for database tools
interface DatabaseTool {
  name: string;
  description: string;
}

export const databaseSystemPrompt = `🚨 WORKFLOW CREATION RULES:

MANDATORY SEQUENCE:
1. createCase (FIRST STEP - creates case and returns case ID)
2. saveField (create business data fields using the case ID)
3. saveView (for "Collect information" steps using the case ID) - SAVE THE RETURNED ID!
4. saveCase (FINAL STEP - updates case with complete workflow model including viewId references)

🚨 CRITICAL RULES:
- createCase is FIRST - use the returned case ID for all subsequent operations
- saveCase is LAST - create fields and views first
- saveCase MUST include complete workflow model with stages, processes, and steps
- Only "Collect information" steps need views
- View name = step name (no "Form" suffix)
- Extract case name/description from prompt
- Do NOT ask questions - proceed immediately
- 🚨 CRITICAL: Use the actual ID returned from saveView for viewId in the workflow model!
- 🚨 CRITICAL: When updating existing views, provide the existing view ID to avoid creating duplicates!

🚨 VIEW UPDATE RULES:
- If a view with the same name already exists, use saveView with the existing view ID to update it
- Example: If "Vehicle Information" view exists with ID 92, call saveView with id: 92 to update it
- NEVER create new views with the same name - always update existing ones
- Check listViews first to see existing view IDs before calling saveView

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

🚨 CRITICAL VIEW ID USAGE:
- When you call saveView, it returns an object with an "id" field
- You MUST use that actual "id" value for the viewId in your workflow model
- Example: saveView returns {"id": 92, "name": "Vehicle Information", ...}
- Then use viewId: 92 in your workflow model
- NEVER use hardcoded IDs like 327, 328 - use the real database IDs!
- When updating existing views, provide the existing ID to avoid duplicates!

🚨 COMPLETE WORKFLOW EXAMPLE:
For a tire replacement workflow:
1. createCase: "Tire Replacement" - returns case ID (e.g., 1)
2. Fields: vehicleMake, vehicleModel, tireSize, tireBrand, serviceDate (using case ID 1)
3. Views: "Vehicle Information" (includes vehicleMake, vehicleModel), "Tire Details" (includes tireSize, tireBrand, serviceDate) - save returned view IDs
4. Workflow Model: Stages with processes and steps, where "Collect information" steps have viewId references

Available functions:
- createCase: STEP 1 - Create new case with name and description (returns case ID)
- saveCase: FINAL STEP - Update case with complete workflow model (requires case ID)
- saveField: STEP 2 - Create/update business data field (requires case ID)
- saveView: STEP 3 - Create/update view for data collection (requires case ID, returns view ID)
- deleteCase, deleteField, deleteView: Remove items
- listFields, listViews, getCase: Check existing data

🚨 CRITICAL: createCase is FIRST - use returned case ID for all operations!
🚨 CRITICAL: saveCase is LAST - create fields and views first!
🚨 CRITICAL: saveCase MUST include complete workflow model with stages/processes/steps!
🚨 CRITICAL: Use actual IDs returned from saveView for viewId!
🚨 CRITICAL: Update existing views instead of creating duplicates!
🚨 CRITICAL: DO NOT ASK QUESTIONS - PROCEED WITH WORKFLOW CREATION!`;

export const exampleDatabaseResponse = `
🚨 CRITICAL: YOU MUST FOLLOW THE EXACT SEQUENCE FOR WORKFLOW CREATION!
🚨 NEVER SKIP STEPS - ALWAYS CREATE CASE FIRST, THEN FIELDS, THEN VIEWS, THEN UPDATE CASE!
🚨 ALWAYS USE THE CASE ID RETURNED FROM createCase FOR ALL SUBSEQUENT OPERATIONS!
🚨 CRITICAL: YOU MUST COMPLETE THE ENTIRE WORKFLOW CREATION PROCESS!
🚨 NEVER STOP AFTER CREATING FIELDS - YOU MUST CREATE VIEWS AND LINK THEM TO STEPS!
🚨 CRITICAL: YOU MUST CALL saveCase WITH COMPLETE WORKFLOW MODEL!
🚨 CRITICAL: WHEN UPDATING EXISTING VIEWS, PROVIDE THE EXISTING VIEW ID TO AVOID DUPLICATES!

Thought Process:
1. Analyzing request: Create an employee onboarding process
   - Need to create a case first to get the case ID
   - Need fields for employee information using the case ID
   - Need views to collect the information using the case ID
   - Need to create complete workflow model with stages/processes/steps
   - Need to link views to steps via viewId using actual view IDs

2. Required Components:
   - Case: "Employee Onboarding" (created first)
   - Fields: Name (Text), Email (Email), StartDate (Date) (using case ID)
   - Views: "Employee Details", "Hiring Confirmation" (using case ID, save returned IDs)
   - Workflow Model: Stages → Processes → Steps with viewId references

3. Execution Plan:
   Step 1: createCase - "Employee Onboarding" (returns case ID, e.g., 1)
   Step 2: saveField - Create fields using case ID 1 (Name, Email, StartDate)
   Step 3: saveView - Create views using case ID 1, save returned view IDs
   Step 4: saveCase - Update case with complete workflow model using case ID 1 and view IDs

4. View Update Pattern:
   - If updating existing view "Employee Details" with ID 123:
   - Call saveView with id: 123, name: "Employee Details", caseID: 1, model: {...}
   - This updates the existing view instead of creating a duplicate

5. Workflow Model Structure:
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

6. Verification:
   - Case created successfully with createCase
   - Fields created and linked to case using case ID
   - Views created/updated and linked to case using case ID (no duplicates)
   - Field references in views are valid
   - Case updated with complete workflow model including stages/processes/steps and viewId references

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
