# Project Configuration

## Critical Settings (ALWAYS CHECK FIRST)

This project uses specific configuration that MUST be followed:

### Port Configuration

- **Development Port**: 3100 (NOT 3000)
- **Configured in**: `package.json` → `"dev": "next dev -p 3100"`
- **URL**: http://localhost:3100

### Package Manager

- **Package Manager**: npm (NOT pnpm)
- **Evidence**: `package-lock.json` present, no `pnpm-lock.yaml`
- **Install**: `npm install`
- **Dev Server**: `npm run dev`
- **Tests**: `npm test`

### Database Operations

- **Reset Database**: `curl -X POST http://localhost:3100/api/reset-db`
- **API Base**: http://localhost:3100/api

### Common Commands

```bash
# Development
npm run dev          # Start dev server on port 3100
npm run build        # Build for production
npm run start        # Start production server

# Testing
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Database
curl -X POST http://localhost:3100/api/reset-db  # Reset database
```

### API Endpoints

- **OpenAI API**: POST http://localhost:3100/api/openai
- **Database API**: GET/POST http://localhost:3100/api/database
- **Reset DB**: POST http://localhost:3100/api/reset-db

## Verification Checklist

Before running any commands or generating examples, verify:

- [ ] Using port 3100 (not 3000)
- [ ] Using npm (not pnpm)
- [ ] Using correct API endpoints with port 3100
- [ ] Using correct package.json scripts

## Common Mistakes to Avoid

- ❌ `curl http://localhost:3000/api/openai` (wrong port)
- ❌ `pnpm run dev` (wrong package manager)
- ❌ `npm run dev` without specifying port (will use default 3000)
- ✅ `curl http://localhost:3100/api/openai` (correct)
- ✅ `npm run dev` (correct, uses port 3100 from package.json)

## Step Types and View Requirements

### Valid Step Types

The system supports the following step types, each with specific purposes:

1. **"Collect information"** - REQUIRES a view

   - Purpose: Gathers data from users through forms
   - Examples: "Request Details", "Design Preferences", "Material Selection"
   - View Required: YES - must have a corresponding database view
   - viewId Required: YES - must reference a valid view ID

2. **"Approve/Reject"** - NO view needed

   - Purpose: Makes yes/no decisions
   - Examples: "Approval", "Design Approval", "Construction Approval"
   - View Required: NO - this is a decision step
   - viewId Required: NO - should not have viewId

3. **"Decision"** - NO view needed

   - Purpose: Makes complex decisions with multiple options
   - Examples: "Budget Evaluation", "Material Selection", "Timeline and Budget"
   - View Required: NO - this is a decision step
   - viewId Required: NO - should not have viewId

4. **"Automation"** - NO view needed

   - Purpose: Automated processes
   - Examples: "Send Email", "Generate Report", "Update Status"
   - View Required: NO - this is an automated step
   - viewId Required: NO - should not have viewId

5. **"Create Case"** - NO view needed

   - Purpose: Creates new cases
   - Examples: "Create Sub-Project", "Create Follow-up Case"
   - View Required: NO - this creates new cases
   - viewId Required: NO - should not have viewId

6. **"Generate Document"** - NO view needed

   - Purpose: Document creation
   - Examples: "Create Contract", "Generate Invoice", "Create Report"
   - View Required: NO - this generates documents
   - viewId Required: NO - should not have viewId

7. **"Generative AI"** - NO view needed

   - Purpose: Uses AI for processing
   - Examples: "AI Analysis", "Content Generation"
   - View Required: NO - this uses AI
   - viewId Required: NO - should not have viewId

8. **"Robotic Automation"** - NO view needed

   - Purpose: Robotic process automation
   - Examples: "RPA Task", "Automated Data Entry"
   - View Required: NO - this is automated
   - viewId Required: NO - should not have viewId

9. **"Send Notification"** - NO view needed
   - Purpose: Sends notifications
   - Examples: "Notify Contractor", "Send Completion Notice"
   - View Required: NO - this sends notifications
   - viewId Required: NO - should not have viewId

### Critical Rules

1. **Only "Collect information" steps need views**

   - All other step types do NOT need views
   - The LLM should only create views for "Collect information" steps
   - Creating views for other step types is incorrect

2. **"Review" is NOT a valid step type**

   - If you see "Review" in a step type, it should be "Decision" or "Approve/Reject"
   - Use the exact step type names listed above

3. **viewId requirements**

   - ONLY "Collect information" steps should have viewId
   - All other step types should NOT have viewId
   - The viewId should reference the ID returned from createView

4. **Case model structure**
   - Initial case creation: no viewId references
   - After creating views: only "Collect information" steps get viewId
   - Other step types remain without viewId

### Example Case Model

```json
{
  "stages": [
    {
      "id": "stage1",
      "name": "Request Stage",
      "order": 1,
      "processes": [
        {
          "id": "process1",
          "name": "Request Process",
          "order": 1,
          "steps": [
            {
              "id": "step1",
              "type": "Collect information",
              "name": "Request Details",
              "order": 1,
              "viewId": "5"
            },
            {
              "id": "step2",
              "type": "Approve/Reject",
              "name": "Approval",
              "order": 2
            },
            {
              "id": "step3",
              "type": "Decision",
              "name": "Budget Evaluation",
              "order": 3
            }
          ]
        }
      ]
    }
  ]
}
```

### LLM Behavior Fixes

The following changes have been made to prevent incorrect view creation:

1. **Enhanced database prompt** with clear step type clarifications
2. **Updated createView tool description** to emphasize only "Collect information" steps need views
3. **Added validation in createView** to prevent creating views for wrong step types
4. **Added validation in updateCase** to warn about incorrect viewId usage
5. **Added step type usage examples** to guide the LLM

These changes should prevent the LLM from:

- Creating views for non-"Collect information" steps
- Using invalid step types like "Review"
- Adding viewId to steps that don't need it
