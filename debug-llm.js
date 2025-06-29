#!/usr/bin/env node

/**
 * Debug script for LLM workflow testing
 * Usage: node debug-llm.js [action] [params...]
 */

const fetch = require("node-fetch");

const BASE_URL = "http://localhost:3000";

async function makeRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
    throw error;
  }
}

async function testLLMWorkflow() {
  console.log("=== Testing LLM Workflow ===");

  try {
    // Test 1: Check database state
    console.log("\n1. Checking database state...");
    const stats = await makeRequest("/api/debug?action=stats");
    console.log("Database stats:", stats.data);

    // Test 2: List all cases
    console.log("\n2. Listing all cases...");
    const cases = await makeRequest("/api/debug?action=cases");
    console.log(
      `Found ${cases.data.count} cases:`,
      cases.data.cases.map((c) => ({ id: c.id, name: c.name })),
    );

    // Test 3: Test LLM with a simple prompt
    console.log("\n3. Testing LLM with simple prompt...");
    const llmResponse = await makeRequest("/api/openai", {
      method: "POST",
      body: JSON.stringify({
        prompt:
          'Create a simple kitchen renovation workflow with name "Kitchen Test" and description "A test workflow for kitchen renovation"',
        systemContext: null,
      }),
    });

    console.log("LLM response received");

    // Test 4: Check database state after LLM call
    console.log("\n4. Checking database state after LLM call...");
    const statsAfter = await makeRequest("/api/debug?action=stats");
    console.log("Database stats after LLM:", statsAfter.data);

    // Test 5: List cases again
    console.log("\n5. Listing cases after LLM call...");
    const casesAfter = await makeRequest("/api/debug?action=cases");
    console.log(
      `Found ${casesAfter.data.count} cases after LLM:`,
      casesAfter.data.cases.map((c) => ({ id: c.id, name: c.name })),
    );

    // If a new case was created, show its details
    if (casesAfter.data.count > cases.data.count) {
      const newCase = casesAfter.data.cases[0]; // Most recent case
      console.log("\n6. New case details:");
      const caseDetails = await makeRequest(
        `/api/debug?action=case&id=${newCase.id}`,
      );
      console.log("Case details:", {
        id: caseDetails.data.case.id,
        name: caseDetails.data.case.name,
        summary: caseDetails.data.summary,
      });
    }
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

async function testExistingWorkflow(caseId) {
  console.log(`=== Testing Existing Workflow (Case ID: ${caseId}) ===`);

  try {
    // Test 1: Get case details
    console.log("\n1. Getting case details...");
    const caseDetails = await makeRequest(
      `/api/debug?action=case&id=${caseId}`,
    );
    console.log("Case details:", {
      id: caseDetails.data.case.id,
      name: caseDetails.data.case.name,
      summary: caseDetails.data.summary,
    });

    // Test 2: Test LLM modification
    console.log("\n2. Testing LLM modification...");
    const llmResponse = await makeRequest("/api/openai", {
      method: "POST",
      body: JSON.stringify({
        prompt: 'Add a new field called "budget" to this workflow',
        systemContext: JSON.stringify({
          currentCaseId: parseInt(caseId),
          name: caseDetails.data.case.name,
          stages: caseDetails.data.model.stages,
        }),
      }),
    });

    console.log("LLM modification response received");

    // Test 3: Check updated case details
    console.log("\n3. Checking updated case details...");
    const updatedCaseDetails = await makeRequest(
      `/api/debug?action=case&id=${caseId}`,
    );
    console.log("Updated case details:", {
      id: updatedCaseDetails.data.case.id,
      name: updatedCaseDetails.data.case.name,
      summary: updatedCaseDetails.data.summary,
    });
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

async function showHelp() {
  console.log(`
Debug LLM Workflow Script

Usage:
  node debug-llm.js [action] [params...]

Actions:
  test-new          Test creating a new workflow
  test-existing <id> Test modifying an existing workflow
  stats             Show database statistics
  cases             List all cases
  case <id>         Show details for a specific case
  fields            List all fields
  views             List all views

Examples:
  node debug-llm.js test-new
  node debug-llm.js test-existing 123
  node debug-llm.js stats
  node debug-llm.js case 123
`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  if (!action || action === "help" || action === "--help" || action === "-h") {
    await showHelp();
    return;
  }

  try {
    switch (action) {
      case "test-new":
        await testLLMWorkflow();
        break;
      case "test-existing":
        const caseId = args[1];
        if (!caseId) {
          console.error("Error: Case ID required for test-existing");
          return;
        }
        await testExistingWorkflow(caseId);
        break;
      case "stats":
        const stats = await makeRequest("/api/debug?action=stats");
        console.log("Database stats:", stats.data);
        break;
      case "cases":
        const cases = await makeRequest("/api/debug?action=cases");
        console.log("Cases:", cases.data);
        break;
      case "case":
        const id = args[1];
        if (!id) {
          console.error("Error: Case ID required");
          return;
        }
        const caseDetails = await makeRequest(
          `/api/debug?action=case&id=${id}`,
        );
        console.log("Case details:", caseDetails.data);
        break;
      case "fields":
        const fields = await makeRequest("/api/debug?action=fields");
        console.log("Fields:", fields.data);
        break;
      case "views":
        const views = await makeRequest("/api/debug?action=views");
        console.log("Views:", views.data);
        break;
      default:
        console.error(`Unknown action: ${action}`);
        await showHelp();
    }
  } catch (error) {
    console.error("Script failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { makeRequest, testLLMWorkflow, testExistingWorkflow };
