/**
 * Original Generation Service
 * 
 * 원본 생성 모드 로직:
 * 1. 마스터 컷: 신발 교체 (Aggressive Swap)
 * 2. 포즈 변경: 업로드된 40가지 포즈 사용
 * 3. 클로즈업: 하반신 크롭 생성
 */

import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const MODEL_NAME = 'gemini-3-pro-image-preview';

const getApiKey = (): string | undefined => {
    if (import.meta.env.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
    return undefined;
};

const getAI = () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("AUTH_ERROR");
    return new GoogleGenAI({ apiKey });
};

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

// ============================================================================
// TYPES
// ============================================================================

export interface ImageAsset {
    url: string;
    generatingParams: { pose: string };
}

// ============================================================================
// HELPERS
// ============================================================================

const withTimeout = <T>(promise: Promise<T>, ms: number = 90000, msg: string = "Timeout"): Promise<T> => {
    let id: ReturnType<typeof setTimeout>;
    const tp = new Promise<T>((_, rej) => { id = setTimeout(() => rej(new Error(msg)), ms); });
    return Promise.race([promise.then(r => { clearTimeout(id); return r; }), tp]);
};

const fileToGenerativePart = async (file: File) => {
    const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
    });
    return { inlineData: { data: b64, mimeType: file.type } };
};

const dataUrlToGenerativePart = (url: string) => {
    const b64 = url.split(',')[1];
    const mime = url.match(/data:(.*?);base64/)?.[1] || 'image/png';
    return { inlineData: { data: b64, mimeType: mime } };
};

const fileToDataUrl = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
});

// ============================================================================
// 1. 신발 정밀 교체 (Aggressive Swap)
// ============================================================================

export async function regenerateShoesOnly(
    baseImageUrl: string,
    productFiles: File[]
): Promise<string> {
    console.log('👟 regenerateShoesOnly: Starting...');
    const ai = getAI();
    const basePart = dataUrlToGenerativePart(baseImageUrl);
    const prodParts = await Promise.all(productFiles.map(fileToGenerativePart));

    const prompt = `// --- PROTOCOL: AGGRESSIVE_SHOE_REPLACEMENT ---
// TASK: COMPLETELY ERASE old shoes and paint PRODUCT_IMAGES on the feet.
// OUTPUT FORMAT: Portrait (3:4).
//
// [INSTRUCTIONS]
// 1. TARGET: Identify the feet/shoes area in BASE_IMAGE.
// 2. ACTION: REPLACE the shoes with the exact design, color, and texture from PRODUCT_IMAGES.
// 3. IDENTITY LOCK: EVERYTHING ELSE (Face, Hair, Trousers, Background, Skin) MUST BE IDENTICAL PIXEL-FOR-PIXEL.
// 4. INTEGRATION: Ensure realistic lighting and shadows on the new shoes.
// 5. MANDATORY: The resulting shoes MUST be the new product. DO NOT output the original shoes.
//
// [CRITICAL PIXEL RULES - SHOE FIDELITY 100%]
// - TEXTURE: 질감 완벽 보존 (가죽, 메쉬, 스웨이드)
// - SIZE: 원본 비율 그대로
// - OUTSOLE: 아웃솔 형태 절대 변형 금지
// - DESIGN: 디자인 라인 100% 복제
// - STITCHING: 재봉선 정확히 재현
// - LACES: 신끈 패턴 그대로
// - LOGO: 로고 위치, 크기, 색상 완벽 일치
//
// DO NOT just blend. SWAP them. IGNORE ORIGINAL SHOES.`;

    const resp = await withTimeout(ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [{ text: prompt }, { text: "BASE_IMAGE:" }, basePart, { text: "PRODUCT_IMAGES:" }, ...prodParts] },
        config: {
            // @ts-ignore
            imageConfig: { aspectRatio: '3:4' },
            safetySettings: SAFETY_SETTINGS
        }
    }), 90000, "신발 교체 시간 초과");

    const img = resp.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
    if (!img?.inlineData) throw new Error("Shoe swap failed");
    console.log('✅ regenerateShoesOnly: Complete');
    return `data:${img.inlineData.mimeType};base64,${img.inlineData.data}`;
}

// ============================================================================
// 2. 포즈 변경 (업로드된 40가지 포즈 라이브러리 사용)
// ============================================================================

export async function regenerateImageWithSpecificPose(
    baseImageUrl: string,
    pose: string
): Promise<ImageAsset> {
    console.log(`🎭 regenerateImageWithSpecificPose: ${pose.substring(0, 50)}...`);
    const ai = getAI();
    const srcPart = dataUrlToGenerativePart(baseImageUrl);

    const prompt = `// --- TASK: POSE_MODIFICATION ---
// CHANGE POSE TO: ${pose}
// OUTPUT: Portrait (3:4).
//
// [RULES]
// 1. FACE & IDENTITY: MUST MATCH SOURCE.
// 2. CLOTHING: Keep upper body clothing identical.
// 3. SHOES: Keep the shoes PIXEL-PERFECT identical.
// 4. BACKGROUND: Keep the background identical.
//
// [CRITICAL SHOE RULES]
// - TEXTURE, OUTSOLE, STITCHING, LACES, LOGO = 100% identical to source.
// - DO NOT modify shoe design in any way.
//
// Output: Full body shot, Portrait.`;

    const resp = await withTimeout(ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [{ text: prompt }, { text: "REFERENCE_IMAGE:" }, srcPart] },
        config: {
            // @ts-ignore
            imageConfig: { aspectRatio: '3:4' },
            safetySettings: SAFETY_SETTINGS
        }
    }), 90000, "자세 변경 시간 초과");

    const img = resp.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
    if (!img?.inlineData) throw new Error("Pose change failed");
    console.log('✅ regenerateImageWithSpecificPose: Complete');
    return { url: `data:${img.inlineData.mimeType};base64,${img.inlineData.data}`, generatingParams: { pose } };
}

// ============================================================================
// 3. 하반신 크롭 (Vertical Leg Crop)
// ============================================================================

export async function generateVerticalLegsCrop(baseImageUrl: string): Promise<string> {
    console.log('🦵 generateVerticalLegsCrop: Creating...');
    const ai = getAI();
    const basePart = dataUrlToGenerativePart(baseImageUrl);

    const prompt = `// --- TASK: PORTRAIT_LEG_SHOT_GENERATION ---
// ACTION: Generate a PORTRAIT IMAGE (3:4) focusing on the model's legs and shoes.
// SOURCE: Use the provided SOURCE_IMAGE.
//
// [COMPOSITION RULES]
// 1. FRAME: The image MUST be Portrait (3:4).
// 2. CROP: Cut off at the waist. Show waist down to feet.
// 3. FILL: The legs must fill the frame compositionally.
// 4. IDENTITY: Keep the trousers, skin tone, and shoes PIXEL-PERFECT identical to source.
//
// [CRITICAL SHOE RULES]
// - TEXTURE, OUTSOLE, STITCHING, LACES, LOGO = 100% identical.
//
// Output: High resolution portrait photograph.`;

    const resp = await withTimeout(ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [{ text: prompt }, { text: "SOURCE_IMAGE:" }, basePart] },
        config: {
            // @ts-ignore
            imageConfig: { aspectRatio: '3:4' },
            safetySettings: SAFETY_SETTINGS
        }
    }), 90000, "클로즈업 생성 시간 초과");

    const img = resp.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
    if (!img?.inlineData) throw new Error("Leg crop failed");
    console.log('✅ generateVerticalLegsCrop: Complete');
    return `data:${img.inlineData.mimeType};base64,${img.inlineData.data}`;
}

// ============================================================================
// 병렬 처리 헬퍼
// ============================================================================

async function generateVariations(base: ImageAsset, poses: { prompt: string, name: string }[]): Promise<ImageAsset[]> {
    const results = await Promise.all(poses.map(async p => {
        try {
            const a = await regenerateImageWithSpecificPose(base.url, p.prompt);
            return { ...a, generatingParams: { pose: p.name } };
        } catch (e) {
            console.error(`Failed: ${p.name}:`, e);
            return null;
        }
    }));
    return results.filter((r): r is ImageAsset => r !== null);
}

// ============================================================================
// 메인 진입점: 원본 생성 세트 생성
// ============================================================================

export async function generateInitialOriginalSet(
    productFiles: File[],
    modelFiles: File[],
    onProgress?: (msg: string) => void,
    fullBodyPoses?: { prompt: string, name: string }[],
    closeupPoses?: { prompt: string, name: string }[]
): Promise<{ modelShots: ImageAsset[], closeupShots: ImageAsset[] }> {
    console.log('🚀 generateInitialOriginalSet: Starting...');

    // 기본 포즈 (사용자 제공 안한 경우)
    const defaultFullBodyPoses = [
        { name: 'Walking', prompt: 'Walking forward towards camera. Dynamic stride. Shoes clearly visible.' },
        { name: 'Crossed Legs', prompt: 'Standing with legs crossed casually. Relaxed fashion stance.' }
    ];
    const defaultCloseupPoses = [
        { name: 'Side Step', prompt: 'Close-up: Feet from the side profile, taking a step.' },
        { name: '45 Degree', prompt: 'Close-up: Feet at 45-degree angle showing front and side.' }
    ];

    const usedFullBodyPoses = fullBodyPoses || defaultFullBodyPoses;
    const usedCloseupPoses = closeupPoses || defaultCloseupPoses;

    // 1. 마스터 컷 생성 (모델 전신 + 신발 교체)
    onProgress?.('1/5: 모델 전신 마스터 컷 생성 중 (신발 교체)...');
    const mainModelFile = modelFiles.length > 1 ? modelFiles[1] : modelFiles[0];
    const originalModelUrl = await fileToDataUrl(mainModelFile);
    const masterSwappedImageUrl = await regenerateShoesOnly(originalModelUrl, productFiles);
    const masterModelAsset: ImageAsset = { url: masterSwappedImageUrl, generatingParams: { pose: 'Front View (Master)' } };

    // 2. 전신 포즈 변형 생성 (병렬 처리)
    onProgress?.('2/5: 전신 컷 변형 생성 중 (병렬 처리)...');
    const modelVariationsPromise = generateVariations(masterModelAsset, usedFullBodyPoses);

    // 3. 하반신 클로즈업 마스터 컷 생성 (크롭)
    onProgress?.('3/5: 하반신 클로즈업 마스터 컷 생성 중...');
    const frontCloseupUrl = await generateVerticalLegsCrop(masterSwappedImageUrl);
    const masterCloseupAsset: ImageAsset = { url: frontCloseupUrl, generatingParams: { pose: 'Original Leg Crop' } };

    // 4. 클로즈업 포즈 변형 생성 (병렬 처리)
    onProgress?.('4/5: 클로즈업 변형 생성 중 (병렬 처리)...');
    const closeupVariationsPromise = generateVariations(masterCloseupAsset, usedCloseupPoses);

    // 5. 모든 작업 완료 대기
    onProgress?.('5/5: 모든 이미지 마무리 중...');
    const [modelVariations, closeupVariations] = await Promise.all([modelVariationsPromise, closeupVariationsPromise]);

    const modelShots = [masterModelAsset, ...modelVariations];
    const closeupShots = [masterCloseupAsset, ...closeupVariations];

    console.log(`✅ generateInitialOriginalSet: Complete! Model: ${modelShots.length}, Closeup: ${closeupShots.length}`);
    return { modelShots, closeupShots };
}
