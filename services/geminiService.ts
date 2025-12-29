
import { GoogleGenAI } from "@google/genai";

/**
 * Utility function to wait for a specific amount of time.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes an AI task with exponential backoff for rate limits (429).
 */
async function callWithRetry(fn: () => Promise<any>, maxRetries = 3) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error.status === 429 || error.message?.includes("429") || error.message?.includes("Too many requests");
      
      if (isRateLimit && i < maxRetries - 1) {
        // Exponential backoff: 2s, 4s, 8s...
        const waitTime = Math.pow(2, i + 1) * 1000;
        console.warn(`Rate limit hit. Retrying in ${waitTime}ms (Attempt ${i + 1}/${maxRetries})...`);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function removeObject(originalBase64: string, maskBase64: string): Promise<string> {
  // Check if API key exists to prevent silent failures
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined') {
    throw new Error("API Key not found. Please add API_KEY to your Netlify Site Settings > Environment Variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const cleanOriginal = originalBase64.split(',')[1];
  const cleanMask = maskBase64.split(',')[1];

  try {
    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
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
    });

    // Check if the generation was stopped by safety filters
    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new Error("The AI blocked this request due to safety filters. This can happen if the image is misinterpreted as sensitive content. Try a different image or selection.");
    }

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("The AI returned an empty response. The image might be too complex for the current model.");
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

    throw new Error("No image was generated. Try making your mask selection tighter around the object.");
  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    
    // Format common API errors for better user understanding
    if (error.status === 401 || error.message?.includes("401")) {
      throw new Error("Invalid API Key. Please double-check your API_KEY in Netlify settings.");
    }
    
    if (error.status === 429 || error.message?.includes("429") || error.message?.includes("Too many requests")) {
      throw new Error("Rate limit exceeded (Too many requests). If you are using a Free Tier key, Google restricts how many images you can process per minute. Please wait 60 seconds and try again.");
    }

    if (error.message?.includes("fetch")) {
      throw new Error("Network error. Please check your internet connection and try again.");
    }
    
    throw error;
  }
}
