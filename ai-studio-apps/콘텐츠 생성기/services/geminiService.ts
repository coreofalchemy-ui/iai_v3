
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { UploadFile } from '../types';
import { fileToBase64, enforceAspectRatio } from '../utils/fileUtils';

// Initialize the Google AI client.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// ============================================================================
// [CORE LOGIC SPECIFICATION]
// 1. Pre-processing: Input images are padded with BLACK (#000000) bars to 1:1.
// 2. Model: 'gemini-3-pro-image-preview' (Capable of intense instruction following).
// 3. Prompt Strategy: "Photocopier" persona to force cloning over generation.
// 4. Outpainting: The model treats black pixels as "void" to fill with background.
// ============================================================================

// Standard Aspect Ratio for Fashion Detail Pages (1:1 Square)
const TARGET_WIDTH = 1400;
const TARGET_HEIGHT = 1400;

// MODEL DEFINITIONS
const MODEL_TEXT_LOGIC = 'gemini-3-pro-preview';
const MODEL_IMAGE_GEN = 'gemini-3-pro-image-preview';

const POSE_GENERATION_PROMPT = `
You are a creative director. Generate 3 natural pose descriptions for a footwear photoshoot.
Context: Korean Language.
Output Schema (JSON): Array of { label, prompt }.
`;

export const generatePosePrompts = async (
  existingPrompts: string[]
): Promise<{ label: string; prompt: string }[]> => {
  const prompt = POSE_GENERATION_PROMPT + `\nAvoid: ${existingPrompts.join(', ')}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT_LOGIC,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              prompt: { type: Type.STRING },
            },
            required: ['label', 'prompt'],
          },
        },
      },
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Pose Prompt Generation Error:", error);
    throw new Error('포즈 생성 중 오류 발생');
  }
};

export interface ClothingColorSettings {
  outer: string | null;
  inner: string | null;
  pants: string | null;
  socks: string | null;
}

/**
 * [CORE FUNCTION] replaceShoesInImage
 * This function orchestrates the precision shoe replacement.
 * 
 * Logic Flow:
 * 1. Takes the Source Image (Model) which has been pre-processed with Black Bars.
 * 2. Takes Product Images (Shoes) as reference "Ground Truth".
 * 3. Constructs a Multi-modal Payload: [Text Command, Source Img, Ref Imgs, Detailed Prompt].
 * 4. Executes Gemini 3.0 Pro to "Clone" the shoes and "Outpaint" the background.
 */
export const replaceShoesInImage = async (
  sourceImage: UploadFile,
  productImages: UploadFile[],
  isSingleShoe: boolean,
  colorSettings?: ClothingColorSettings
): Promise<string> => {
  
  // 1. Prepare Source Image (Target Canvas)
  const sourceImageBase64 = await fileToBase64(sourceImage.file);
  const sourceImagePart = { 
    inlineData: { data: sourceImageBase64, mimeType: sourceImage.file.type } 
  };

  // 2. Prepare Product Images (Visual References)
  // Limit increased to 4 to capture more angles/details
  const limitedProductImages = productImages.slice(0, 4);
  const productImagesParts = await Promise.all(
    limitedProductImages.map(async (img) => {
      const base64 = await fileToBase64(img.file);
      return { inlineData: { data: base64, mimeType: img.file.type } };
    })
  );

  // 3. Construct Additional Instructions (Optional Recolor)
  let additionalInstructions = "";
  if (colorSettings) {
      if (colorSettings.outer) additionalInstructions += `- Change the Outerwear/Coat color to ${colorSettings.outer}.\n`;
      if (colorSettings.inner) additionalInstructions += `- Change the Inner Top/Shirt color to ${colorSettings.inner}.\n`;
      if (colorSettings.pants) additionalInstructions += `- Change the Pants/Trousers color to ${colorSettings.pants}.\n`;
      if (colorSettings.socks) additionalInstructions += `- Change the Socks color to ${colorSettings.socks}.\n`;
  }

  // [PROMPT ENGINEERING - THE "PHOTOCOPIER" STRATEGY]
  // We explicitly tell the AI NOT to design, but to COPY (Clone).
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

  // Payload Construction
  const contents = {
    parts: [
      { text: "Perform 3D Geometry Replacement, Texture Baking, and Background Extension." },
      sourceImagePart, // First image = Source (Canvas)
      ...productImagesParts, // Subsequent images = References (Texture)
      { text: EDITING_PROMPT },
    ],
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN,
      contents,
      config: {
        imageConfig: {
             aspectRatio: "1:1"  // Enforce 1:1 Square
        },
        responseModalities: [Modality.IMAGE],
      },
    });

    const newImagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

    if (newImagePart?.inlineData) {
      const originalDataUrl = `data:${newImagePart.inlineData.mimeType};base64,${newImagePart.inlineData.data}`;
      return await enforceAspectRatio(originalDataUrl, TARGET_WIDTH, TARGET_HEIGHT);
    }
    throw new Error("이미지 생성 응답이 비어있습니다.");
  } catch (error) {
    console.error("Replacement Error:", error);
    let msg = String(error);
    if (msg.includes('JSON')) msg = "이미지 처리 중 연결이 불안정합니다. 잠시 후 다시 시도해주세요.";
    if (msg.includes('400')) msg = "요청이 너무 큽니다. 제품 사진 용량을 줄여보세요.";
    
    throw new Error(`작업 실패: ${msg}`);
  }
};


export const changeImagePose = async (
  sourceImage: UploadFile,
  posePrompt: string
): Promise<string> => {
    const sourceImageBase64 = await fileToBase64(sourceImage.file);
    const imagePart = { inlineData: { data: sourceImageBase64, mimeType: sourceImage.file.type } };
    
    const prompt = `
[TASK] Pose Editing & Advanced Background Outpainting
[INPUT] Source Image (contains black padding)

[INSTRUCTION]
1. **SCENE RECONSTRUCTION (OUTPAINTING)**: 
   - The input has BLACK BARS. These are VOID areas.
   - **CALCULATE LIGHTING**: Analyze the light source from the model.
   - **EXTEND ENVIRONMENT**: Generate realistic floor and walls to fill the black areas, matching the perspective and material of the center image.
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
        const response = await ai.models.generateContent({
            model: MODEL_IMAGE_GEN,
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                imageConfig: { aspectRatio: "1:1" },
                responseModalities: [Modality.IMAGE],
            },
        });

        const newImagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (newImagePart?.inlineData) {
             const originalDataUrl = `data:${newImagePart.inlineData.mimeType};base64,${newImagePart.inlineData.data}`;
             return await enforceAspectRatio(originalDataUrl, TARGET_WIDTH, TARGET_HEIGHT);
        }
        throw new Error("No pose image generated.");

    } catch (error) {
        console.error("Pose Change Error:", error);
        throw new Error(`자세 변경 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const changeClothingDetail = async (
    sourceImage: UploadFile,
    item: string,
    color: string
): Promise<string> => {
    const sourceImageBase64 = await fileToBase64(sourceImage.file);
    const imagePart = { inlineData: { data: sourceImageBase64, mimeType: sourceImage.file.type } };

    // Mapping Korean/User input to clear English prompt terms
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
   - **FILL** these areas by extending the studio background or environment. 
   - **MATCH** the lighting intensity and shadow direction of the original image.
   - The result must be a seamless 1:1 image.

2. **COLOR CHANGE**: 
   - Change the color of the model's ${targetItem} to ${color}.
   - **PRESERVE TEXTURE**: Keep all fabric folds, wrinkles, and material textures. Only change the albedo color.

[CRITICAL RULES]
- **OUTPUT**: Full 1:1 Square Image. NO BLACK BARS.
- **TARGET**: Change ONLY the color of the ${targetItem}.
- **PRESERVATION**: The model's shoes, face, and other items must remain 100% UNCHANGED.
`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_IMAGE_GEN,
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                imageConfig: { aspectRatio: "1:1" },
                responseModalities: [Modality.IMAGE],
            },
        });

        const newImagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (newImagePart?.inlineData) {
            const originalDataUrl = `data:${newImagePart.inlineData.mimeType};base64,${newImagePart.inlineData.data}`;
            return await enforceAspectRatio(originalDataUrl, TARGET_WIDTH, TARGET_HEIGHT);
        }
        throw new Error("No edited image generated.");

    } catch (error) {
        console.error("Clothing Change Error:", error);
        throw new Error(`의상 변경 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
};
