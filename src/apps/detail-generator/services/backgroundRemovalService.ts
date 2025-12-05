/**
 * Background Removal Service using Gemini API
 * Removes background and shadows from product images
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

interface BackgroundRemovalResult {
    original: string;
    result: string | null;
    error?: string;
}

/**
 * Remove background from a single image using Gemini
 */
export async function removeBackground(imageBase64: string): Promise<string | null> {
    if (!GEMINI_API_KEY) {
        console.error('Gemini API key is missing');
        return null;
    }

    const base64Data = imageBase64.includes('base64,')
        ? imageBase64.split('base64,')[1]
        : imageBase64;

    const prompt = `Remove the background completely from this product image. 
    Make the background pure transparent (alpha channel = 0).
    Remove ALL shadows, reflections, and any background elements.
    Keep ONLY the product itself with clean, sharp edges.
    Output a PNG image with transparent background.
    The product should be cleanly isolated without any artifacts.`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: base64Data
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ['IMAGE', 'TEXT'],
                        temperature: 0.2
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Background removal API error:', errorText);
            return null;
        }

        const data = await response.json();

        // Extract image from response
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData?.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }

        console.error('No image in background removal response');
        return null;
    } catch (error) {
        console.error('Background removal error:', error);
        return null;
    }
}

/**
 * Batch remove backgrounds from multiple images
 */
export async function batchRemoveBackground(
    images: string[],
    onProgress?: (current: number, total: number) => void
): Promise<BackgroundRemovalResult[]> {
    const results: BackgroundRemovalResult[] = [];

    for (let i = 0; i < images.length; i++) {
        onProgress?.(i + 1, images.length);

        try {
            const result = await removeBackground(images[i]);
            results.push({
                original: images[i],
                result: result
            });
        } catch (error) {
            results.push({
                original: images[i],
                result: null,
                error: String(error)
            });
        }

        // Small delay to avoid rate limiting
        if (i < images.length - 1) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    return results;
}
