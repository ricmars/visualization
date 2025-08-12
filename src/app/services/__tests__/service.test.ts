import { Service } from "../service";

describe("Service provider selection", () => {
  beforeEach(() => {
    // Reset provider to default before each test
    Service.setProvider("openai");
  });

  it("should default to openai provider", () => {
    expect(Service.getProvider()).toBe("openai");
  });

  it("should set provider to openai", () => {
    Service.setProvider("openai");
    expect(Service.getProvider()).toBe("openai");
  });

  it("should call the correct API in generateResponse", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });

    await Service.generateResponse("prompt", "context", []);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/openai",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
