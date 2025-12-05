/**
 * Content Generator Service - PHOTOCOPIER Strategy
 * 
 * 핵심 로직:
 * 1. Pre-processing: 입력 이미지에 BLACK (#000000) bars로 1:1 패딩
 * 2. Model: gemini-3-pro-image-preview (이미지 생성 가능)
 * 3. Prompt Strategy: "Photocopier" 페르소나로 생성이 아닌 복제 강제
 * 4. Outpainting: 모델이 검은 픽셀을 배경 확장 영역으로 인식
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Target dimensions for Fashion Detail Pages (1:1 Square)
const TARGET_WIDTH = 1400;
const TARGET_HEIGHT = 1400;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface UploadFile {
    file: File;
    previewUrl: string;
}

export interface ColorSettings {
    outer?: string;
    inner?: string;
    pants?: string;
    socks?: string;
}

export interface GenerationResult {
    success: boolean;
    imageBase64?: string;
    error?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * [CRITICAL PRE-PROCESSING] prepareImageForAi
 * 
 * Strategy: "Black Bar Padding"
 * 1. Creates a 1400x1400 square canvas.
 * 2. Fills the canvas with SOLID BLACK (#000000).
 * 3. Places the source image in the center (Object-fit: Contain).
 * 
 * WHY: This creates explicit "void" areas (black bars) around the image.
 * The AI model recognizes these black voids as "areas to be outpainted".
 */
export const prepareImageForAi = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context.'));
                }

                // 1:1 Aspect Ratio (Square)
                const targetWidth = TARGET_WIDTH;
                const targetHeight = TARGET_HEIGHT;
                const targetAspectRatio = targetWidth / targetHeight;

                canvas.width = targetWidth;
                canvas.height = targetHeight;

                // [CRITICAL] Use BLACK for padding.
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, targetWidth, targetHeight);

                const imgW = img.width;
                const imgH = img.height;
                const imgAspect = imgW / imgH;

                let dx = 0, dy = 0, dWidth = targetWidth, dHeight = targetHeight;

                if (imgAspect > targetAspectRatio) {
                    // Image is wider than target
                    dWidth = targetWidth;
                    dHeight = dWidth / imgAspect;
                    dy = (targetHeight - dHeight) / 2;
                } else {
                    // Image is taller
                    dHeight = targetHeight;
                    dWidth = dHeight * imgAspect;
                    dx = (targetWidth - dWidth) / 2;
                }

                ctx.drawImage(img, 0, 0, imgW, imgH, dx, dy, dWidth, dHeight);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                // Return only base64 part
                resolve(dataUrl.split('base64,')[1]);
            };
            img.onerror = reject;
            img.src = event.target?.result as string;
        };
        reader.onerror = reject;
    });
};

const enforceAspectRatio = (
    dataUrl: string,
    targetWidth: number,
    targetHeight: number
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, targetWidth, targetHeight);

            const imgW = img.naturalWidth;
            const imgH = img.naturalHeight;
            const targetAspect = targetWidth / targetHeight;
            const imgAspect = imgW / imgH;

            let dx = 0, dy = 0, dWidth = targetWidth, dHeight = targetHeight;

            if (imgAspect > targetAspect) {
                dWidth = targetWidth;
                dHeight = dWidth / imgAspect;
                dy = (targetHeight - dHeight) / 2;
            } else {
                dHeight = targetHeight;
                dWidth = dHeight * imgAspect;
                dx = (targetWidth - dWidth) / 2;
            }

            ctx.drawImage(img, 0, 0, imgW, imgH, dx, dy, dWidth, dHeight);

            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = (err) => {
            console.error("Failed to load image for aspect ratio enforcement.", err);
            reject(new Error('Failed to load image for fitting.'));
        };
        img.src = dataUrl;
    });
};

// ============================================================================
// [CORE FUNCTION] generateCampaignImage - PHOTOCOPIER Strategy
// ============================================================================

export const generateCampaignImage = async (
    sourceImageBase64: string,
    productImagesBase64: string[],
    colorSettings?: ColorSettings
): Promise<GenerationResult> => {

    if (!GEMINI_API_KEY) {
        return { success: false, error: 'API 키가 없습니다' };
    }

    // 추가 지시사항 (의상 색상 변경)
    let additionalInstructions = "";
    if (colorSettings) {
        if (colorSettings.outer) additionalInstructions += `- Change the Outerwear/Coat color to ${colorSettings.outer}.\n`;
        if (colorSettings.inner) additionalInstructions += `- Change the Inner Top/Shirt color to ${colorSettings.inner}.\n`;
        if (colorSettings.pants) additionalInstructions += `- Change the Pants/Trousers color to ${colorSettings.pants}.\n`;
        if (colorSettings.socks) additionalInstructions += `- Change the Socks color to ${colorSettings.socks}.\n`;
    }

    // [PROMPT ENGINEERING - THE "PHOTOCOPIER" STRATEGY]
    const EDITING_PROMPT = `
[ROLE] Expert Product Retoucher & Digital Twin Specialist
[TASK] High-Fidelity Shoe Replacement (Pixel-Perfect Cloning)

[INPUTS]
- Image 1: TARGET MODEL (Contains BLACK BARS/VOID for Outpainting).
- Image 2+: SOURCE PRODUCT IMAGES (The "Ground Truth" for design).

[CRITICAL INSTRUCTION: ZERO TOLERANCE FOR HALLUCINATION]
You are NOT designing a new shoe. You are a **PHOTOCOPIER**.
Your goal is to **CLONE** the shoes from Image 2 onto the feet in Image 1.
**IF THE STITCHING, LOGO, OR MATERIAL TEXTURE DOES NOT MATCH IMAGE 2 EXACTLY, THE TASK IS FAILED.**

[PHASE 1: DETAIL EXTRACTION (SOURCE OF TRUTH)]
1.  **STITCHING (CRITICAL)**:
    - Zoom in on Image 2. Count the stitch rows. Observe the thread thickness and color.
    - **REPLICATE** this exact stitching pattern on the model's feet. 
    - Do NOT approximate. If it's double-stitched in Image 2, it MUST be double-stitched in the result.
2.  **LOGOS & BRANDING**:
    - Copy the exact logo placement, size, and orientation from Image 2.
    - Text must be legible and spelled correctly.
3.  **MATERIAL PHYSICS**:
    - If Image 2 is patent leather, the result must shine.
    - If Image 2 is suede, the result must look soft and matte.
    - Use the ACTUAL pixels from Image 2 as a texture map.

[PHASE 2: SCENE INTEGRATION]
1.  **GEOMETRY WARP**: Warp the shape of the shoe from Image 2 to fit the perspective of the feet in Image 1.
2.  **LIGHTING MATCH**: Apply the lighting/shadows of Image 1 to the shoe, but DO NOT CHANGE THE COLOR OR PATTERN of the shoe materials.
3.  **OUTPAINTING**: Fill the black bars in Image 1 with a realistic studio background (floor/wall extension).

${additionalInstructions ? `[ADDITIONAL CLOTHING EDITS]\n${additionalInstructions}` : ''}

[STRICT CONSTRAINTS]
- **OUTPUT**: 1:1 Square Image. NO BLACK BARS.
- **SHARPNESS**: The shoes must be the sharpest part of the image.
- **FIDELITY**: 100% match to product photos (Image 2+).
`;

    // Payload 구성
    const parts: any[] = [
        { text: "Perform 3D Geometry Replacement, Texture Baking, and Background Extension." },
        { inlineData: { data: sourceImageBase64, mimeType: 'image/jpeg' } }
    ];

    // 제품 이미지 추가
    for (const productBase64 of productImagesBase64.slice(0, 4)) {
        parts.push({ inlineData: { data: productBase64, mimeType: 'image/jpeg' } });
    }

    parts.push({ text: EDITING_PROMPT });

    try {
        console.log('=== generateCampaignImage ===');
        console.log('Source image length:', sourceImageBase64.length);
        console.log('Product images count:', productImagesBase64.length);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        responseModalities: ['IMAGE', 'TEXT'],
                        temperature: 0.1
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            return { success: false, error: `API 오류: ${response.status}` };
        }

        const data = await response.json();

        if (data.promptFeedback?.blockReason) {
            return { success: false, error: `생성 차단됨: ${data.promptFeedback.blockReason}` };
        }

        const resultParts = data.candidates?.[0]?.content?.parts || [];

        for (const part of resultParts) {
            if (part.inlineData?.data) {
                console.log('✓ Campaign image generated');
                return {
                    success: true,
                    imageBase64: part.inlineData.data
                };
            }
        }

        return { success: false, error: '이미지 생성 응답 없음' };

    } catch (error: any) {
        console.error("Campaign Generation Error:", error);
        let msg = error.message || String(error);
        if (msg.includes('JSON')) msg = "연결 불안정. 잠시 후 다시 시도해주세요.";
        if (msg.includes('400')) msg = "이미지 용량이 너무 큽니다.";
        return { success: false, error: msg };
    }
};

// ============================================================================
// POSE CHANGE
// ============================================================================

export const changeImagePose = async (
    sourceImage: UploadFile,
    posePrompt: string
): Promise<string> => {
    const sourceImageBase64 = await fileToBase64(sourceImage.file);

    const prompt = `
[TASK] Pose Editing & Advanced Background Outpainting
[INPUT] Source Image (contains black padding)

[INSTRUCTION]
1. **SCENE RECONSTRUCTION (OUTPAINTING)**: 
   - The input has BLACK BARS. These are VOID areas.
   - **CALCULATE LIGHTING**: Analyze the light source from the model.
   - **EXTEND ENVIRONMENT**: Generate realistic floor and walls to fill the black areas.
   - **CAST SHADOWS**: Ensure the model casts correct shadows on the new background.

2. **POSE MODIFICATION**: 
   - Modify ONLY the position of the model's legs and feet to match: "${posePrompt}".
   - Keep the upper body and face locked.

[CRITICAL RULES]
- **OUTPUT**: Full 1:1 Square Image. NO BLACK BARS.
- **IDENTITY**: Do not change face/hair.
- **REALISM**: Global illumination must be consistent.
`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { data: sourceImageBase64, mimeType: sourceImage.file.type } },
                            { text: prompt }
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ['IMAGE', 'TEXT'],
                        temperature: 0.2
                    }
                })
            }
        );

        const data = await response.json();
        const resultParts = data.candidates?.[0]?.content?.parts || [];

        for (const part of resultParts) {
            if (part.inlineData?.data) {
                const originalDataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                return await enforceAspectRatio(originalDataUrl, TARGET_WIDTH, TARGET_HEIGHT);
            }
        }
        throw new Error("No pose image generated.");

    } catch (error: any) {
        console.error("Pose Change Error:", error);
        throw new Error(`자세 변경 실패: ${error.message || String(error)}`);
    }
};

// ============================================================================
// CLOTHING COLOR CHANGE
// ============================================================================

export const changeClothingDetail = async (
    sourceImage: UploadFile,
    item: string,
    color: string
): Promise<string> => {
    const sourceImageBase64 = await fileToBase64(sourceImage.file);

    const itemMap: Record<string, string> = {
        'socks': 'socks',
        'coat': 'outerwear coat/jacket',
        'inner': 'inner top/shirt',
        'pants': 'pants/trousers'
    };
    const targetItem = itemMap[item] || item;

    const prompt = `
[TASK] Local Recolor & Advanced Scene Outpainting
[INPUT] Source Image

[INSTRUCTION]
1. **SCENE EXTENSION (OUTPAINTING)**: 
   - Detect BLACK BARS in the input.
   - **FILL** these areas by extending the studio background. 
   - The result must be a seamless 1:1 image.

2. **COLOR CHANGE**: 
   - Change the color of the model's ${targetItem} to ${color}.
   - **PRESERVE TEXTURE**: Keep all fabric textures. Only change the color.

[CRITICAL RULES]
- **OUTPUT**: Full 1:1 Square Image. NO BLACK BARS.
- **TARGET**: Change ONLY the color of the ${targetItem}.
- **PRESERVATION**: Shoes, face, and other items must remain 100% UNCHANGED.
`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { data: sourceImageBase64, mimeType: sourceImage.file.type } },
                            { text: prompt }
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ['IMAGE', 'TEXT'],
                        temperature: 0.1
                    }
                })
            }
        );

        const data = await response.json();
        const resultParts = data.candidates?.[0]?.content?.parts || [];

        for (const part of resultParts) {
            if (part.inlineData?.data) {
                const originalDataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                return await enforceAspectRatio(originalDataUrl, TARGET_WIDTH, TARGET_HEIGHT);
            }
        }
        throw new Error("No edited image generated.");

    } catch (error: any) {
        console.error("Clothing Change Error:", error);
        throw new Error(`의상 변경 실패: ${error.message || String(error)}`);
    }
};
