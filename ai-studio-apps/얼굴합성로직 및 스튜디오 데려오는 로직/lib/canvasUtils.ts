/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Enforces a target aspect ratio on an image by cropping it.
 * The crop is centered, and it uses a "cover" logic to fill the target dimensions.
 */
export const enforceAspectRatio = async (
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

            const imgW = img.naturalWidth;
            const imgH = img.naturalHeight;
            const targetAspect = targetWidth / targetHeight;
            const imgAspect = imgW / imgH;

            let sx, sy, sWidth, sHeight;

            // "Cover" logic
            if (imgAspect > targetAspect) {
                sHeight = imgH;
                sWidth = sHeight * targetAspect;
                sx = (imgW - sWidth) / 2;
                sy = 0;
            } else {
                sWidth = imgW;
                sHeight = sWidth / targetAspect;
                sx = 0;
                sy = (imgH - sHeight) / 2;
            }

            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            reject(new Error('Failed to load image for cropping.'));
        };
        img.src = dataUrl;
    });
};