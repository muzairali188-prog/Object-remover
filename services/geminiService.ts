
import { GoogleGenAI } from "@google/genai";

/**
 * Utility function to wait for a specific amount of time.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Compresses and resizes a base64 image to be "lighter" for the Free Tier API.
 * 512px is the sweet spot for reliability on the Gemini Free Tier.
 */
async function optimizeImageForFreeTier(base64: string, maxDim: number = 512): Promise<{data: string, mime: string}> {
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
      
      // Use a white background for JPEGs if needed, though mostly we want transparency handled by the surgical stitching logic in App.tsx
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      // JPEG is much lighter for the 'Original' photo. Mask remains PNG for strict binary.
      const isMask = base64.length < 50000 && base64.includes('image/png'); 
      const mime = isMask ? 'image/png' : 'image/jpeg';
      const quality = isMask ? 1.0 : 0.8;
      
      const dataUrl = canvas.toDataURL(mime, quality);
      resolve({
        data: dataUrl.split(',')[1],
        mime: mime
      });
    };
    img.onerror = () => reject("Failed to load image");
    img.src = base64;
  });
}

/**
 * Executes an AI task with aggressive backoff and jitter for Free Tier limits.
 */
async function callWithRetry(fn: () => Promise<any>, maxRetries = 2) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || "";
      const isRateLimit = error.status === 429 || errorMsg.includes("429") || errorMsg.includes("Too many requests");
      
      if (isRateLimit && i < maxRetries - 1) {
        // Add random jitter (1-3 seconds) to prevent "thundering herd"
        const jitter = Math.random() * 2000;
        const waitTime = (i === 0 ? 10000 : 25000) + jitter;
        console.warn(`Free Tier busy. Jittered retry in ${Math.round(waitTime/1000)}s...`);
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
    throw new Error("API Key missing. Add it to your Netlify Environment Variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    // 512px is significantly more reliable for the Free Tier
    const [optOrig, optMask] = await Promise.all([
      optimizeImageForFreeTier(originalBase64, 512),
      optimizeImageForFreeTier(maskBase64, 512)
    ]);

    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: "Remove the object in the white area. Fill background naturally. Result only." },
            { inlineData: { data: optOrig.data, mimeType: optOrig.mime } },
            { inlineData: { data: optMask.data, mimeType: optMask.mime } },
          ],
        },
      });
    });

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new Error("The AI safety filter blocked this content.");
    }

    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imagePart?.inlineData?.data) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }

    throw new Error("No output generated. Try a smaller brush.");
  } catch (error: any) {
    const msg = error.message || "";
    if (error.status === 429 || msg.includes("429") || msg.includes("Too many requests")) {
      throw new Error("SYSTEM_BUSY");
    }
    throw error;
  }
}
