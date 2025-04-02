import { NextResponse } from 'next/server';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';
const GEMINI_MODEL = 'gemini-2.0-flash-001';

export async function POST(request: Request) {
  try {
    const { prompt, systemContext } = await request.json();

    const response = await fetch(
      `${GEMINI_BASE_URL}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{
                text: `${systemContext}\n\nUser request: ${prompt}\n\nIMPORTANT: Respond ONLY with a JSON object. Do not include any markdown formatting, code blocks, or explanatory text. The JSON response must exactly match the format specified above.`
              }]
            }
          ]
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Gemini API error (${response.status}): ${JSON.stringify(errorData) || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response format from Gemini API');
    }

    let text = data.candidates[0].content.parts[0].text.trim();

    // Remove any markdown code block formatting
    if (text.startsWith('```')) {
      const matches = text.match(/```(?:json)?\n?([\s\S]*?)\n?```$/);
      if (matches) {
        text = matches[1].trim();
      }
    }

    try {
      const parsed = JSON.parse(text);
      
      if (!parsed.model || (!parsed.model.stages && !parsed.model.fields)) {
        throw new Error('Response missing required model data');
      }

      const validatedResponse = {
        message: parsed.message || '',
        model: {
          stages: Array.isArray(parsed.model.stages) ? parsed.model.stages : [],
          fields: Array.isArray(parsed.model.fields) ? parsed.model.fields : []
        },
        action: parsed.action || { changes: [] },
        visualization: parsed.visualization || {
          totalStages: parsed.model.stages?.length || 0,
          stageBreakdown: []
        }
      };

      return NextResponse.json(validatedResponse);
    } catch (e) {
      throw new Error('Invalid or malformed JSON in Gemini response');
    }
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 