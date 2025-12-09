/**
 * 🔐 보안 Content Generator 서비스 - PHOTOCOPIER Strategy
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure } from '../../../lib/geminiClient';

// Target dimensions for Fashion Detail Pages (750x900 Fixed)
const TARGET_WIDTH = 750;
const TARGET_HEIGHT = 900;

// 최대 해상도 (긴 쪽 기준)
const MAX_DIMENSION = 1400;

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
    aspectRatio?: string; // 원본 비율 정보 추가
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
 * 이미지의 가로/세로 비율 분석 (세로형, 정사각형, 가로형)
 */
export const getImageAspectInfo = (width: number, height: number): {
    aspectRatio: string;
    orientation: 'portrait' | 'square' | 'landscape';
    promptRatio: string;
} => {
    const ratio = width / height;

    if (ratio < 0.9) {
        // 세로형 (Portrait)
        return {
            aspectRatio: '3:4',
            orientation: 'portrait',
            promptRatio: 'PORTRAIT (Vertical, taller than wide, approximately 3:4 ratio)'
        };
    } else if (ratio > 1.1) {
        // 가로형 (Landscape)
        return {
            aspectRatio: '4:3',
            orientation: 'landscape',
            promptRatio: 'LANDSCAPE (Horizontal, wider than tall, approximately 4:3 ratio)'
        };
    } else {
        // 정사각형 (Square)
        return {
            aspectRatio: '1:1',
            orientation: 'square',
            promptRatio: 'SQUARE (Equal width and height, 1:1 ratio)'
        };
    }
};

/**
 * prepareImageKeepAspectRatio - 원본 비율 유지하면서 리사이징
 * 배경이미지 무시하고 모델 이미지 비율 그대로 유지
 */
export const prepareImageKeepAspectRatio = (file: File): Promise<{ base64: string; aspectInfo: ReturnType<typeof getImageAspectInfo> }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const imgW = img.width;
                const imgH = img.height;

                // 비율 정보 분석
                const aspectInfo = getImageAspectInfo(imgW, imgH);

                // 긴 쪽을 MAX_DIMENSION으로 맞추고 비율 유지
                let newWidth: number, newHeight: number;
                if (imgW > imgH) {
                    newWidth = Math.min(imgW, MAX_DIMENSION);
                    newHeight = Math.round(newWidth * (imgH / imgW));
                } else {
                    newHeight = Math.min(imgH, MAX_DIMENSION);
                    newWidth = Math.round(newHeight * (imgW / imgH));
                }

                const canvas = document.createElement('canvas');
                canvas.width = newWidth;
                canvas.height = newHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Could not get canvas context.'));

                ctx.drawImage(img, 0, 0, imgW, imgH, 0, 0, newWidth, newHeight);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

                console.log(`[prepareImageKeepAspectRatio] Original: ${imgW}x${imgH}, Resized: ${newWidth}x${newHeight}, Orientation: ${aspectInfo.orientation}`);

                resolve({
                    base64: dataUrl.split('base64,')[1],
                    aspectInfo
                });
            };
            img.onerror = reject;
            img.src = event.target?.result as string;
        };
        reader.onerror = reject;
    });
};

/**
 * prepareImageForAi - Black Bar Padding (기존 함수 유지, 정사각형 필요시 사용)
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
    colorSettings?: ColorSettings,
    aspectInfo?: ReturnType<typeof getImageAspectInfo> // 모델 이미지 비율 정보
): Promise<GenerationResult> => {

    let additionalInstructions = "";
    if (colorSettings) {
        if (colorSettings.outer) additionalInstructions += `- Change Outerwear color to ${colorSettings.outer}.\n`;
        if (colorSettings.inner) additionalInstructions += `- Change Inner Top color to ${colorSettings.inner}.\n`;
        if (colorSettings.pants) additionalInstructions += `- Change Pants color to ${colorSettings.pants}.\n`;
        if (colorSettings.socks) additionalInstructions += `- Change Socks color to ${colorSettings.socks}.\n`;
    }

    // 모델 이미지 비율에 따른 출력 지시
    const outputRatioInstruction = aspectInfo
        ? `**OUTPUT ASPECT RATIO**: ${aspectInfo.promptRatio}. The output image MUST match the aspect ratio of the MODEL IMAGE (Image 1). Ignore any background image ratios.`
        : `**OUTPUT**: 1:1 Square Image.`;

    const EDITING_PROMPT = `
[ROLE] Expert Product Retoucher & Digital Twin Specialist
[TASK] High-Fidelity Shoe Replacement (Pixel-Perfect Cloning)

[INPUTS]
- Image 1: TARGET MODEL (The model person wearing clothes - USE THIS IMAGE'S ASPECT RATIO FOR OUTPUT).
- Image 2+: SOURCE PRODUCT IMAGES (shoes/products to clone).

[CRITICAL INSTRUCTION: ZERO TOLERANCE FOR HALLUCINATION]
You are a **PHOTOCOPIER**. **CLONE** the shoes from Image 2 onto the feet in Image 1.

[PHASE 1: DETAIL EXTRACTION]
1. **STITCHING**: Copy exact pattern from Image 2.
2. **LOGOS**: Copy exact placement, size, orientation.
3. **MATERIAL**: If suede, must look soft. If leather, must shine.

[PHASE 2: SCENE INTEGRATION]
1. **GEOMETRY WARP**: Fit shoe to perspective of feet.
2. **LIGHTING MATCH**: Apply lighting/shadows from Image 1.
3. **BACKGROUND**: Keep or extend the background from Image 1.

${additionalInstructions ? `[ADDITIONAL EDITS]\n${additionalInstructions}` : ''}

[CONSTRAINTS - CRITICAL]
- ${outputRatioInstruction}
- **ASPECT RATIO LOCK**: The output MUST have the SAME aspect ratio as the MODEL IMAGE (Image 1). Do NOT change to landscape or square if the model image is portrait.
- **SHARPNESS**: Shoes must be sharpest part.
- **FIDELITY**: 100% match to product photos.
- **MODEL SIZE**: The model person must occupy the same proportion in the output as in Image 1. Do not shrink the model.
`;

    const images = [
        { data: sourceImageBase64, mimeType: 'image/jpeg' },
        ...productImagesBase64.slice(0, 4).map(b64 => ({ data: b64, mimeType: 'image/jpeg' }))
    ];

    try {
        console.log('=== generateCampaignImage (SECURE) ===');
        console.log(`[AspectInfo] ${aspectInfo ? `${aspectInfo.orientation} (${aspectInfo.aspectRatio})` : 'Not provided (default to 1:1)'}`);

        const result = await callGeminiSecure(EDITING_PROMPT, images);

        if (result.type !== 'image') {
            return { success: false, error: '이미지 생성 응답 없음' };
        }

        console.log('✓ Campaign image generated (SECURE)');
        return {
            success: true,
            imageBase64: result.data,
            aspectRatio: aspectInfo?.aspectRatio
        };

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
