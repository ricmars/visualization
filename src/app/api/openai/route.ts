import { NextResponse } from "next/server";

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

async function getAzureAccessToken() {
  const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const scope = "https://cognitiveservices.azure.com/.default";

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: AZURE_CLIENT_ID!,
      client_secret: AZURE_CLIENT_SECRET!,
      scope: scope,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to get Azure access token");
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: Request) {
  try {
    const { prompt, systemContext } = await request.json();

    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_DEPLOYMENT) {
      throw new Error("Azure OpenAI configuration is missing");
    }

    if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
      throw new Error("Azure AD configuration is missing");
    }

    // Get Azure AD access token
    const accessToken = await getAzureAccessToken();

    const response = await fetch(
      `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-02-15-preview`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: systemContext,
            },
            {
              role: "user",
              content: `${prompt}\n\nIMPORTANT: Respond ONLY with a JSON object. Do not include any markdown formatting, code blocks, or explanatory text. The JSON response must exactly match the format specified above.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `Azure OpenAI API error (${response.status}): ${
          JSON.stringify(errorData) || response.statusText
        }`,
      );
    }

    const data = await response.json();

    if (!data?.choices?.[0]?.message?.content) {
      throw new Error("Invalid response format from Azure OpenAI API");
    }

    let text = data.choices[0].message.content.trim();

    // Remove any markdown code block formatting
    if (text.startsWith("```")) {
      const matches = text.match(/```(?:json)?\n?([\s\S]*?)\n?```$/);
      if (matches) {
        text = matches[1].trim();
      }
    }

    try {
      const parsed = JSON.parse(text);

      if (!parsed.model || (!parsed.model.stages && !parsed.model.fields)) {
        throw new Error("Response missing required model data");
      }

      const validatedResponse = {
        message: parsed.message || "",
        model: {
          stages: Array.isArray(parsed.model.stages) ? parsed.model.stages : [],
          fields: Array.isArray(parsed.model.fields) ? parsed.model.fields : [],
        },
        action: parsed.action || { changes: [] },
        visualization: parsed.visualization || {
          totalStages: parsed.model.stages?.length || 0,
          stageBreakdown: [],
        },
      };

      return NextResponse.json(validatedResponse);
    } catch (error) {
      console.error("Invalid JSON:", error);
      throw new Error("Invalid or malformed JSON in Azure OpenAI response");
    }
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
