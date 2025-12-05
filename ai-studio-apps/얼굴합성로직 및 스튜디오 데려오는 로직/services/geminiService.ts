
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Part, GenerateContentResponse } from "@google/genai";

const MODEL_NAME = 'gemini-3-pro-image-preview';

const getAiClient = () => {
    const key = process.env.API_KEY;
    if (!key) {
        throw new Error("API 키가 확인되지 않습니다. 우측 하단의 '연결하기' 버튼을 눌러주세요.");
    }
    return new GoogleGenAI({ apiKey: key });
};

// =================================================================
// 🧠 CORE LOGIC: PROMPT ENGINEERING (프롬프트 엔지니어링)
// =================================================================
// Gravity Note: 
// 이 프롬프트는 단순한 텍스트가 아니라 "렌더링 셰이더(Shader)" 역할을 합니다.
// OpenCV 코드로 구현하던 'Face Landmark Detection'과 'Perspective Warp' 로직을
// 아래의 자연어 명령(Natural Language Instruction)으로 대체했습니다.
// =================================================================

const campaignSynthesisPrompt = (
    hasShoes: boolean,
    hasTop: boolean,
    hasBottom: boolean,
    topColor?: string | null,
    bottomColor?: string | null,
    socksColor?: string | null,
    isStudioMode: boolean = false
) => `
**ROLE: ANATOMICAL VFX ARTIST**

**TASK: ANATOMICALLY CORRECT FACE SWAP**

**INPUT ANALYSIS (IMAGE ROLES):**
*   **IMAGE 1 [FASHION MODEL]**: Full-body Target Shot (9-Head Proportion). **THIS IS THE ABSOLUTE CANVAS.**
*   **IMAGE 2 [FACE ID]**: Close-up Source Face. **THIS IS REFERENCE TEXTURE ONLY.**

**STRICT GEOMETRIC CONSTRAINTS (CRITICAL LOGIC):**
1.  **SKULL LOCK (두개골 고정)**: 
    - The head size, hair volume, and jawline width MUST be identical to **IMAGE 1 [FASHION MODEL]**. 
    - **DO NOT** expand the head boundary. Treat IMAGE 1 as a static mesh.
2.  **DOWNSCALING (축소 이식 알고리즘)**: 
    - **IMAGE 2** is usually a close-up (Large scale). **IMAGE 1** is a full shot (Small scale).
    - You MUST mathematically scale down the facial features of **IMAGE 2** to fit strictly inside the small face area of **IMAGE 1**.
3.  **ANTI-BIG-HEAD (대두 방지)**: 
    - The resulting head-to-body ratio must match a professional fashion model (1:8 or 1:9).
    - If the head looks "floating" or "too big", the generation is a FAILURE.

**RENDERING PIPELINE:**
1.  **Canvas Lock**: Preserve body, pose, clothes, background, and hair of **IMAGE 1** (Pixel-perfect preservation).
2.  **Feature Extraction**: Extract eyes/nose/mouth geometry from **IMAGE 2**.
3.  **Projection**: Project extracted features onto **IMAGE 1**'s face coordinates with correct perspective.
4.  **Relighting**: Sampling the lighting environment (HDRI) from **IMAGE 1**'s neck/chest and applying it to the new face.
5.  **Garment Modification**:
    *   **Socks**: ${socksColor ? `Identify the socks area. Dye them ${socksColor} using "Multiply" blending mode to keep fabric folds.` : 'Keep socks exactly as in IMAGE 1.'}
    *   **Shoes**: ${hasShoes ? 'Replace shoes in IMAGE 1 with provided shoe images.' : 'Keep shoes exactly as in IMAGE 1.'}
    *   **Background**: ${isStudioMode ? 'Change background to concrete studio.' : 'KEEP BACKGROUND EXACTLY AS IMAGE 1.'}

**OUTPUT REQUIREMENT**: A photorealistic fashion shot where the face looks naturally small and proportionate to the tall body of IMAGE 1.
`;

const poseVariationPrompt = (
    poseDescription: string,
    hasShoes: boolean,
    hasTop: boolean,
    hasBottom: boolean,
    topColor?: string | null,
    bottomColor?: string | null,
    socksColor?: string | null,
    isStudioMode: boolean = false
) => `
**TASK: POSE VARIATION WITH PROPORTION CONTROL**

**INPUTS**:
*   **IMAGE 1 [FASHION MODEL]**: Original Fashion Shot.
*   **IMAGE 2 [FACE ID]**: Face Source.

**INSTRUCTIONS:**
1.  **Proportions**: MAINTAIN THE 9-HEAD FASHION PROPORTION of IMAGE 1.
2.  **Face Sizing**: The face MUST remain small relative to the body. Do not enlarge the head.
3.  **Action**: Generate the model in a **"${poseDescription}"**.
4.  **Details**:
    *   Face: Resembles IMAGE 2 but scaled correctly.
    *   Socks: ${socksColor ? `Color: ${socksColor}` : 'Match IMAGE 1.'}
    *   Shoes: ${hasShoes ? 'Use provided shoes.' : 'Match IMAGE 1.'}
`;

const refineImagePrompt = `
**TASK: TEXTURE & GRAIN MATCHING**
1.  **Grain Analysis**: Sample the film grain/ISO noise from the model's neck/shoulder area in IMAGE 1.
2.  **Application**: Apply this exact noise pattern to the face area to remove the "digital/smooth" look.
3.  **Unification**: Ensure the face sharpness matches the body sharpness. If the body is slightly out of focus (depth of field), blur the face slightly to match.
`;

async function fileToGenerativePart(file: File): Promise<Part> {
    const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to read file as data URL.'));
            }
        };
        reader.readAsDataURL(file);
    });
    return { inlineData: { data: await base64EncodedDataPromise, mimeType: file.type } };
}

async function urlToGenerativePart(url: string): Promise<Part> {
    const response = await fetch(url);
    const blob = await response.blob();
    const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to read blob as data URL.'));
            }
        };
        reader.readAsDataURL(blob);
    });
    return { inlineData: { data: await base64EncodedDataPromise, mimeType: blob.type } };
}

function getImageUrlFromResponse(response: GenerateContentResponse): string {
    for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error('No image found in the response.');
}

async function generateImage(prompt: string, imageParts: Part[], seed?: number): Promise<string> {
    const allParts = [{ text: prompt }, ...imageParts];
    const config: any = { 
        imageConfig: { aspectRatio: "9:16" }, 
        // Temperature 0.4: 창의성(Hallucination)을 낮추고 지시 이행력(Instruction Following)을 높임.
        // 해부학적 구조(Anatomy)를 유지하려면 낮은 값이 필수적임.
        temperature: 0.4, 
    };
    
    if (seed !== undefined) {
        config.seed = seed;
    }

    const response = await getAiClient().models.generateContent({
        model: MODEL_NAME,
        contents: { parts: allParts },
        config: config,
    });

    return getImageUrlFromResponse(response);
}

// =================================================================
// 🚀 MAIN EXECUTION FUNCTION
// =================================================================

export async function synthesizeCampaignImage(
    targetShotFile: File,
    faceFile: File,
    shoeFiles: File[],
    topFiles: File[] = [],
    bottomFiles: File[] = [],
    topColor?: string | null,
    bottomColor?: string | null,
    socksColor?: string | null,
    isStudioMode: boolean = false,
    seed?: number
): Promise<string> {
    // 1. Convert Files to Base64 Parts
    const targetPart = await fileToGenerativePart(targetShotFile);
    const facePart = await fileToGenerativePart(faceFile);
    const shoeParts = await Promise.all(shoeFiles.map(fileToGenerativePart));
    const topParts = await Promise.all(topFiles.map(fileToGenerativePart));
    const bottomParts = await Promise.all(bottomFiles.map(fileToGenerativePart));

    // 2. Build the Logic Prompt
    const prompt = campaignSynthesisPrompt(
        shoeFiles.length > 0,
        topFiles.length > 0,
        bottomFiles.length > 0,
        topColor, 
        bottomColor,
        socksColor,
        isStudioMode
    );

    // 3. PHYSICAL ORDERING (CRITICAL FOR LOGIC): 
    // AI는 첫 번째 이미지를 '기준점(Anchor)'으로 인식하는 경향이 있음.
    // [0]: Target Fashion Model (Canvas) -> 무조건 1번 인덱스 고정
    // [1]: Source Face ID (Reference) -> 참조용
    return generateImage(
        prompt, 
        [targetPart, facePart, ...shoeParts, ...topParts, ...bottomParts],
        seed
    );
}

export async function generatePoseVariation(
    currentImageUrl: string,
    faceFile: File,
    shoeFiles: File[],
    topFiles: File[] = [],
    bottomFiles: File[] = [],
    poseDescription: string,
    topColor?: string | null,
    bottomColor?: string | null,
    socksColor?: string | null,
    isStudioMode: boolean = false,
    seed?: number
): Promise<string> {
    const currentImagePart = await urlToGenerativePart(currentImageUrl);
    const facePart = await fileToGenerativePart(faceFile);
    const shoeParts = await Promise.all(shoeFiles.map(fileToGenerativePart));
    const topParts = await Promise.all(topFiles.map(fileToGenerativePart));
    const bottomParts = await Promise.all(bottomFiles.map(fileToGenerativePart));
    
    const prompt = poseVariationPrompt(
        poseDescription,
        shoeFiles.length > 0,
        topFiles.length > 0,
        bottomFiles.length > 0,
        topColor, 
        bottomColor,
        socksColor,
        isStudioMode
    );

    return generateImage(
        prompt, 
        [currentImagePart, facePart, ...shoeParts, ...topParts, ...bottomParts],
        seed
    );
}

export async function refineImage(shoeFiles: File[], modelImageUrl: string): Promise<string> {
    const shoeImageParts = await Promise.all(shoeFiles.map(fileToGenerativePart));
    const modelImagePart = await urlToGenerativePart(modelImageUrl);
    return generateImage(refineImagePrompt, [modelImagePart, ...shoeImageParts]);
}
