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
 * 홀드된 모델 이미지에서 얼굴/헤어만 완전히 다르게 변경합니다.
 * 반드시 실사(Photo-realistic)로 출력됩니다.
 */
export const generateFaceBatch = async (
    gender: 'male' | 'female',
    race: string,
    age: string,
    baseModelUrl: string, // 홀드된 모델 이미지
    count: number = 5,
    referenceFaces: string[] = [] // 참고 얼굴 (선택적)
): Promise<string[]> => {
    // Extract base64 from the held model image
    const baseModelB64 = baseModelUrl.includes('base64,')
        ? baseModelUrl.split('base64,')[1]
        : await urlToBase64Client(baseModelUrl);

    const genderKorean = gender === 'female' ? '여성' : '남성';
    const genderTerm = gender === 'female' ? 'woman' : 'man';

    // 각각 완전히 다른 사람을 위한 unique 시드
    const uniqueSeeds = [
        `Person-Alpha-${Date.now()}-${Math.random()}`,
        `Person-Beta-${Date.now()}-${Math.random()}`,
        `Person-Gamma-${Date.now()}-${Math.random()}`,
        `Person-Delta-${Date.now()}-${Math.random()}`,
        `Person-Epsilon-${Date.now()}-${Math.random()}`,
        `Person-Zeta-${Date.now()}-${Math.random()}`
    ];

    // 다양한 외모 특성 (각각 완전히 다른 사람)
    const appearances = [
        { faceShape: "round face", eyes: "big round eyes", nose: "small cute nose", hair: "long straight black hair", expression: "gentle smile" },
        { faceShape: "oval face", eyes: "sharp cat-like eyes", nose: "high nose bridge", hair: "short wavy brown hair", expression: "confident look" },
        { faceShape: "heart-shaped face", eyes: "almond-shaped eyes", nose: "button nose", hair: "medium auburn hair with bangs", expression: "bright smile" },
        { faceShape: "square jaw", eyes: "monolid eyes", nose: "straight nose", hair: "shoulder-length dark hair", expression: "serious gaze" },
        { faceShape: "diamond face", eyes: "double eyelid large eyes", nose: "refined nose", hair: "long wavy blonde hair", expression: "soft expression" },
        { faceShape: "V-line face", eyes: "deer-like innocent eyes", nose: "petite nose", hair: "bob cut with highlights", expression: "playful smile" }
    ];

    const promises = Array(count).fill(null).map(async (_, idx) => {
        try {
            const appearance = appearances[idx % appearances.length];
            const uniqueId = uniqueSeeds[idx % uniqueSeeds.length];

            // 참고 얼굴이 있으면 사용
            const hasReference = referenceFaces.length > 0;
            const refFace = hasReference ? referenceFaces[idx % referenceFaces.length] : null;
            const refFaceB64 = refFace
                ? (refFace.includes('base64,') ? refFace.split('base64,')[1] : refFace)
                : null;

            let prompt: string;
            let images: GeminiImagePart[];

            if (hasReference && refFaceB64) {
                prompt = `
[PHOTO EDITING TASK - REFERENCE BASED]
Edit this fashion photograph. Replace ONLY the model's face and hair with someone who resembles the reference.

REFERENCE IDENTITY (Image 1): Use this face as the identity reference.
ORIGINAL PHOTO (Image 2): Edit this photo - keep everything except face/hair.

OUTPUT REQUIREMENTS:
- The result MUST be a REAL PHOTOGRAPH, not illustration or CGI
- Face should closely resemble the reference image
- Hair: ${appearance.hair}
- Age: ${age} years old
- Ethnicity: ${race}
- KEEP: exact same outfit, pose, body, background, lighting, shadows
- MAINTAIN: original photo quality and style (NOT cartoon, NOT 3D render)

CRITICAL: Output must be indistinguishable from a real fashion photograph.
`;
                images = [
                    { data: refFaceB64, mimeType: 'image/png' },
                    { data: baseModelB64, mimeType: 'image/png' }
                ];
            } else {
                prompt = `
[MANDATORY FACE REPLACEMENT TASK]

⚠️ CRITICAL WARNING: The original model's face CANNOT appear in the output. 
You MUST replace the face with a COMPLETELY DIFFERENT person.

UNIQUE PERSON ID: ${uniqueId}
Each generated image must show a DIFFERENT unique individual.

MANDATORY NEW FACE SPECIFICATIONS:
- Face shape: ${appearance.faceShape}
- Eyes: ${appearance.eyes}  
- Nose: ${appearance.nose}
- Hair color and style: ${appearance.hair}
- Expression: ${appearance.expression}
- Gender: ${genderTerm}
- Age: EXACTLY ${age} years old (reflect this in the face)
- Ethnicity: ${race} (facial features must match this ethnicity)

ABSOLUTE REQUIREMENTS:
1. The face MUST be a DIFFERENT person - NOT the original model
2. The new face MUST match the specifications above
3. Output MUST be a REAL PHOTOGRAPH (not cartoon/CGI/illustration)
4. Skin must have natural texture with pores and realistic lighting
5. The new face must blend naturally with the original photo's lighting

PRESERVE EXACTLY:
- All clothing and outfit
- Body pose and position
- Background
- Lighting direction and shadows
- Image dimensions and quality

⛔ FORBIDDEN:
- Keeping the original model's face
- Cartoon/anime/doll-like appearance
- Artificial or plastic-looking skin
- CGI or 3D rendered look

OUTPUT: A real fashion photograph with a COMPLETELY NEW ${race} ${genderTerm} aged ${age}.
`;
                images = [{ data: baseModelB64, mimeType: 'image/png' }];
            }

            const result = await callGeminiSecure(prompt, images, { temperature: 0.75 });

            if (result.type === 'image') {
                return result.data;
            }
            return null;
        } catch (e) {
            console.error(`Model variation #${idx} failed:`, e);
            return null;
        }
    });

    const results = await Promise.all(promises);
    return results.filter((img): img is string => img !== null);
};


/**
 * 🔐 옷 입히기 (Apply Outfit to Model)
 * 선택된 전신 모델(Base)에 홀드된 이미지(Outfit)를 입힘
 */
export const applyOutfitToModel = async (
    baseModelBase64: string,      // 선택된 전신 모델 (흰티+청바지)
    outfitRefBase64: string,      // 옷/신발 레퍼런스 (홀드된 이미지)
    gender: 'm' | 'w'
): Promise<string> => {
    const baseB64 = baseModelBase64.includes('base64,') ? baseModelBase64.split('base64,')[1] : baseModelBase64;
    const outfitB64 = outfitRefBase64.includes('base64,') ? outfitRefBase64.split('base64,')[1] : outfitRefBase64;

    const prompt = `
**[TASK: FASHION TRY-ON / OUTFIT TRANSFER]**

You have TWO images:
1. **BASE MODEL** (The person wearing white t-shirt & jeans)
2. **OUTFIT REFERENCE** (The clothes and shoes to transfer)

---

**[INSTRUCTION]**

Dress the **BASE MODEL** in the **OUTFIT REFERENCE**.

**[RULES]**
1. **KEEP THE PERSON**: The final image MUST show the EXACT same person from the BASE MODEL image.
   - Same face, same hair, same body proportions (9-head tall).
   - Same pose (unless outfit requires slight adjustment).
   
2. **CHANGE THE OUTFIT**: Replace the white t-shirt and jeans with the outfit from the REFERENCE image.
   - Copy the Top (shirt/jacket/etc.) matches REFERENCE.
   - Copy the Bottom (pants/skirt/etc.) matches REFERENCE.
   - **CRITICAL**: Copy the **SHOES** exactly from the REFERENCE.
   
3. **BACKGROUND**: 
   - Use a background that matches the vibe of the OUTFIT REFERENCE.
   - Or keep it clean/studio if the reference is clean.

**[OUTPUT]**
- High Quality Fashion Photo (1K)
- Full Body Shot
- The BASE MODEL wearing the REFERENCE OUTFIT.
`;

    const result = await callGeminiSecure(prompt, [
        { data: baseB64, mimeType: 'image/png' },
        { data: outfitB64, mimeType: 'image/png' }
    ], {
        temperature: 0.4, // 일관성 유지
        aspectRatio: '9:16'
    });

    if (result.type !== 'image') throw new Error('Outfit application failed');
    return result.data;
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
 * 🔐 전체 모델 재생성 (Full Model Regeneration) - 2단계 방식
 * Step 1: 선택된 얼굴로 모델 전신을 먼저 생성
 * Step 2: 그 모델에게 홀드된 이미지의 옷/신발을 입힘
 */
export const replaceFaceInImage = async (
    targetImageBase64: string,
    sourceFaceBase64: string
): Promise<string> => {
    const targetB64 = targetImageBase64.includes('base64,') ? targetImageBase64.split('base64,')[1] : targetImageBase64;
    const faceB64 = sourceFaceBase64.includes('base64,') ? sourceFaceBase64.split('base64,')[1] : sourceFaceBase64;

    // ============================================
    // STEP 1: 선택된 얼굴로 기본 모델 전신 생성
    // ============================================
    const step1Prompt = `
**[STEP 1: 패션 모델 전신 생성]**

이 사람(제공된 이미지)의 전신 패션 모델 사진을 생성해주세요.

**[모델 사양]**
- 이 사람의 얼굴을 그대로 사용
- 같은 피부톤, 비슷한 헤어스타일
- 키가 크고 슬림한 패션 모델 비율
- 자연스러운 서있는 자세

**[임시 의상]**
- 심플한 흰색 티셔츠와 청바지
- 깔끔한 운동화
- (이 옷은 나중에 교체될 예정)

**[배경]**
- 깔끔한 회색 스튜디오 배경

**[화질]**
- 8K 해상도, 선명하고 깨끗하게
- 프로 패션 사진 품질

**[출력]**: 전신 패션 모델 사진, 세로형 (3:4)
`;

    const step1Result = await callGeminiSecure(step1Prompt, [
        { data: faceB64, mimeType: 'image/png' }  // 얼굴 이미지만 전달
    ], {
        temperature: 0.6,
        aspectRatio: '3:4'
    });

    if (step1Result.type !== 'image') throw new Error('Step 1: Model generation failed');

    const baseModelB64 = step1Result.data;

    // ============================================
    // STEP 2: 생성된 모델에게 착장 입히기
    // ============================================
    const step2Prompt = `
**[STEP 2: 모델에게 옷 입히기]**

두 장의 이미지가 주어집니다:
- **IMAGE 1**: 이 모델 (방금 생성된 모델)
- **IMAGE 2**: 이 옷을 입혀야 함 (착장 참고)

**[작업]**
IMAGE 1의 모델에게 IMAGE 2의 옷을 입혀주세요.

**[유지할 것 - IMAGE 1에서]**
- 얼굴 그대로 유지
- 헤어스타일 유지
- 피부톤 유지
- 전체적인 자세는 자연스럽게 유지하거나 약간 변형 가능

**[가져올 것 - IMAGE 2에서]**
- 코트, 니트, 셔츠, 바지 등 모든 의류
- 신발 (디테일까지 정확하게)
- 모자, 액세서리 등
- 같은 색상, 같은 소재감

**[배경]**
- IMAGE 2와 비슷한 배경으로 변경

**[화질]**
- 8K 해상도, 선명하게
- 프로 패션 사진 품질

**[출력]**: IMAGE 1의 모델이 IMAGE 2의 옷을 입고 있는 전신 사진
`;

    const step2Result = await callGeminiSecure(step2Prompt, [
        { data: baseModelB64, mimeType: 'image/png' },  // IMAGE 1: Step 1에서 생성된 모델
        { data: targetB64, mimeType: 'image/png' }      // IMAGE 2: 착장 참고 이미지
    ], {
        temperature: 0.5,
        aspectRatio: '3:4'
    });

    if (step2Result.type !== 'image') throw new Error('Step 2: Outfit application failed');
    return step2Result.data;
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
            console.error(`❌ Failed to replace face in image ${i + 1}: `, e);
            results.push({ original: targetUrl, result: null, error: e.message });
        }
    }

    return results;
};

/**
 * 🔐 모델 재생성: 선택된 얼굴로 새 모델 생성 (원본 사이즈/비율 유지)
 */
export const generateBaseModelFromFace = async (
    sourceFaceBase64: string,
    referenceImageBase64: string,
    gender: 'm' | 'w',
    strength: 'safe' | 'creative' = 'safe'
): Promise<string> => {
    const faceB64 = sourceFaceBase64.includes('base64,')
        ? sourceFaceBase64.split('base64,')[1]
        : sourceFaceBase64;
    const refB64 = referenceImageBase64.includes('base64,')
        ? referenceImageBase64.split('base64,')[1]
        : referenceImageBase64;

    const noiseLevel = strength === 'safe' ? 0.35 : 0.55;

    // 4-1) 공통 Face Identity Lock 블록
    const FACE_IDENTITY_LOCK_BLOCK = `
[FACE IDENTITY LOCK]
Use the face identity from the reference face image (IMAGE 1).
Keep the same facial structure, eyes, nose, mouth, and jawline.
Do not change the age, gender, or ethnicity.
Do not change the head angle or head position unless necessary for blending.
Blend the neck, jawline, and hair naturally into the original body.
No mask effect, no sticker-like edges, no harsh cut around the face.
    `;

    // 4-3) 네거티브 프롬프트
    const negativePrompt = `
No extra faces, no duplicated head.
No mask, no helmet, no sunglasses, no face covering.
No cartoon, no illustration, no anime.
No body distortion, no extra limbs, no broken fingers.
No text, no watermark, no logo.
No heavy beauty filter, no plastic skin.
No Big Head, No Chibi, No distorted proportions.
    `;

    const prompt = `
**[TASK: MODEL FACE REPAINT]**

You have two inputs:
- **IMAGE 1**: The Reference Face Identity (Target).
- **IMAGE 2**: The Base Model Photo (Scene, Body, Outfit).

**[INSTRUCTION]**
Repaint the face of the model in IMAGE 2 using the identity from IMAGE 1, while strictly preserving the original scene.

[SCENE]
Keep the original pose, body shape, outfit, lighting, and background
exactly the same as the base image (IMAGE 2).
Match the lighting direction and color tone of IMAGE 2.

[FACE]
Replace only the face with the reference face identity (IMAGE 1).
Do not change the hairstyle direction too much.
Maintain realistic skin texture and pores.

${FACE_IDENTITY_LOCK_BLOCK}

[FRAMING]
Keep the same camera angle and framing as the base image.
Do not crop the head or feet.

[NEGATIVE RULES]
${negativePrompt}
    `;

    const result = await callGeminiSecure(prompt, [
        { data: faceB64, mimeType: 'image/png' },   // IMAGE 1: 타겟 얼굴
        { data: refB64, mimeType: 'image/png' }     // IMAGE 2: 원본 바디/착장
    ], {
        temperature: noiseLevel, // Strength determines creativity/noise
        // aspectRatio 제거 - 원본 이미지 비율 유지
    });

    if (result.type !== 'image') throw new Error('Model generation failed');
    return result.data;
};

/**
 * 🔐 2단계: 베이스 모델에 옷/신발 입히기
 */
export const applyOutfitToBaseModel = async (
    baseModelBase64: string,      // 1단계 결과 (새로 그린 모델)
    outfitRefBase64: string       // 홀드된 이미지 (옷/신발 참고용)
): Promise<string> => {
    const baseB64 = baseModelBase64.includes('base64,')
        ? baseModelBase64.split('base64,')[1]
        : baseModelBase64;
    const outfitB64 = outfitRefBase64.includes('base64,')
        ? outfitRefBase64.split('base64,')[1]
        : outfitRefBase64;

    const prompt = `
[ROLE]
패션 사진 합성 아티스트.

[IMAGE 1: BASE MODEL]
- 여기 있는 사람의 "얼굴, 헤어스타일, 몸 비율, 포즈"는 그대로 유지한다.
- 얼굴이 바뀌면 실패다.
- 몸의 포즈, 다리 각도, 팔 위치도 웬만하면 유지해라.

[IMAGE 2: OUTFIT REFERENCE]
- 여기 있는 "옷과 신발"만 복사한다.
- 얼굴, 머리, 체형, 배경은 무시한다.

[TASK]
- IMAGE 1에 있는 사람에게
  IMAGE 2에 있는 옷과 신발을 최대한 비슷하게 입혀라.
- 핏, 비율, 기장, 소재, 색감은 IMAGE 2를 참고한다.
- 하지만 몸과 얼굴은 반드시 IMAGE 1 사람이어야 한다.

[HARD RULES]
- 얼굴은 무조건 IMAGE 1.
- IMAGE 2 얼굴을 쓰면 실패.
- 신발은 IMAGE 2와 최대한 같게.
- 배경은 IMAGE 1 스타일을 유지해도 되고,
  전체 톤이 어색하지 않게만 맞춰라.

[QUALITY]
- Ultra sharp, high resolution.
- 다리/신발이 흐리거나 잘리면 실패.
- 신발, 바지 끝, 바닥 그림자가 자연스럽게 연결되게.
`;

    const result = await callGeminiSecure(prompt, [
        { data: baseB64, mimeType: 'image/png' },   // IMAGE 1: 베이스
        { data: outfitB64, mimeType: 'image/png' }, // IMAGE 2: 옷 레퍼런스
    ], { aspectRatio: '9:16', temperature: 0.5 });

    if (result.type !== 'image') throw new Error('Outfit application failed');
    return result.data;
};

/**
 * 🔐 자동 모델 생성: 얼굴 없이 신발/옷만 참고하여 새로운 9등신 모델 생성
 */
export const generateAutoModel = async (
    referenceImageBase64: string,
    gender: 'm' | 'w'
): Promise<string> => {
    const refB64 = referenceImageBase64.includes('base64,')
        ? referenceImageBase64.split('base64,')[1]
        : referenceImageBase64;

    const genderDesc = gender === 'w' ? 'female' : 'male';
    const faceDesc = gender === 'w'
        ? 'soft and delicate facial structure, smooth pale skin, straight natural brows, slightly wide-set soft eyes with a gentle warm tone, a small refined nose bridge, naturally shaped lips with a subtle softness, creating a calm and elegant expression. Long flowing hair that moves naturally.'
        : 'sharp and defined facial structure, clear skin, natural thick brows, deep-set confident eyes, straight nose bridge, well-defined lips with a composed expression. Short styled hair.';

    const prompt = `
**[TASK: CREATE NEW FASHION MODEL PHOTO]**

Generate a completely NEW professional fashion photograph of a ${genderDesc} supermodel.

---

**[THE MODEL]**

Create a brand new 9-head-tall fashion supermodel:
- ${faceDesc}
- Body proportions: 9-head-tall supermodel proportions
- Very small head relative to tall, elongated body
- Long legs, long arms, slim elegant silhouette
- Full body visible from head to toe
- Professional fashion model physique

---

**[THE OUTFIT - FROM REFERENCE IMAGE]**

Look at the reference image and dress this NEW model in the EXACT same outfit:
- Copy the exact top/shirt (same color, design, material, fit)
- Copy the exact bottom/skirt/pants (same style, length)
- Copy the exact shoes (same design, color, brand style - VERY IMPORTANT)
- Copy any bags, accessories visible

The outfit and especially the SHOES must look identical to the reference image.

---

**[POSE & SETTING]**

- Natural, confident fashion model pose
- Full body shot from head to toe
- Elegant studio or lifestyle background
- Soft cinematic lighting with gentle highlights
- Professional fashion photography aesthetic
- Dreamy, high-fashion magazine quality

---

**[IMPORTANT]**

This is a completely NEW person. Do NOT use the face from the reference image.
Generate a new beautiful face that fits the supermodel aesthetic.
Focus on making the SHOES and OUTFIT match the reference exactly.
The overall image should look like a high-end fashion editorial.

---

**[OUTPUT]**

A stunning 8K professional fashion photograph:
- Brand new 9-head-tall supermodel
- Full body from head to toe
- Wearing the exact outfit and shoes from reference
- Dreamy, high-fashion aesthetic
- Magazine quality photography
`;

    const result = await callGeminiSecure(prompt, [
        { data: refB64, mimeType: 'image/png' }
    ], {
        temperature: 0.7,
        aspectRatio: '9:16'
    });

    if (result.type !== 'image') throw new Error('Auto model generation failed');
    return result.data;
};

// urlToBase64 재수출
export { urlToBase64Client as urlToBase64 };
