import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

export interface ClothingRegion {
    type: 'face' | 'hat' | 'glasses' | 'top' | 'inner' | 'bottom' | 'shoes';
    bbox: { x: number; y: number; width: number; height: number };
    angle: number;
    confidence: number;
}

export interface ModelAnalysis {
    imageUrl: string;
    regions: ClothingRegion[];
    analyzedAt: number;
}

// API Key helper (same as geminiService.ts)
const getApiKey = (): string | undefined => {
    if (import.meta.env.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
    if (typeof window !== 'undefined' && (window as any).aistudio?.getApiKey) return (window as any).aistudio.getApiKey();
    return undefined;
};

const getAI = () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("AUTH_ERROR: API 키가 없습니다.");
    return new GoogleGenAI({ apiKey });
};

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

const MODEL_NAME = 'gemini-3-pro-image-preview';

/**
 * Analyze model image to detect clothing item positions using Gemini Vision
 */
export async function analyzeModelImage(imageUrl: string): Promise<ModelAnalysis> {
    const prompt = `Analyze this fashion model image and detect the bounding box and angle for each visible clothing item and body part.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "regions": [
    {"type": "face", "bbox": {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0}, "angle": 0, "confidence": 0.0}
  ]
}

Rules:
- Bounding box coordinates (x, y, width, height) are normalized 0-1 relative to image dimensions
- x, y is top-left corner of bbox
- angle is rotation in degrees (-180 to 180)
- confidence is 0-1
- Include only visible items from: face, hat, glasses, top, inner, bottom, shoes
  - 'glasses' means eyeglasses or sunglasses
  - 'inner' means visible innerwear/undershirt under outerwear
- Omit items not visible or not applicable
- Output ONLY the JSON, no other text`;

    try {
        const ai = getAI();
        const base64 = imageUrl.includes('base64,') ? imageUrl.split('base64,')[1] : imageUrl;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    { inlineData: { data: base64, mimeType: 'image/jpeg' } },
                    { text: prompt }
                ]
            },
            config: {
                // @ts-ignore
                safetySettings: SAFETY_SETTINGS
            }
        });

        const text = response.text?.trim() || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : text;
        const json = JSON.parse(jsonText);

        console.log('✅ Model analysis complete:', json.regions?.length || 0, 'regions found');

        return {
            imageUrl,
            regions: json.regions || [],
            analyzedAt: Date.now()
        };
    } catch (error) {
        console.error('Model analysis failed:', error);
        throw error;
    }
}

/**
 * Detect what type of clothing item is in the dropped image
 */
export async function detectItemType(imageUrl: string): Promise<string> {
    const prompt = `What type of clothing item or body part is primarily shown in this image?

Respond with ONLY ONE of these exact words (no explanation):
- face
- hat
- glasses
- top
- inner
- bottom
- shoes

Note:
- 'glasses' means eyeglasses or sunglasses
- 'inner' means innerwear/undershirt

Choose the most prominent item in the image.`;

    try {
        const ai = getAI();
        const base64 = imageUrl.includes('base64,') ? imageUrl.split('base64,')[1] : imageUrl;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    { inlineData: { data: base64, mimeType: 'image/jpeg' } },
                    { text: prompt }
                ]
            },
            config: {
                // @ts-ignore
                safetySettings: SAFETY_SETTINGS
            }
        });

        const text = response.text?.trim().toLowerCase() || '';
        const validTypes = ['face', 'hat', 'glasses', 'top', 'inner', 'bottom', 'shoes'];

        for (const type of validTypes) {
            if (text.includes(type)) {
                console.log('✅ Detected item type:', type);
                return type;
            }
        }

        console.log('⚠️ Could not detect type, defaulting to "top"');
        return 'top'; // Default fallback
    } catch (error) {
        console.error('Item type detection failed:', error);
        throw error;
    }
}

/**
 * Composite clothing item onto model using Gemini Vision API
 */
export async function compositeClothingItem(params: {
    baseImage: string;
    itemImage: string;
    itemType: string;
    targetRegion: ClothingRegion;
}): Promise<string> {
    const { baseImage, itemImage, itemType, targetRegion } = params;

    const typeNames: Record<string, string> = {
        'face': '얼굴',
        'hat': '모자',
        'glasses': '안경/선글라스',
        'top': '상의',
        'inner': '내의',
        'bottom': '하의',
        'shoes': '신발'
    };

    const typeName = typeNames[itemType] || itemType;

    const prompt = `[TASK: CLOTHING ITEM REPLACEMENT]

You are given TWO images:
- Image 1: A fashion model wearing clothes (BASE IMAGE)
- Image 2: A ${typeName} item to be placed on the model (ITEM IMAGE)

[CRITICAL INSTRUCTION]
Replace the ${typeName} on the model with the item from Image 2.

[RULES]
1. **IDENTITY LOCK**: Keep the model's face 100% identical
2. **POSE LOCK**: Keep the model's pose exactly the same
3. **SEAMLESS FIT**: The new ${typeName} must fit naturally on the model's body
4. **MATCH LIGHTING**: Match the lighting, shadows, and color temperature
5. **OTHER ITEMS LOCK**: Keep all other clothing items unchanged
6. **BACKGROUND LOCK**: Keep the background exactly the same

[TARGET REGION]
The ${typeName} should be placed at:
- Position: x=${(targetRegion.bbox.x * 100).toFixed(1)}%, y=${(targetRegion.bbox.y * 100).toFixed(1)}%
- Size: ${(targetRegion.bbox.width * 100).toFixed(1)}% x ${(targetRegion.bbox.height * 100).toFixed(1)}%
- Angle: ${targetRegion.angle} degrees

[OUTPUT]
Generate a single photo-realistic fashion image with the replaced ${typeName}.`;

    try {
        const ai = getAI();
        const baseB64 = baseImage.includes('base64,') ? baseImage.split('base64,')[1] : baseImage;
        const itemB64 = itemImage.includes('base64,') ? itemImage.split('base64,')[1] : itemImage;

        console.log(`🎨 Compositing ${typeName} onto model...`);

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview', // Use image generation model
            contents: {
                parts: [
                    { inlineData: { data: baseB64, mimeType: 'image/jpeg' } },
                    { inlineData: { data: itemB64, mimeType: 'image/jpeg' } },
                    { text: prompt }
                ]
            },
            config: {
                // @ts-ignore
                imageConfig: { aspectRatio: '3:4', imageSize: '1K' },
                safetySettings: SAFETY_SETTINGS
            }
        });

        // Extract image from response
        for (const candidate of response.candidates || []) {
            for (const part of candidate.content?.parts || []) {
                if (part.inlineData) {
                    console.log('✅ Composite image generated successfully');
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }

        console.warn('⚠️ No image in response, returning original');
        return baseImage;

    } catch (error) {
        console.error('Compositing failed:', error);
        // Fallback to original image on error so the app doesn't break
        return baseImage;
    }
}

/**
 * Change the color of a specific clothing item on a model image
 */
export async function changeItemColor(params: {
    baseImage: string;
    itemType: string;
    targetColor: string;
    colorName: string;
    targetRegion?: ClothingRegion;
}): Promise<string> {
    const { baseImage, itemType, targetColor, colorName, targetRegion } = params;

    const typeNames: Record<string, string> = {
        'face': '얼굴',
        'hat': '모자',
        'glasses': '안경/선글라스',
        'top': '상의',
        'inner': '내의',
        'bottom': '하의/바지',
        'shoes': '신발'
    };

    const typeName = typeNames[itemType] || itemType;

    const regionInfo = targetRegion
        ? `Target region: x=${(targetRegion.bbox.x * 100).toFixed(1)}%, y=${(targetRegion.bbox.y * 100).toFixed(1)}%, width=${(targetRegion.bbox.width * 100).toFixed(1)}%, height=${(targetRegion.bbox.height * 100).toFixed(1)}%`
        : '';

    const prompt = `[TASK: PRECISE CLOTHING COLOR CHANGE]

You are given an image of a fashion model.

[CRITICAL: SIZE LOCK]
OUTPUT IMAGE DIMENSIONS MUST BE EXACTLY THE SAME AS INPUT.
DO NOT crop, resize, or change the aspect ratio.
This is an EDIT to the existing image, not a new generation.

[CRITICAL INSTRUCTION]
Change ONLY the color of the ${typeName} to ${colorName} (${targetColor}).

${regionInfo}

[STRICT RULES]
1. **SIZE LOCK**: Output dimensions = Input dimensions EXACTLY
2. **IDENTITY LOCK**: Model's face must be 100% IDENTICAL
3. **POSE LOCK**: Pose must be EXACTLY the same
4. **OTHER ITEMS LOCK**: ALL other clothing items UNCHANGED
5. **BACKGROUND LOCK**: Background must be PIXEL-IDENTICAL
6. **TEXTURE LOCK**: Fabric texture, pattern, material UNCHANGED - only color changes
7. **PRECISE TARGETING**: Change color ONLY within the specified ${typeName} region
8. **LIGHTING MATCH**: Color must blend naturally with lighting conditions
9. **NO SIDE EFFECTS**: Do NOT alter ANYTHING except the ${typeName} color

[TARGET COLOR]
${typeName}: Change to ${colorName} (HEX: ${targetColor})

[OUTPUT]
Photo-realistic image with ONLY the ${typeName} color changed. Everything else IDENTICAL to input.`;

    try {
        const ai = getAI();
        const baseB64 = baseImage.includes('base64,') ? baseImage.split('base64,')[1] : baseImage;

        console.log(`🎨 Changing ${typeName} color to ${colorName}...`);

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
                parts: [
                    { inlineData: { data: baseB64, mimeType: 'image/jpeg' } },
                    { text: prompt }
                ]
            },
            config: {
                // @ts-ignore
                imageConfig: { aspectRatio: '3:4', imageSize: '1K' },
                safetySettings: SAFETY_SETTINGS
            }
        });

        // Extract image from response
        for (const candidate of response.candidates || []) {
            for (const part of candidate.content?.parts || []) {
                if (part.inlineData) {
                    console.log(`✅ Color changed to ${colorName} successfully`);
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }

        console.warn('⚠️ No image in response, returning original');
        return baseImage;

    } catch (error) {
        console.error('Color change failed:', error);
        return baseImage;
    }
}
