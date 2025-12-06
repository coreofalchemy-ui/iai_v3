/**
 * 🔐 보안 Gemini 서비스
 * 
 * 모든 API 호출은 서버리스 함수(/api/gemini)를 통해 처리됩니다.
 * API 키는 서버에서만 사용되어 브라우저에 노출되지 않습니다.
 */

import { callGeminiSecure, extractBase64, urlToBase64 as urlToBase64Client, GeminiImagePart } from '../../../lib/geminiClient';
import { UploadedImage, LookbookImage, ModelGender, ModelAge, ModelEthnicity } from "../types";

function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 포즈 라이브러리
const MALE_FULL_BODY = [
    `[POSE] Mid-stride walk towards camera. [HANDS] Right hand is raised to upper chest level, Left hand in pant pocket.`,
    `[POSE] Standing still, angled 45-degrees. [HANDS] Left hand raised touching the chin/jawline.`,
    `[POSE] Leaning against a wall, one leg crossed over the other. [HANDS] Arms crossed over chest.`,
    `[POSE] Sitting on a stool, legs spread wide. [HANDS] Hands resting on knees.`,
    `[POSE] Walking away from camera, looking back over shoulder. [HANDS] Hands in pockets.`
];
const FEMALE_FULL_BODY = [
    `[POSE] Standing at a slight 3/4 angle. [HANDS] Both hands loosely clasped together in front of the thighs.`,
    `[POSE] Standing facing forward, weight shifted to one hip. [HANDS] Left hand raised, fingers running through hair.`,
    `[POSE] Walking towards camera, hair blowing in wind. [HANDS] Arms swinging naturally.`,
    `[POSE] Sitting on the floor, legs to one side. [HANDS] One hand on floor for support, other on lap.`,
    `[POSE] Leaning forward, hands on hips. [HANDS] Hands on hips, elbows out.`
];
const MALE_DETAIL_POSES = [`[FRAME] Knee-down shot.`, `[FRAME] Low-angle ground shot.`, `[FRAME] Close up of shoes from side.`];
const FEMALE_DETAIL_POSES = [`[FRAME] Dynamic side stride close-up.`, `[FRAME] Top-down view.`, `[FRAME] Close up of shoes from front.`];

// K-Pop 스타일 헤어
const hairStylesFemale = [
    "long straight black hair with soft layers and natural shine",
    "medium length hime cut inspired style, clean but modern",
    "soft wavy hair with see-through bangs, natural volume",
    "low ponytail with loose front pieces framing the face",
    "short chic bob cut with slight C-curl at the ends"
];
const hairStylesMale = [
    "clean two-block cut with natural volume, light fringe",
    "messy textured hair with soft waves, slightly parted bangs",
    "sleek down perm style with calm fringe, idol styling",
    "modern mullet with subtle layers, not too extreme",
    "grown-out natural waves, slightly tousled idol look"
];
const studioBackgrounds = [
    "solid light grey Korean studio backdrop with soft gradient",
    "clean warm beige backdrop used in beauty editorials",
    "cool pale blue seamless studio background",
    "subtle pastel mint studio wall with very soft texture",
    "solid off-white background with slight falloff in light"
];

// 인종 매핑
const raceMapping: Record<string, string> = {
    "한국인": "Korean", "코리안": "Korean", "동아시아인": "East Asian",
    "아시아인": "East Asian", "백인": "White", "흑인": "Black",
    "히스패닉": "Hispanic/Latino", "중동인": "Middle Eastern", "혼혈": "Mixed race"
};

/**
 * 🔐 얼굴 배치 생성 (보안 버전)
 */
export const generateFaceBatch = async (
    gender: 'male' | 'female',
    race: string,
    age: string,
    referenceFaces: string[] = [],
    count: number = 5
): Promise<string[]> => {
    const genderTerm = gender === 'male' ? 'male' : 'female';

    // 인종별 특화 프롬프트
    const getVibeByRace = (race: string, gender: 'male' | 'female') => {
        if (race === '한국인') {
            return gender === 'female'
                ? "Absolutely stunning top-tier K-POP idol center visual like BLACKPINK Jennie, IVE Jang Wonyoung, Aespa Karina. Perfect sharp V-line jawline, cat-eyes with natural double eyelids, flawless glass skin, small face ratio"
                : "Extremely handsome K-POP idol center visual like BTS V, EXO Cha Eunwoo, Stray Kids Hyunjin. Sharp masculine jawline, intense charismatic gaze, perfect proportions";
        } else if (race === '일본인') {
            return gender === 'female'
                ? "Top Japanese actress beauty like Satomi Ishihara, Suzu Hirose. Soft elegant features, natural beauty, refined and gentle facial structure, clear porcelain skin"
                : "Handsome Japanese actor like Masaki Suda, Takeru Satoh. Clean refined features, natural charisma, masculine but gentle look";
        } else { // 서양인
            return gender === 'female'
                ? "Hollywood A-list actress beauty like Margot Robbie, Gal Gadot. Sharp defined features, striking symmetrical face, elegant bone structure, luminous skin"
                : "Hollywood leading man like Chris Hemsworth, Timothée Chalamet. Chiseled jawline, striking eyes, perfect facial proportions, refined masculine beauty";
        }
    };

    const vibeKeywords = getVibeByRace(race, gender);
    const hairStyles = gender === 'female' ? hairStylesFemale : hairStylesMale;

    const promises = Array(count).fill(null).map(async (_, idx) => {
        try {
            const hairStyle = hairStyles[idx % hairStyles.length];
            const bg = studioBackgrounds[idx % studioBackgrounds.length];

            let prompt = `
[SUBJECT] Close-up portrait of a ${age}-year-old ${race} ${genderTerm}.
[BEAUTY STANDARD] ${vibeKeywords}
[COMPOSITION] Face MUST be perfectly CENTERED in the frame. Eyes at center of image.
[QUALITY] Professional studio photography. Sharp focus, perfect lighting. Standard resolution.
[HAIR] ${hairStyle}
[BACKGROUND] ${bg}
[STYLE] High-end beauty editorial, fashion magazine cover worthy.
[CRITICAL] Extremely beautiful/handsome face only. Sharp facial lines, perfect symmetry.
[FRAMING] Face fills 70-80% of frame. NO cropping of forehead or chin. Full face visible.
[AVOID] Off-center, crooked, tilted, cropped faces. Ugly, distorted, asymmetric.
`;

            const images: GeminiImagePart[] = [];
            if (referenceFaces.length > 0) {
                const refFace = referenceFaces[idx % referenceFaces.length];
                images.push(extractBase64(refFace));
                prompt += `\n[CRITICAL: IDENTITY PRESERVATION] The output face MUST look exactly like the provided reference.`;
            }

            // 해상도 낮춤: 1K -> 표준
            const result = await callGeminiSecure(prompt, images, { aspectRatio: '1:1' });

            if (result.type === 'image') {
                return result.data;
            }
            return null;
        } catch (e) {
            console.error(`Face #${idx} failed:`, e);
            return null;
        }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter((img): img is string => img !== null);
    return validResults;
};

/**
 * 🔐 후보 모델 생성 (보안 버전)
 */
export const generateCandidatesStream = async (
    refImages: UploadedImage[],
    gender: ModelGender,
    age: ModelAge,
    ethnicity: ModelEthnicity,
    onImageGenerated: (img: LookbookImage) => void,
    targetFaceImage?: string | null
): Promise<void> => {
    const genderTerm = gender === 'w' ? 'FEMALE' : 'MALE';
    const tasks = Array.from({ length: 5 }).map((_, i) => ({
        seed: Math.random() * 10000000,
        index: i,
        refImage: refImages[i % refImages.length]
    }));

    for (const task of tasks) {
        try {
            const images: GeminiImagePart[] = [{ data: task.refImage.base64, mimeType: task.refImage.mimeType }];

            let prompt = '';
            if (targetFaceImage) {
                const faceBase64 = targetFaceImage.includes('base64,') ? targetFaceImage.split('base64,')[1] : targetFaceImage;
                images.push({ data: faceBase64, mimeType: 'image/png' });
                prompt = `[TASK: IDENTITY SWAP] Replace the face in Image 1 with the identity from Image 2. Keep pose and outfit EXACTLY.`;
            } else {
                prompt = `[TASK: IDENTITY SWAP] INPUT: A reference photo. GOAL: Keep Body/Outfit IDENTICAL. Replace HEAD. GENERATE: ${genderTerm} model, ${age} years old, ${ethnicity}.`;
            }

            const result = await callGeminiSecure(prompt, images, { aspectRatio: '3:4' });
            if (result.type === 'image') {
                onImageGenerated({ url: result.data, type: 'candidate', promptUsed: `Ref ${task.index + 1}` });
            }
        } catch (e) {
            console.error(e);
        }
    }
};

/**
 * 🔐 최종 룩북 생성 (보안 버전)
 */
export const generateFinalLookbookStream = async (
    candidateImageUrl: string,
    refImages: UploadedImage[],
    productImages: UploadedImage[],
    bgImage: UploadedImage | null,
    gender: ModelGender,
    useFilter: boolean,
    onImageGenerated: (img: LookbookImage) => void,
    excludePrompts: string[] = []
): Promise<void> => {
    const candidateBase64 = await urlToBase64Client(candidateImageUrl);
    const fullBodyLibrary = gender === 'w' ? FEMALE_FULL_BODY : MALE_FULL_BODY;
    const detailLibrary = gender === 'w' ? FEMALE_DETAIL_POSES : MALE_DETAIL_POSES;
    const selectedFullBody = shuffleArray([...fullBodyLibrary]).slice(0, 3);
    const selectedDetail = shuffleArray([...detailLibrary]).slice(0, 3);
    const filterPrompt = useFilter ? `[FILTER: FILM LOOK] Analog Film Photography, Grain.` : `[FILTER: DIGITAL CLEAN] Ultra-sharp 8K.`;

    const systemPrompt = `[TASK: FASHION LOOKBOOK] Input 1: MODEL. Input 2~5: PRODUCT SHOES. RULES: Create NEW GEOMETRY. KEEP Face, Outfit from Input 1. PRODUCT IDENTITY LOCK. NO SPLIT SCREEN. ${filterPrompt}`;

    const tasks = [
        { type: 'model', prompt: `[SHOT 1] FULL-BODY. POSE: ${selectedFullBody[0]}` },
        { type: 'model', prompt: `[SHOT 2] FULL-BODY. POSE: ${selectedFullBody[1]}` },
        { type: 'model', prompt: `[SHOT 3] FULL-BODY. POSE: ${selectedFullBody[2]}` },
        { type: 'detail', prompt: `[SHOT 4] DETAIL KNEE-DOWN. POSE: ${selectedDetail[0]}` },
        { type: 'detail', prompt: `[SHOT 5] DETAIL KNEE-DOWN. POSE: ${selectedDetail[1]}` },
        { type: 'detail', prompt: `[SHOT 6] DETAIL KNEE-DOWN. POSE: ${selectedDetail[2]}` }
    ];

    for (const task of tasks) {
        try {
            const images: GeminiImagePart[] = [{ data: candidateBase64, mimeType: 'image/png' }];
            productImages.slice(0, 4).forEach(img => images.push({ data: img.base64, mimeType: img.mimeType }));
            if (bgImage) images.push({ data: bgImage.base64, mimeType: bgImage.mimeType });

            const result = await callGeminiSecure(`${systemPrompt}\n\n${task.prompt}`, images, { aspectRatio: '9:16' });
            if (result.type === 'image') {
                onImageGenerated({ url: result.data, type: task.type as any, promptUsed: task.prompt });
            }
        } catch (e) {
            console.error(e);
        }
    }
};

/**
 * 🔐 얼굴 업스케일 (보안 버전)
 */
export const upscaleFace = async (base64Image: string): Promise<string> => {
    const base64 = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
    const prompt = `Upscale this face image. High resolution, highly detailed, sharp focus, improve skin texture and lighting. Keep identity exactly the same.`;

    const result = await callGeminiSecure(prompt, [{ data: base64, mimeType: 'image/png' }], { aspectRatio: '1:1' });
    if (result.type !== 'image') throw new Error('Upscale failed');
    return result.data;
};
/**
 * 🔐 얼굴 교체 (보안 버전) - 원본 하드락 + 얼굴 마스킹 방식
 */
export const replaceFaceInImage = async (
    targetImageBase64: string,
    sourceFaceBase64: string
): Promise<string> => {
    const targetB64 = targetImageBase64.includes('base64,') ? targetImageBase64.split('base64,')[1] : targetImageBase64;
    const faceB64 = sourceFaceBase64.includes('base64,') ? sourceFaceBase64.split('base64,')[1] : sourceFaceBase64;

    const prompt = `[TASK: FACE-ONLY REPLACEMENT WITH TONE MATCHING]

[IMAGE 1] TARGET - The original photo (THIS IS SACRED - DO NOT MODIFY ANYTHING EXCEPT FACE)
[IMAGE 2] SOURCE - The new face to use

[STEP 1: FACE DETECTION]
If NO human face in Image 1 → Return Image 1 100% UNCHANGED.

[STEP 2: FACE MASK IDENTIFICATION]
- Identify the EXACT face region in Image 1 (forehead to chin, ear to ear)
- This is the ONLY area that will be modified
- Everything outside this mask = UNTOUCHABLE

[STEP 3: FACE REPLACEMENT - INPAINTING STYLE]
REPLACE the face region with the identity from Image 2:
1. Scale the new face to EXACTLY match the original face size
2. Position at EXACTLY the same location
3. Match head angle/tilt EXACTLY

[STEP 4: TONE & COLOR MATCHING - CRITICAL]
- Analyze Image 1's color temperature (warm/cool)
- Analyze Image 1's lighting direction and intensity
- Analyze Image 1's skin tone and saturation
- Apply these EXACT same values to the new face
- The new face MUST look like it was photographed in the same conditions

[HARD LOCK - VIOLATIONS = FAILURE]
✗ DO NOT redraw the body
✗ DO NOT redraw the clothing
✗ DO NOT redraw the background
✗ DO NOT change image dimensions
✗ DO NOT crop or zoom
✗ DO NOT change the overall image tone
✓ ONLY replace the face+hair region
✓ BLEND edges seamlessly
✓ MATCH original photo's color grading

[OUTPUT]
Original photo with ONLY the face area replaced. New face should look native to the original photo's lighting and tone.`;

    const result = await callGeminiSecure(prompt, [
        { data: targetB64, mimeType: 'image/png' },
        { data: faceB64, mimeType: 'image/png' }
    ]);

    if (result.type !== 'image') throw new Error('Face replacement failed');
    return result.data;
};

/**
 * 🔐 일괄 얼굴 교체 (보안 버전)
 */
export const batchFaceReplacement = async (
    targetImageUrls: string[],
    sourceFaceBase64: string,
    onProgress?: (current: number, total: number) => void
): Promise<Array<{ original: string; result: string | null; error?: string }>> => {
    const results: Array<{ original: string; result: string | null; error?: string }> = [];

    for (let i = 0; i < targetImageUrls.length; i++) {
        const targetUrl = targetImageUrls[i];
        onProgress?.(i + 1, targetImageUrls.length);

        try {
            let targetBase64 = targetUrl;
            if (!targetUrl.includes('base64,')) {
                targetBase64 = await urlToBase64Client(targetUrl);
            }
            const result = await replaceFaceInImage(targetBase64, sourceFaceBase64);
            results.push({ original: targetUrl, result });
        } catch (e: any) {
            console.error(`❌ Failed to replace face in image ${i + 1}:`, e);
            results.push({ original: targetUrl, result: null, error: e.message });
        }
    }

    return results;
};

// urlToBase64 재수출
export { urlToBase64Client as urlToBase64 };
