
import { GoogleGenAI } from "@google/genai";

export async function removeObject(originalBase64: string, maskBase64: string): Promise<string> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please ensure your environment is configured correctly.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Extract just the base64 data without the data:image/... prefix
  const cleanOriginal = originalBase64.split(',')[1];
  const cleanMask = maskBase64.split(',')[1];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Object Removal Task:
1. Look at the 'Original Photo'.
2. Look at the 'Binary Mask'.
3. The WHITE area in the mask marks the object that must be removed.
4. Replace the object in the WHITE area with a background that matches the surrounding environment perfectly (inpainting).
5. Do not modify any pixels outside of the masked area.
6. Return only the final modified image.`,
          },
          {
            inlineData: {
              data: cleanOriginal,
              mimeType: 'image/png',
            },
          },
          {
            inlineData: {
              data: cleanMask,
              mimeType: 'image/png',
            },
          },
        ],
      },
    });

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("The AI failed to generate a result. Try a larger or more specific selection.");
    }

    const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
    
    if (imagePart?.inlineData?.data) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }

    const textPart = response.candidates[0].content.parts.find(p => p.text);
    if (textPart?.text) {
      throw new Error(`AI was unable to process: ${textPart.text}`);
    }

    throw new Error("No image was returned. Please try again.");
  } catch (error: any) {
    console.error("Gemini Inpainting Error:", error);
    if (error.message?.includes("safety")) {
      throw new Error("The content was blocked by safety filters. Try a different image.");
    }
    throw new Error(error?.message || "Object removal failed.");
  }
}
