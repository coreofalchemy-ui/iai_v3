/**
 * 🔐 보안 포즈 서비스
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure, extractBase64, urlToBase64 } from '../../../lib/geminiClient';

// ========================================
// 40 POSE DEFINITIONS
// ========================================

// 👩 FEMALE_FULL_BODY (01-10)
export const FEMALE_FULL_BODY_POSES: { id: string; description: string }[] = [
    { id: "01_FEMALE_FULL_Straight_Profile", description: "Side profile shot from hip height. Standing strictly upright in a neutral pose. Arms hanging vertically by the sides, fingers relaxed." },
    { id: "02_FEMALE_FULL_Walking_Look_Back", description: "Rear 3/4 view from eye level. Subtle walking motion away from camera. Head turned back over the left shoulder." },
    { id: "03_FEMALE_FULL_Hand_on_Head", description: "Frontal shot from chest height. Standing relaxed. Weight shifted to the right hip. Left hand resting lightly on top of the head." },
    { id: "04_FEMALE_FULL_Looking_Down", description: "Frontal shot from low angle. Standing with feet wide apart. Head tilted down, chin tucked towards chest." },
    { id: "05_FEMALE_FULL_Leaning_Forward", description: "Frontal 3/4 view from eye level. Leaning forward at the waist about 20 degrees. Both hands clasped together." },
    { id: "06_FEMALE_FULL_Legs_Crossed", description: "Frontal shot from knee height. Standing static. Legs crossed at the shins." },
    { id: "07_FEMALE_FULL_Deep_Squat", description: "Low angle frontal shot. Deep crouching position. Knees bent fully." },
    { id: "08_FEMALE_FULL_Hands_on_Thighs", description: "Frontal shot from eye level. Leaning torso forward 45 degrees from hips. Both palms resting on the mid-thighs." },
    { id: "09_FEMALE_FULL_Profile_Eye_Contact", description: "Side profile shot. Standing straight. Head is turned 90 degrees to face the camera lens directly." },
    { id: "10_FEMALE_FULL_Power_Stance", description: "Frontal 3/4 view from low angle. Confident standing pose. Right leg stepped forward aggressively." }
];

// 👩 FEMALE_CLOSE_UP (11-20)
export const FEMALE_CLOSE_UP_POSES: { id: string; description: string }[] = [
    { id: "11_FEMALE_CLOSE_Dangling_Arch", description: "Side profile close-up (waist to floor). One foot planted, the other suspended in air with high arch." },
    { id: "12_FEMALE_CLOSE_One_Leg_Lifted", description: "Front view close-up (thigh to floor). Standing on one straight leg. Other leg bent at knee 90 degrees." },
    { id: "13_FEMALE_CLOSE_Walking_Stride", description: "Ground-level low angle close-up. Walking motion. Front foot flat on ground." },
    { id: "14_FEMALE_CLOSE_Tiptoe_Stance", description: "Rear view close-up (calves to floor). Standing on tiptoes. Both heels raised high." },
    { id: "15_FEMALE_CLOSE_Deep_Squat_Side", description: "Side profile close-up. Deep squat position. Hamstrings pressed tight against calves." },
    { id: "16_FEMALE_CLOSE_Squat_Front", description: "Front view close-up (knees to floor). Crouching posture. Knees bent deeply." },
    { id: "17_FEMALE_CLOSE_Dynamic_Step", description: "Side profile close-up. Mid-stride snapshot. Front leg extended straight." },
    { id: "18_FEMALE_CLOSE_Static_Standing", description: "Low angle close-up (ground level). Single leg weight-bearing. Foot planted firmly flat." },
    { id: "19_FEMALE_CLOSE_Crossed_Walk", description: "Front 3/4 view close-up. Walking motion where one leg crosses in front of the other." },
    { id: "20_FEMALE_CLOSE_Relaxed_Stance", description: "Side view close-up. Static standing. Feet shoulder-width apart. Weight slightly shifted to heels." }
];

// 👨 MALE_FULL_BODY (21-30)
export const MALE_FULL_BODY_POSES: { id: string; description: string }[] = [
    { id: "21_MALE_FULL_Pockets_Down", description: "Frontal shot from chest height. Standing with a slouch. Head tilted down. Both hands in pockets." },
    { id: "22_MALE_FULL_Pockets_Up", description: "Frontal shot from low angle. Standing tall with backward lean. Head tilted upwards." },
    { id: "23_MALE_FULL_Mid_Stride_Walk", description: "Frontal shot from knee height. Walking towards camera. Right leg leading." },
    { id: "24_MALE_FULL_Profile_Looking_Down", description: "Side profile shot. Standing completely still. Head tilted down." },
    { id: "25_MALE_FULL_Rigid_Stance", description: "Frontal shot from eye level. Rigid, military-style standing. Spine perfectly perpendicular." },
    { id: "26_MALE_FULL_Relaxed_One_Pocket", description: "Frontal shot from eye level. Casual standing. Weight shifted to left leg." },
    { id: "27_MALE_FULL_Leaning_Cross_Legged", description: "Frontal shot from chest height. Leaning back against wall. Legs crossed at ankles." },
    { id: "28_MALE_FULL_Profile_Step", description: "Side profile shot. Mid-stride walking motion. Left leg stepping forward." },
    { id: "29_MALE_FULL_Thinking_Stance", description: "Frontal shot from eye level. Wide stance. Right hand touching chin." },
    { id: "30_MALE_FULL_Profile_Look_at_Camera", description: "Side profile shot. Body is strictly sideways. Head turned to look at camera." }
];

// 👨 MALE_CLOSE_UP (31-40)
export const MALE_CLOSE_UP_POSES: { id: string; description: string }[] = [
    { id: "31_MALE_CLOSE_Walking_Heel_Up", description: "Low angle close-up. Walking motion. Rear foot's heel lifted high." },
    { id: "32_MALE_CLOSE_Static_Feet_Apart", description: "Low angle close-up. Standing still. Feet parallel, shoulder-width apart." },
    { id: "33_MALE_CLOSE_Ankle_Flex", description: "Extreme close-up (shin to foot). Foot lifted in mid-air. Ankle flexed tightly upwards." },
    { id: "34_MALE_CLOSE_Step_Forward", description: "Side view close-up. Walking stride. Front leg straight, landing on heel." },
    { id: "35_MALE_CLOSE_Foot_Cross", description: "Front view close-up. Static standing. Ankles crossed tightly." },
    { id: "36_MALE_CLOSE_Wide_Stance_Down", description: "High angle (top-down) close-up. Very wide stance. Feet angled outwards." },
    { id: "37_MALE_CLOSE_Single_Foot_Arch", description: "Side profile close-up. One foot resting with only toes touching ground." },
    { id: "38_MALE_CLOSE_Walk_Mid_Stride", description: "Frontal view close-up. Walking towards camera. Right foot flat." },
    { id: "39_MALE_CLOSE_Profile_Flat_Stand", description: "Side profile close-up. Static standing. Entire sole flat on ground." },
    { id: "40_MALE_CLOSE_Inner_Feet_Angle", description: "Low angle close-up. Relaxed standing. Feet turned slightly inwards." }
];

// ========================================
// TYPES
// ========================================

export type Gender = 'MALE' | 'FEMALE';

export interface PoseGenerationResult {
    imageUrl: string;
    poseId: string;
    poseDescription: string;
}

// ========================================
// GENDER DETECTION (SECURE)
// ========================================

export async function detectGender(imageUrl: string): Promise<Gender> {
    console.log('🔍 Detecting gender (SECURE)...');
    const base64 = await urlToBase64(imageUrl);

    const prompt = `Analyze this image and determine if the fashion model is MALE or FEMALE.
Look at the body shape, clothing style, and overall appearance.
Respond with ONLY one word: "MALE" or "FEMALE".`;

    try {
        const result = await callGeminiSecure(prompt, [{ data: base64, mimeType: 'image/jpeg' }]);
        const text = result.data.trim().toUpperCase();

        if (text.includes('FEMALE')) return 'FEMALE';
        if (text.includes('MALE')) return 'MALE';
        return 'FEMALE'; // Default
    } catch (e) {
        console.error('Gender detection failed:', e);
        return 'FEMALE';
    }
}

// ========================================
// GET AVAILABLE POSES
// ========================================

export function getAvailablePoses(
    gender: Gender,
    type: 'full' | 'closeup',
    usedPoseIds: Set<string>
): { id: string; description: string }[] {
    let poseLibrary: { id: string; description: string }[];

    if (gender === 'FEMALE') {
        poseLibrary = type === 'full' ? FEMALE_FULL_BODY_POSES : FEMALE_CLOSE_UP_POSES;
    } else {
        poseLibrary = type === 'full' ? MALE_FULL_BODY_POSES : MALE_CLOSE_UP_POSES;
    }

    return poseLibrary.filter(pose => !usedPoseIds.has(pose.id));
}

// ========================================
// POSE GENERATION (SECURE)
// ========================================

export async function generatePoseVariation(
    baseImageUrl: string,
    pose: { id: string; description: string },
    gender: Gender,
    type: 'full' | 'closeup'
): Promise<PoseGenerationResult> {
    console.log(`🎨 Generating pose (SECURE): ${pose.id}`);
    const base64 = await urlToBase64(baseImageUrl);

    const frameNote = type === 'closeup'
        ? `[FRAME] CLOSE-UP shot focusing on lower body (waist down to feet).`
        : `[FRAME] FULL-BODY shot. Show entire figure from head to toe.`;

    const genderNote = gender === 'FEMALE'
        ? `Model is FEMALE. Maintain feminine proportions.`
        : `Model is MALE. Emphasize wide stance and grounded weight.`;

    const prompt = `
[TASK: FASHION MODEL POSE VARIATION]
Input: A photo of a fashion model wearing specific clothing and shoes.

[CRITICAL RULES]
1. **IDENTITY LOCK**: Keep model's FACE 100% IDENTICAL.
2. **OUTFIT LOCK**: Keep ALL CLOTHING EXACTLY THE SAME.
3. **SHOES LOCK**: Keep SHOES 100% IDENTICAL.
4. **BACKGROUND LOCK**: Keep BACKGROUND 100% IDENTICAL.
5. **ONLY CHANGE POSE**: Apply new pose below.

${frameNote}

${genderNote}

[NEW POSE TO APPLY]
${pose.description}

[IMAGE QUALITY - 매우 중요]
- **SHARP FOCUS**: Image MUST be crystal clear, NOT blurry or hazy.
- **HIGH RESOLUTION**: Ultra-high definition, 8K quality, professional photography.
- **CLEAN EDGES**: All edges and details must be crisp and well-defined.
- **NO BLUR**: Absolutely NO motion blur, focus blur, or softness.

[NATURAL POSE RULES - 자연스러운 자세]
- **NATURAL LEG POSITIONING**: Legs should be naturally positioned, NOT unnaturally wide apart.
- **FASHION EDITORIAL STYLE**: Natural, elegant poses like professional fashion magazine shoots.
- **AVOID AWKWARD STANCES**: No exaggerated or uncomfortable-looking leg spreads.
- **COMFORTABLE POSTURE**: The model should look relaxed and natural, not stiff or forced.

[STYLE]
- High-end fashion photography
- Professional studio lighting
- 8K resolution, photorealistic, razor-sharp focus
`;

    const result = await callGeminiSecure(
        prompt,
        [{ data: base64, mimeType: 'image/jpeg' }],
        { aspectRatio: type === 'closeup' ? '3:4' : '4:3' }
    );

    if (result.type !== 'image') {
        throw new Error('Failed to generate pose variation');
    }

    return {
        imageUrl: result.data,
        poseId: pose.id,
        poseDescription: pose.description
    };
}

// ========================================
// BATCH POSE GENERATION (SECURE)
// ========================================

export async function generatePoseBatch(
    baseImageUrl: string,
    count: number,
    type: 'full' | 'closeup',
    usedPoseIds: Set<string>,
    onProgress?: (current: number, total: number, result: PoseGenerationResult) => void
): Promise<{ results: PoseGenerationResult[]; newUsedPoseIds: Set<string> }> {
    console.log(`🚀 Batch pose generation (SECURE): ${count} images, type: ${type}`);

    const gender = await detectGender(baseImageUrl);
    console.log(`👤 Detected gender: ${gender}`);

    const availablePoses = getAvailablePoses(gender, type, usedPoseIds);
    console.log(`📋 Available poses: ${availablePoses.length}`);

    if (availablePoses.length === 0) {
        throw new Error(`사용 가능한 자세가 없습니다.`);
    }

    const selectedPoses = availablePoses.slice(0, Math.min(count, availablePoses.length));
    const results: PoseGenerationResult[] = [];
    const newUsedPoseIds = new Set(usedPoseIds);

    for (let i = 0; i < selectedPoses.length; i++) {
        const pose = selectedPoses[i];
        try {
            const result = await generatePoseVariation(baseImageUrl, pose, gender, type);
            results.push(result);
            newUsedPoseIds.add(pose.id);
            onProgress?.(i + 1, selectedPoses.length, result);
        } catch (e) {
            console.error(`Failed to generate pose ${i + 1}:`, e);
        }
    }

    console.log(`✨ Batch complete: ${results.length}/${selectedPoses.length} successful`);
    return { results, newUsedPoseIds };
}
