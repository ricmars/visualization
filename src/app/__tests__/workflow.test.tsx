import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkflowPage } from "../workflow/[id]/page";
import { DB_TABLES } from "../lib/db";

// Mock fetch for database operations
global.fetch = jest.fn();

describe("Workflow Operations", () => {
  const mockCase = {
    id: 1,
    name: "Test Workflow",
    description: "Test Description",
    model: JSON.stringify({
      name: "Test Workflow",
      description: "Test Description",
      fields: [],
      stages: [
        {
          id: "stage1",
          name: "Stage 1",
          order: 1,
          processes: [
            {
              id: "process1_1",
              name: "Process 1",
              order: 1,
              steps: [
                {
                  id: "step1_1_1",
                  name: "Step 1",
                  type: "Collect information",
                  order: 1,
                  viewId: "1",
                },
              ],
            },
          ],
        },
      ],
      views: [],
    }),
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock successful fetch responses
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes("/api/database")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockCase }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  describe("Stage Operations", () => {
    it("should delete a stage", async () => {
      render(<WorkflowPage params={{ id: "1" }} />);

      // Wait for the workflow to load
      await waitFor(() => {
        expect(screen.getByText("Stage 1")).toBeInTheDocument();
      });

      // Find and click the delete button for Stage 1
      const deleteButton = screen.getByTestId("delete-stage-stage1");
      fireEvent.click(deleteButton);

      // Verify the PUT request was made with correct data
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(
            `/api/database?table=${DB_TABLES.CASES}&id=1`,
          ),
          expect.objectContaining({
            method: "PUT",
            body: expect.stringContaining('"stages":[]'),
          }),
        );
      });
    });

    it("should add a new stage", async () => {
      render(<WorkflowPage params={{ id: "1" }} />);

      // Wait for the workflow to load
      await waitFor(() => {
        expect(screen.getByText("Stage 1")).toBeInTheDocument();
      });

      // Find and click the add stage button
      const addButton = screen.getByTestId("add-stage");
      fireEvent.click(addButton);

      // Fill in the stage name
      const nameInput = screen.getByLabelText("Stage Name");
      fireEvent.change(nameInput, { target: { value: "New Stage" } });

      // Submit the form
      const submitButton = screen.getByText("Add Stage");
      fireEvent.click(submitButton);

      // Verify the PUT request was made with correct data
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(
            `/api/database?table=${DB_TABLES.CASES}&id=1`,
          ),
          expect.objectContaining({
            method: "PUT",
            body: expect.stringContaining('"name":"New Stage"'),
          }),
        );
      });
    });
  });

  describe("Process Operations", () => {
    it("should delete a process", async () => {
      render(<WorkflowPage params={{ id: "1" }} />);

      // Wait for the workflow to load
      await waitFor(() => {
        expect(screen.getByText("Process 1")).toBeInTheDocument();
      });

      // Find and click the delete button for Process 1
      const deleteButton = screen.getByTestId("delete-process-process1_1");
      fireEvent.click(deleteButton);

      // Verify the PUT request was made with correct data
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(
            `/api/database?table=${DB_TABLES.CASES}&id=1`,
          ),
          expect.objectContaining({
            method: "PUT",
            body: expect.stringContaining('"processes":[]'),
          }),
        );
      });
    });

    it("should add a new process", async () => {
      render(<WorkflowPage params={{ id: "1" }} />);

      // Wait for the workflow to load
      await waitFor(() => {
        expect(screen.getByText("Process 1")).toBeInTheDocument();
      });

      // Find and click the add process button
      const addButton = screen.getByTestId("add-process-stage1");
      fireEvent.click(addButton);

      // Fill in the process name
      const nameInput = screen.getByLabelText("Process Name");
      fireEvent.change(nameInput, { target: { value: "New Process" } });

      // Submit the form
      const submitButton = screen.getByText("Add Process");
      fireEvent.click(submitButton);

      // Verify the PUT request was made with correct data
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(
            `/api/database?table=${DB_TABLES.CASES}&id=1`,
          ),
          expect.objectContaining({
            method: "PUT",
            body: expect.stringContaining('"name":"New Process"'),
          }),
        );
      });
    });
  });

  describe("Step Operations", () => {
    it("should delete a step", async () => {
      render(<WorkflowPage params={{ id: "1" }} />);

      // Wait for the workflow to load
      await waitFor(() => {
        expect(screen.getByText("Step 1")).toBeInTheDocument();
      });

      // Find and click the delete button for Step 1
      const deleteButton = screen.getByTestId("delete-step-step1_1_1");
      fireEvent.click(deleteButton);

      // Verify the PUT request was made with correct data
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(
            `/api/database?table=${DB_TABLES.CASES}&id=1`,
          ),
          expect.objectContaining({
            method: "PUT",
            body: expect.stringContaining('"steps":[]'),
          }),
        );
      });
    });

    it("should add a new step", async () => {
      render(<WorkflowPage params={{ id: "1" }} />);

      // Wait for the workflow to load
      await waitFor(() => {
        expect(screen.getByText("Step 1")).toBeInTheDocument();
      });

      // Find and click the add step button
      const addButton = screen.getByTestId("add-step-process1_1");
      fireEvent.click(addButton);

      // Fill in the step details
      const nameInput = screen.getByLabelText("Step Name");
      fireEvent.change(nameInput, { target: { value: "New Step" } });

      const typeSelect = screen.getByLabelText("Step Type");
      fireEvent.change(typeSelect, {
        target: { value: "Collect information" },
      });

      // Submit the form
      const submitButton = screen.getByText("Add Step");
      fireEvent.click(submitButton);

      // Verify the PUT request was made with correct data
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(
            `/api/database?table=${DB_TABLES.CASES}&id=1`,
          ),
          expect.objectContaining({
            method: "PUT",
            body: expect.stringContaining('"name":"New Step"'),
          }),
        );
      });
    });
  });
});
