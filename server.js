import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Use the stable GA SDK
import { GoogleGenerativeAI } from '@google/generative-ai';

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually load .env file to bypass dotenv@17 auto-loading issues
const envPath = path.resolve(__dirname, '.env');
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                process.env[key.trim()] = valueParts.join('=').trim();
            }
        }
    });
    console.log('.env loaded successfully from:', envPath);
} catch (err) {
    console.error('Failed to load .env:', err.message);
}

console.log('API Key:', process.env.GEMINI_API_KEY ? 'OK (length: ' + process.env.GEMINI_API_KEY.length + ')' : 'MISSING!');

const app = express();
const PORT = 3001;

// Increase limit for large images
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Define Models
// ⚠️ WARNING: DO NOT MODIFY THESE MODEL NAMES WITHOUT EXPLICIT USER CONSENT ⚠️
// ⚠️ 수정 금지: 사용자 허락 없이 이 모델 설정을 변경하면 안 됩니다. ⚠️
const MODEL_TEXT = 'gemini-2.5-flash';
const MODEL_IMAGE_STD = 'gemini-2.5-flash-image-preview'; // Nano Banana (renamed from preview-image to image-preview)
const MODEL_IMAGE_HQ = 'gemini-3-pro-image-preview'; // Nano Banana Pro

console.log('Gemini API Server starting... (Multi-Model Support)');
console.log(`Text Model: ${MODEL_TEXT}`);
console.log(`Image Model (Std): ${MODEL_IMAGE_STD}`);
console.log(`Image Model (HQ): ${MODEL_IMAGE_HQ}`);

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

app.post('/api/gemini', async (req, res) => {
    try {
        if (!apiKey) {
            console.error("API Key missing");
            return res.status(500).json({ error: 'API key not configured' });
        }

        // Extract custom header or body param for model selection
        // We will look for 'x-model-type' header or 'modelType' within config
        // Values: 'text' | 'image-std' | 'image-hq'
        let modelType = req.body.modelType || 'text';

        // Infer model type if not explicitly set (Fallback logic)
        const { prompt, images, config: reqConfig, systemInstruction } = req.body;

        // Check for 4K trigger in prompt or config (for quick switching)
        if (prompt && (prompt.includes('RESOLUTION_MODE: 4K') || prompt.includes('RESOLUTION_MODE: 2K'))) {
            // User logic: 2K/4K button triggers High Quality Model
            modelType = 'image-hq';
        } else if (images && images.length > 0 && !modelType) {
            // Default to standard image model if images are present and no type specified
            modelType = 'image-std';
        }

        let selectedModelName = MODEL_TEXT;
        if (modelType === 'image-hq' || modelType === 'high-quality') {
            selectedModelName = MODEL_IMAGE_HQ;
        } else if (modelType === 'image-std' || modelType === 'image') {
            selectedModelName = MODEL_IMAGE_STD;
        } else {
            selectedModelName = MODEL_TEXT;
        }

        console.log(`[Request] Type: ${modelType} -> Selected Model: ${selectedModelName}`);

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Prepare parts for the Standard SDK
        const promptPart = { text: prompt };
        const imageParts = [];

        if (images && images.length > 0) {
            for (const img of images) {
                let data = img.data;
                // Remove header if present
                if (data.includes('base64,')) {
                    data = data.split('base64,')[1];
                }

                imageParts.push({
                    inlineData: {
                        data: data,
                        mimeType: img.mimeType || 'image/png',
                    },
                });
            }
        }

        const parts = [...imageParts, promptPart];

        const model = genAI.getGenerativeModel({
            model: selectedModelName,
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
        });

        // Filter out unsupported fields from generationConfig
        const generationConfig = { ...reqConfig };

        // aspectRatio and imageSize are NOT supported in generationConfig for any model
        // They are client-side settings only
        delete generationConfig.aspectRatio;
        delete generationConfig.imageSize;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: parts }],
            generationConfig: generationConfig,
        });

        const response = await result.response;

        // Process response - check for image or text
        let responseData = { type: 'text', data: '' };

        const candidate = response.candidates?.[0];
        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    // Image response
                    responseData = {
                        type: 'image',
                        data: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    };
                    break;
                } else if (part.text) {
                    responseData = {
                        type: 'text',
                        data: part.text,
                    };
                }
            }
        } else {
            // Fallback to text() method
            responseData = {
                type: 'text',
                data: response.text()
            };
        }

        return res.json(responseData);

    } catch (error) {
        console.error('Gemini API error:', error);

        let errorMessage = 'Internal server error';
        let errorDetails = '';

        if (error.message) errorMessage = error.message;

        if (error.response && error.response.promptFeedback) {
            errorDetails += ` | Blocked: ${JSON.stringify(error.response.promptFeedback)}`;
        }

        return res.status(500).json({ error: `${errorMessage}${errorDetails}` });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Proxy endpoint: http://localhost:${PORT}/api/gemini`);
});
