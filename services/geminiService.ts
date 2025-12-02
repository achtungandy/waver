import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY is missing");
  return new GoogleGenAI({ apiKey });
};

export const generateVideoMetadata = async (title: string, subtitle: string) => {
  try {
    const ai = getAiClient();
    const model = 'gemini-2.5-flash';

    const prompt = `
      I have created a music video with the title "${title}" and subtitle "${subtitle}".
      Generate a catchy YouTube video description and a list of 5 relevant hashtags.
      Return the response in JSON format.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            hashtags: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Metadata Error:", error);
    return {
      description: `Check out my new video: ${title}!`,
      hashtags: ["#musicvideo", "#newupload"]
    };
  }
};

export const analyzeMoodAndSuggestFont = async (audioFileName: string) => {
  // In a real scenario with backend, we would upload the audio bytes.
  // Here, we simulate analysis based on filename context to save bandwidth/complexity in this demo.
  try {
    const ai = getAiClient();
    const model = 'gemini-2.5-flash';

    const prompt = `
      Suggest a font style ('sans', 'serif', or 'mono') and a short 3-word subtitle 
      for a music video based on this audio filename: "${audioFileName}".
      Return JSON.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            font: { type: Type.STRING },
            suggestedSubtitle: { type: Type.STRING }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return { font: 'sans', suggestedSubtitle: 'Music & Vibes' };
  }
};
