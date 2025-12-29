
import { GoogleGenAI } from "@google/genai";

export async function removeObject(originalBase64: string, maskBase64: string): Promise<string> {
  // Check if API key exists to prevent silent failures
  if (!process.env.API_KEY || process.env.API_KEY === 'undefined') {
    throw new Error("API Key not found in environment. Please add API_KEY to Netlify environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const cleanOriginal = originalBase64.split(',')[1];
  const cleanMask = maskBase64.split(',')[1];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `High-Fidelity Image Inpainting Task:
1. You are provided with an 'Original Image' and a 'Binary Selection Mask'.
2. The WHITE pixels in the mask indicate the exact object to be removed.
3. Your goal: Remove the object and fill the gap by intelligently synthesizing the surrounding texture, lighting, and patterns.
4. The result must be photorealistic and completely seamless.
5. Crucial: Do not add any new objects, watermarks, or text.
6. Output ONLY the processed image data.`,
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

    // Check if the generation was stopped by safety filters
    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new Error("The AI blocked this request because it triggered safety filters. Try removing a different object or using a different image.");
    }

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("The AI returned an empty response. This can happen if the mask is too complex or the server is busy.");
    }

    // Find the image part in the response
    const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
    
    if (imagePart?.inlineData?.data) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }

    // Use the .text property to see if the AI returned a text-based error/explanation
    const textOutput = response.text;
    if (textOutput) {
      throw new Error(`AI feedback: ${textOutput}`);
    }

    throw new Error("No image was generated. Please try making your mask selection more precise.");
  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    
    // Format common API errors for better user understanding
    if (error.status === 401 || error.message?.includes("401")) {
      throw new Error("Invalid API Key. Please check your credentials.");
    }
    if (error.status === 429 || error.message?.includes("429")) {
      throw new Error("Too many requests. Please wait a minute and try again.");
    }
    
    throw error;
  }
}
