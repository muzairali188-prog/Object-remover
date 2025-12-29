
import { GoogleGenAI } from "@google/genai";

/**
 * Utility function to wait for a specific amount of time.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Resizes a base64 image to a maximum dimension while maintaining aspect ratio.
 * This reduces the payload size sent to Gemini, which helps prevent 429 Rate Limit errors.
 */
async function optimizeImage(base64: string, maxDim: number = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > height) {
        if (width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("Canvas context failure");
      
      ctx.drawImage(img, 0, 0, width, height);
      // Return just the base64 data part
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = () => reject("Failed to load image for optimization");
    img.src = base64;
  });
}

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
      const errorMsg = error.message || "";
      const isRateLimit = error.status === 429 || errorMsg.includes("429") || errorMsg.includes("Too many requests");
      
      if (isRateLimit && i < maxRetries - 1) {
        // First retry after 8s, second after 20s. 
        // Free tier resets are usually 60s windows, so we space them out.
        const waitTime = i === 0 ? 8000 : 20000;
        console.warn(`Rate limit hit. Retrying in ${waitTime/1000}s (Attempt ${i + 1}/${maxRetries})...`);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function removeObject(originalBase64: string, maskBase64: string): Promise<string> {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined') {
    throw new Error("API Key not found. Please check your Netlify environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    // Optimize images before sending to stay within free tier 'cost' limits
    const [optimizedOriginal, optimizedMask] = await Promise.all([
      optimizeImage(originalBase64, 1024),
      optimizeImage(maskBase64, 1024)
    ]);

    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: "Task: Remove object in the WHITE mask area. Fill background seamlessly. Output ONLY the resulting image.",
            },
            {
              inlineData: {
                data: optimizedOriginal,
                mimeType: 'image/png',
              },
            },
            {
              inlineData: {
                data: optimizedMask,
                mimeType: 'image/png',
              },
            },
          ],
        },
      });
    });

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new Error("Safety filter blocked this request. Try a different image or selection.");
    }

    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    
    if (imagePart?.inlineData?.data) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }

    throw new Error("The AI failed to generate the image. Try a smaller selection.");
  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    
    const errorMsg = error.message || "";
    if (error.status === 429 || errorMsg.includes("429") || errorMsg.includes("Too many requests")) {
      throw new Error("Rate limit exceeded. The Free Tier has a strict limit on how many images can be processed per minute. Please wait for the cooldown timer.");
    }

    throw error;
  }
}
