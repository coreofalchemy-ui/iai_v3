/**
 * 🔐 보안 Content Generator 서비스 - PHOTOCOPIER Strategy
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure } from '../../../lib/geminiClient';

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
 * prepareImageForAi - Black Bar Padding
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
                if (!ctx) return reject(new Error('Could not get canvas context.'));

                canvas.width = TARGET_WIDTH;
                canvas.height = TARGET_HEIGHT;

                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

                const imgW = img.width;
                const imgH = img.height;
                const targetAspectRatio = TARGET_WIDTH / TARGET_HEIGHT;
                const imgAspect = imgW / imgH;

                let dx = 0, dy = 0, dWidth = TARGET_WIDTH, dHeight = TARGET_HEIGHT;

                if (imgAspect > targetAspectRatio) {
                    dWidth = TARGET_WIDTH;
                    dHeight = dWidth / imgAspect;
                    dy = (TARGET_HEIGHT - dHeight) / 2;
                } else {
                    dHeight = TARGET_HEIGHT;
                    dWidth = dHeight * imgAspect;
                    dx = (TARGET_WIDTH - dWidth) / 2;
                }

                ctx.drawImage(img, 0, 0, imgW, imgH, dx, dy, dWidth, dHeight);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
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
            if (!ctx) return reject(new Error('Could not get canvas context'));

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
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
    });
};

// ============================================================================
// [CORE FUNCTION] generateCampaignImage - SECURE VERSION
// ============================================================================

export const generateCampaignImage = async (
    sourceImageBase64: string,
    productImagesBase64: string[],
    colorSettings?: ColorSettings
): Promise<GenerationResult> => {

    let additionalInstructions = "";
    if (colorSettings) {
        if (colorSettings.outer) additionalInstructions += `- Change Outerwear color to ${colorSettings.outer}.\n`;
        if (colorSettings.inner) additionalInstructions += `- Change Inner Top color to ${colorSettings.inner}.\n`;
        if (colorSettings.pants) additionalInstructions += `- Change Pants color to ${colorSettings.pants}.\n`;
        if (colorSettings.socks) additionalInstructions += `- Change Socks color to ${colorSettings.socks}.\n`;
    }

    const EDITING_PROMPT = `
[ROLE] Expert Product Retoucher & Digital Twin Specialist
[TASK] High-Fidelity Shoe Replacement (Pixel-Perfect Cloning)

[INPUTS]
- Image 1: TARGET MODEL (Contains BLACK BARS/VOID for Outpainting).
- Image 2+: SOURCE PRODUCT IMAGES.

[CRITICAL INSTRUCTION: ZERO TOLERANCE FOR HALLUCINATION]
You are a **PHOTOCOPIER**. **CLONE** the shoes from Image 2 onto the feet in Image 1.

[PHASE 1: DETAIL EXTRACTION]
1. **STITCHING**: Copy exact pattern from Image 2.
2. **LOGOS**: Copy exact placement, size, orientation.
3. **MATERIAL**: If suede, must look soft. If leather, must shine.

[PHASE 2: SCENE INTEGRATION]
1. **GEOMETRY WARP**: Fit shoe to perspective of feet.
2. **LIGHTING MATCH**: Apply lighting/shadows from Image 1.
3. **OUTPAINTING**: Fill black bars with realistic studio background.

${additionalInstructions ? `[ADDITIONAL EDITS]\n${additionalInstructions}` : ''}

[CONSTRAINTS]
- **OUTPUT**: 1:1 Square Image. NO BLACK BARS.
- **SHARPNESS**: Shoes must be sharpest part.
- **FIDELITY**: 100% match to product photos.
`;

    const images = [
        { data: sourceImageBase64, mimeType: 'image/jpeg' },
        ...productImagesBase64.slice(0, 4).map(b64 => ({ data: b64, mimeType: 'image/jpeg' }))
    ];

    try {
        console.log('=== generateCampaignImage (SECURE) ===');

        const result = await callGeminiSecure(EDITING_PROMPT, images);

        if (result.type !== 'image') {
            return { success: false, error: '이미지 생성 응답 없음' };
        }

        console.log('✓ Campaign image generated (SECURE)');
        return { success: true, imageBase64: result.data };

    } catch (error: any) {
        console.error("Campaign Generation Error:", error);
        return { success: false, error: error.message || String(error) };
    }
};

// ============================================================================
// POSE CHANGE (SECURE)
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
   - Fill BLACK BARS with realistic floor and walls.
   - Cast correct shadows on new background.

2. **POSE MODIFICATION**: 
   - Modify legs and feet to match: "${posePrompt}".
   - Keep upper body and face locked.

[CRITICAL RULES]
- **OUTPUT**: Full 1:1 Square Image. NO BLACK BARS.
- **IDENTITY**: Do not change face/hair.
`;

    const result = await callGeminiSecure(
        prompt,
        [{ data: sourceImageBase64, mimeType: sourceImage.file.type }]
    );

    if (result.type !== 'image') {
        throw new Error("No pose image generated.");
    }

    const originalDataUrl = result.data;
    return await enforceAspectRatio(originalDataUrl, TARGET_WIDTH, TARGET_HEIGHT);
};

// ============================================================================
// CLOTHING COLOR CHANGE (SECURE)
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

[INSTRUCTION]
1. **SCENE EXTENSION**: Fill BLACK BARS by extending studio background.
2. **COLOR CHANGE**: Change ${targetItem} color to ${color}.

[CRITICAL RULES]
- **OUTPUT**: Full 1:1 Square Image. NO BLACK BARS.
- **TARGET**: Change ONLY the color of ${targetItem}.
- **PRESERVATION**: Shoes, face, other items = 100% UNCHANGED.
`;

    const result = await callGeminiSecure(
        prompt,
        [{ data: sourceImageBase64, mimeType: sourceImage.file.type }]
    );

    if (result.type !== 'image') {
        throw new Error("No edited image generated.");
    }

    const originalDataUrl = result.data;
    return await enforceAspectRatio(originalDataUrl, TARGET_WIDTH, TARGET_HEIGHT);
};
