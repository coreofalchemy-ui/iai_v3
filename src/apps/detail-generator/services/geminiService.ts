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
    gender: 'm' | 'w'
): Promise<string> => {
    const faceB64 = sourceFaceBase64.includes('base64,')
        ? sourceFaceBase64.split('base64,')[1]
        : sourceFaceBase64;
    const refB64 = referenceImageBase64.includes('base64,')
        ? referenceImageBase64.split('base64,')[1]
        : referenceImageBase64;

    const prompt = `
**[작업: 원본 사진에서 얼굴만 교체]**

두 이미지가 주어집니다:
- **[얼굴 사진]**: 새로 적용할 얼굴
- **[원본 사진]**: 기준이 되는 사진 (이 사진을 그대로 복제)

---

**[핵심 명령]**

[원본 사진]을 **그대로 복제**하되, 얼굴만 [얼굴 사진]의 사람으로 바꿔라.

---

**[절대적으로 유지해야 할 것 - 원본 사진 기준]**

1. **출력 크기**: 원본 사진과 **동일한 해상도와 크기**로 출력
2. **피사체 크기**: 원본 사진에서 사람이 차지하는 비율 그대로 유지
3. **구도**: 원본 사진의 카메라 앵글, 프레임 그대로
4. **배경**: 원본 사진의 배경 그대로 (변경 금지)
5. **착장**: 원본 사진의 옷, 신발, 액세서리 그대로
6. **자세**: 원본 사진의 포즈 그대로

---

**[변경할 것]**

- **얼굴**: [얼굴 사진]의 얼굴로 교체 (눈, 코, 입, 턱선, 광대뼈)
- **헤어스타일**: [얼굴 사진]의 헤어스타일로 교체
- **피부톤**: [얼굴 사진]의 피부톤으로 맞춤

---

**[출력 품질]**

- **해상도**: 원본 사진과 동일하거나 더 높게
- **선명도**: Ultra sharp, 8K quality
- **화질 저하 금지**: 블러, 노이즈, 화질 저하 없이 선명하게

---

**[실패 조건]**

- 출력 이미지가 원본 사진보다 작으면 실패
- 피사체가 원본 사진보다 작아지면 실패
- 배경이 바뀌면 실패
- 얼굴이 [얼굴 사진]과 다르면 실패
- 화질이 저하되면 실패

**[출력]**: 원본 사진과 동일한 크기, 동일한 구도의 고화질 패션 사진
`;

    // aspectRatio를 지정하지 않아서 원본 이미지 크기를 따라가게 함
    const result = await callGeminiSecure(prompt, [
        { data: faceB64, mimeType: 'image/png' },   // IMAGE 1: 새 얼굴
        { data: refB64, mimeType: 'image/png' }     // IMAGE 2: 원본 (크기/구도/배경 기준)
    ], {
        temperature: 0.3,  // 더 일관성 있게
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

// urlToBase64 재수출
export { urlToBase64Client as urlToBase64 };
