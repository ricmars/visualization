// Kitchen Remodeling Workflow Fix Script
// This script creates a proper workflow structure reusing existing fields

const workflowStructure = {
  name: "Kitchen remodeling",
  description: "Workflow for managing kitchen remodeling process",
  model: {
    stages: [
      {
        id: 1,
        name: "Planning",
        order: 1,
        processes: [
          {
            id: 1,
            name: "Initial Assessment",
            order: 1,
            steps: [
              {
                id: 1,
                name: "Client Consultation",
                type: "Collect information",
                order: 1,
                fields: [
                  { name: "Client Name", required: true, order: 1 },
                  { name: "Contact Information", required: true, order: 2 },
                  { name: "Project Address", required: true, order: 3 },
                  { name: "Budget Range", required: true, order: 4 },
                  { name: "Timeline", required: true, order: 5 },
                ],
              },
              {
                id: 2,
                name: "Space Measurement",
                type: "Collect information",
                order: 2,
                fields: [
                  { name: "Kitchen Dimensions", required: true, order: 1 },
                  { name: "Ceiling Height", required: true, order: 2 },
                  { name: "Window Locations", required: false, order: 3 },
                  { name: "Door Locations", required: false, order: 4 },
                  { name: "Electrical Outlets", required: false, order: 5 },
                ],
              },
              {
                id: 3,
                name: "Requirements Gathering",
                type: "Collect information",
                order: 3,
                fields: [
                  { name: "Style Preference", required: true, order: 1 },
                  { name: "Color Scheme", required: true, order: 2 },
                  { name: "Must-Have Features", required: false, order: 3 },
                  { name: "Nice-to-Have Features", required: false, order: 4 },
                  { name: "Special Requirements", required: false, order: 5 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 2,
        name: "Design",
        order: 2,
        processes: [
          {
            id: 2,
            name: "Design Development",
            order: 1,
            steps: [
              {
                id: 4,
                name: "Layout Planning",
                type: "Collect information",
                order: 1,
                fields: [
                  { name: "Cabinet Layout", required: true, order: 1 },
                  { name: "Appliance Placement", required: true, order: 2 },
                  { name: "Work Triangle", required: true, order: 3 },
                  { name: "Storage Solutions", required: false, order: 4 },
                ],
              },
              {
                id: 5,
                name: "Material Selection",
                type: "Collect information",
                order: 2,
                fields: [
                  { name: "Cabinet Style", required: true, order: 1 },
                  { name: "Countertop Material", required: true, order: 2 },
                  { name: "Backsplash Material", required: true, order: 3 },
                  { name: "Flooring Material", required: true, order: 4 },
                  { name: "Hardware Style", required: false, order: 5 },
                ],
              },
              {
                id: 6,
                name: "Appliance Selection",
                type: "Collect information",
                order: 3,
                fields: [
                  { name: "Refrigerator Model", required: true, order: 1 },
                  { name: "Range/Oven Model", required: true, order: 2 },
                  { name: "Dishwasher Model", required: true, order: 3 },
                  { name: "Microwave Model", required: false, order: 4 },
                  { name: "Additional Appliances", required: false, order: 5 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 3,
        name: "Construction",
        order: 3,
        processes: [
          {
            id: 3,
            name: "Project Execution",
            order: 1,
            steps: [
              {
                id: 7,
                name: "Demolition",
                type: "Collect information",
                order: 1,
                fields: [
                  { name: "Demolition Date", required: true, order: 1 },
                  { name: "Waste Removal", required: true, order: 2 },
                  { name: "Structural Issues", required: false, order: 3 },
                  { name: "Demolition Notes", required: false, order: 4 },
                ],
              },
              {
                id: 8,
                name: "Electrical & Plumbing",
                type: "Collect information",
                order: 2,
                fields: [
                  { name: "Electrical Work", required: true, order: 1 },
                  { name: "Plumbing Work", required: true, order: 2 },
                  { name: "HVAC Modifications", required: false, order: 3 },
                  { name: "Inspection Results", required: true, order: 4 },
                ],
              },
              {
                id: 9,
                name: "Installation",
                type: "Collect information",
                order: 3,
                fields: [
                  { name: "Cabinet Installation", required: true, order: 1 },
                  { name: "Countertop Installation", required: true, order: 2 },
                  { name: "Appliance Installation", required: true, order: 3 },
                  { name: "Backsplash Installation", required: true, order: 4 },
                  { name: "Flooring Installation", required: true, order: 5 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 4,
        name: "Completion",
        order: 4,
        processes: [
          {
            id: 4,
            name: "Final Steps",
            order: 1,
            steps: [
              {
                id: 10,
                name: "Final Inspection",
                type: "Collect information",
                order: 1,
                fields: [
                  { name: "Quality Check", required: true, order: 1 },
                  { name: "Functionality Test", required: true, order: 2 },
                  { name: "Safety Inspection", required: true, order: 3 },
                  { name: "Punch List", required: false, order: 4 },
                ],
              },
              {
                id: 11,
                name: "Client Walkthrough",
                type: "Collect information",
                order: 2,
                fields: [
                  { name: "Client Satisfaction", required: true, order: 1 },
                  { name: "Final Approval", required: true, order: 2 },
                  { name: "Warranty Information", required: true, order: 3 },
                  { name: "Care Instructions", required: true, order: 4 },
                ],
              },
              {
                id: 12,
                name: "Project Closeout",
                type: "Collect information",
                order: 3,
                fields: [
                  { name: "Final Payment", required: true, order: 1 },
                  { name: "Project Photos", required: true, order: 2 },
                  { name: "Client Feedback", required: false, order: 3 },
                  { name: "Follow-up Schedule", required: true, order: 4 },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

// Field definitions that need to be created (only if they don't exist)
const requiredFields = [
  // Planning Stage Fields
  {
    name: "Client Name",
    type: "Text",
    label: "Client Name",
    required: true,
    primary: true,
  },
  {
    name: "Contact Information",
    type: "Text",
    label: "Contact Information",
    required: true,
  },
  {
    name: "Project Address",
    type: "Text",
    label: "Project Address",
    required: true,
  },
  {
    name: "Budget Range",
    type: "Dropdown",
    label: "Budget Range",
    required: true,
    options: ["$10k-$25k", "$25k-$50k", "$50k-$100k", "$100k+"],
  },
  {
    name: "Timeline",
    type: "Dropdown",
    label: "Timeline",
    required: true,
    options: ["1-2 months", "3-4 months", "5-6 months", "6+ months"],
  },
  {
    name: "Kitchen Dimensions",
    type: "Text",
    label: "Kitchen Dimensions",
    required: true,
  },
  {
    name: "Ceiling Height",
    type: "Number",
    label: "Ceiling Height (ft)",
    required: true,
  },
  {
    name: "Window Locations",
    type: "Text",
    label: "Window Locations",
    required: false,
  },
  {
    name: "Door Locations",
    type: "Text",
    label: "Door Locations",
    required: false,
  },
  {
    name: "Electrical Outlets",
    type: "Text",
    label: "Electrical Outlets",
    required: false,
  },
  {
    name: "Style Preference",
    type: "Dropdown",
    label: "Style Preference",
    required: true,
    options: ["Modern", "Traditional", "Contemporary", "Rustic", "Minimalist"],
  },
  { name: "Color Scheme", type: "Text", label: "Color Scheme", required: true },
  {
    name: "Must-Have Features",
    type: "TextArea",
    label: "Must-Have Features",
    required: false,
  },
  {
    name: "Nice-to-Have Features",
    type: "TextArea",
    label: "Nice-to-Have Features",
    required: false,
  },
  {
    name: "Special Requirements",
    type: "TextArea",
    label: "Special Requirements",
    required: false,
  },

  // Design Stage Fields
  {
    name: "Cabinet Layout",
    type: "TextArea",
    label: "Cabinet Layout",
    required: true,
  },
  {
    name: "Appliance Placement",
    type: "TextArea",
    label: "Appliance Placement",
    required: true,
  },
  {
    name: "Work Triangle",
    type: "Text",
    label: "Work Triangle",
    required: true,
  },
  {
    name: "Storage Solutions",
    type: "TextArea",
    label: "Storage Solutions",
    required: false,
  },
  {
    name: "Backsplash Material",
    type: "Text",
    label: "Backsplash Material",
    required: true,
  },
  {
    name: "Flooring Material",
    type: "Text",
    label: "Flooring Material",
    required: true,
  },
  {
    name: "Hardware Style",
    type: "Text",
    label: "Hardware Style",
    required: false,
  },
  {
    name: "Refrigerator Model",
    type: "Text",
    label: "Refrigerator Model",
    required: true,
  },
  {
    name: "Range/Oven Model",
    type: "Text",
    label: "Range/Oven Model",
    required: true,
  },
  {
    name: "Dishwasher Model",
    type: "Text",
    label: "Dishwasher Model",
    required: true,
  },
  {
    name: "Microwave Model",
    type: "Text",
    label: "Microwave Model",
    required: false,
  },
  {
    name: "Additional Appliances",
    type: "TextArea",
    label: "Additional Appliances",
    required: false,
  },

  // Construction Stage Fields
  {
    name: "Demolition Date",
    type: "Date",
    label: "Demolition Date",
    required: true,
  },
  {
    name: "Waste Removal",
    type: "Text",
    label: "Waste Removal",
    required: true,
  },
  {
    name: "Structural Issues",
    type: "TextArea",
    label: "Structural Issues",
    required: false,
  },
  {
    name: "Demolition Notes",
    type: "TextArea",
    label: "Demolition Notes",
    required: false,
  },
  {
    name: "Electrical Work",
    type: "TextArea",
    label: "Electrical Work",
    required: true,
  },
  {
    name: "Plumbing Work",
    type: "TextArea",
    label: "Plumbing Work",
    required: true,
  },
  {
    name: "HVAC Modifications",
    type: "TextArea",
    label: "HVAC Modifications",
    required: false,
  },
  {
    name: "Inspection Results",
    type: "TextArea",
    label: "Inspection Results",
    required: true,
  },
  {
    name: "Cabinet Installation",
    type: "TextArea",
    label: "Cabinet Installation",
    required: true,
  },
  {
    name: "Countertop Installation",
    type: "TextArea",
    label: "Countertop Installation",
    required: true,
  },
  {
    name: "Appliance Installation",
    type: "TextArea",
    label: "Appliance Installation",
    required: true,
  },
  {
    name: "Backsplash Installation",
    type: "TextArea",
    label: "Backsplash Installation",
    required: true,
  },
  {
    name: "Flooring Installation",
    type: "TextArea",
    label: "Flooring Installation",
    required: true,
  },

  // Completion Stage Fields
  {
    name: "Quality Check",
    type: "TextArea",
    label: "Quality Check",
    required: true,
  },
  {
    name: "Functionality Test",
    type: "TextArea",
    label: "Functionality Test",
    required: true,
  },
  {
    name: "Safety Inspection",
    type: "TextArea",
    label: "Safety Inspection",
    required: true,
  },
  {
    name: "Punch List",
    type: "TextArea",
    label: "Punch List",
    required: false,
  },
  {
    name: "Client Satisfaction",
    type: "Dropdown",
    label: "Client Satisfaction",
    required: true,
    options: [
      "Very Satisfied",
      "Satisfied",
      "Neutral",
      "Dissatisfied",
      "Very Dissatisfied",
    ],
  },
  {
    name: "Final Approval",
    type: "Boolean",
    label: "Final Approval",
    required: true,
  },
  {
    name: "Warranty Information",
    type: "TextArea",
    label: "Warranty Information",
    required: true,
  },
  {
    name: "Care Instructions",
    type: "TextArea",
    label: "Care Instructions",
    required: true,
  },
  {
    name: "Final Payment",
    type: "Number",
    label: "Final Payment Amount",
    required: true,
  },
  {
    name: "Project Photos",
    type: "Text",
    label: "Project Photos",
    required: true,
  },
  {
    name: "Client Feedback",
    type: "TextArea",
    label: "Client Feedback",
    required: false,
  },
  {
    name: "Follow-up Schedule",
    type: "Date",
    label: "Follow-up Schedule",
    required: true,
  },
];

console.log("Kitchen Remodeling Workflow Structure:");
console.log(JSON.stringify(workflowStructure, null, 2));
console.log("\nRequired Fields:");
console.log(JSON.stringify(requiredFields, null, 2));
