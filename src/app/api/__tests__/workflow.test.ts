// import { NextRequest } from "next/server";

// Initial model for the mock case
const initialModel = {
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
              order: 1,
              type: "Collect information",
              viewId: "1",
            },
          ],
        },
      ],
    },
  ],
};

let currentModel = JSON.parse(JSON.stringify(initialModel));

const mockCase = {
  id: 1,
  name: "Test Case",
  description: "Test Description",
  get model() {
    return JSON.stringify(currentModel);
  },
};

// Mock fetch for database operations
(global.fetch as jest.Mock) = jest.fn(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url.includes("/api/database")) {
      const params = new URLSearchParams(url.split("?")[1]);
      const table = params.get("table");

      // Simulate DELETE for stages, processes, steps by updating currentModel
      if (init?.method === "DELETE") {
        // For this mock, just clear all stages
        if (table === "cases") {
          currentModel.stages = [];
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockCase }),
          });
        }
      }

      if (init?.method === "PUT") {
        // For update operations, update the in-memory model
        const body = JSON.parse(init.body as string);
        const updatedModel = JSON.parse(body.data.model);
        currentModel = updatedModel;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockCase }),
        });
      }

      // For GET operations, return the current model
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockCase }),
      });
    }
    return Promise.reject(new Error("Not found"));
  },
);

describe("Workflow Operations", () => {
  afterEach(() => {
    // Reset the in-memory model after each test
    currentModel = JSON.parse(JSON.stringify(initialModel));
  });

  describe("Stage Operations", () => {
    it("should delete a stage", async () => {
      // Remove all stages from the model
      const updatedModel = { ...currentModel, stages: [] };
      const response = await fetch("/api/database?table=cases&id=1", {
        method: "PUT",
        body: JSON.stringify({
          table: "cases",
          data: {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: JSON.stringify(updatedModel),
          },
        }),
      });
      expect(response.ok).toBe(true);
      const { data } = await response.json();
      expect(JSON.parse(data.model).stages).toHaveLength(0);
    });

    it("should add a new stage", async () => {
      // Add a new stage to the model
      const newStage = {
        id: "stage2",
        name: "Stage 2",
        order: 2,
        processes: [],
      };
      const updatedModel = {
        ...currentModel,
        stages: [...currentModel.stages, newStage],
      };
      const response = await fetch("/api/database?table=cases&id=1", {
        method: "PUT",
        body: JSON.stringify({
          table: "cases",
          data: {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: JSON.stringify(updatedModel),
          },
        }),
      });
      expect(response.ok).toBe(true);
      const { data } = await response.json();
      expect(JSON.parse(data.model).stages).toHaveLength(2);
    });
  });

  describe("Process Operations", () => {
    it("should delete a process", async () => {
      // Remove all processes from the first stage
      const updatedStages = currentModel.stages.map((stage: any, i: number) =>
        i === 0 ? { ...stage, processes: [] } : stage,
      );
      const updatedModel = { ...currentModel, stages: updatedStages };
      const response = await fetch("/api/database?table=cases&id=1", {
        method: "PUT",
        body: JSON.stringify({
          table: "cases",
          data: {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: JSON.stringify(updatedModel),
          },
        }),
      });
      expect(response.ok).toBe(true);
      const { data } = await response.json();
      expect(JSON.parse(data.model).stages[0].processes).toHaveLength(0);
    });

    it("should add a new process", async () => {
      // Add a new process to the first stage
      const newProcess = {
        id: "process1_2",
        name: "Process 2",
        order: 2,
        steps: [],
      };
      const updatedStages = currentModel.stages.map((stage: any, i: number) =>
        i === 0
          ? { ...stage, processes: [...stage.processes, newProcess] }
          : stage,
      );
      const updatedModel = { ...currentModel, stages: updatedStages };
      const response = await fetch("/api/database?table=cases&id=1", {
        method: "PUT",
        body: JSON.stringify({
          table: "cases",
          data: {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: JSON.stringify(updatedModel),
          },
        }),
      });
      expect(response.ok).toBe(true);
      const { data } = await response.json();
      expect(JSON.parse(data.model).stages[0].processes).toHaveLength(2);
    });
  });

  describe("Step Operations", () => {
    it("should delete a step", async () => {
      // Remove all steps from the first process of the first stage
      const updatedStages = currentModel.stages.map((stage: any, i: number) =>
        i === 0
          ? {
              ...stage,
              processes: stage.processes.map((process: any, j: number) =>
                j === 0 ? { ...process, steps: [] } : process,
              ),
            }
          : stage,
      );
      const updatedModel = { ...currentModel, stages: updatedStages };
      const response = await fetch("/api/database?table=cases&id=1", {
        method: "PUT",
        body: JSON.stringify({
          table: "cases",
          data: {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: JSON.stringify(updatedModel),
          },
        }),
      });
      expect(response.ok).toBe(true);
      const { data } = await response.json();
      expect(JSON.parse(data.model).stages[0].processes[0].steps).toHaveLength(
        0,
      );
    });

    it("should add a new step", async () => {
      // Add a new step to the first process of the first stage
      const newStep = {
        id: "step1_1_2",
        name: "Step 2",
        order: 2,
        type: "Collect information",
        viewId: "2",
      };
      const updatedStages = currentModel.stages.map((stage: any, i: number) =>
        i === 0
          ? {
              ...stage,
              processes: stage.processes.map((process: any, j: number) =>
                j === 0
                  ? { ...process, steps: [...process.steps, newStep] }
                  : process,
              ),
            }
          : stage,
      );
      const updatedModel = { ...currentModel, stages: updatedStages };
      const response = await fetch("/api/database?table=cases&id=1", {
        method: "PUT",
        body: JSON.stringify({
          table: "cases",
          data: {
            id: 1,
            name: "Test Case",
            description: "Test Description",
            model: JSON.stringify(updatedModel),
          },
        }),
      });
      expect(response.ok).toBe(true);
      const { data } = await response.json();
      expect(JSON.parse(data.model).stages[0].processes[0].steps).toHaveLength(
        2,
      );
    });
  });
});
