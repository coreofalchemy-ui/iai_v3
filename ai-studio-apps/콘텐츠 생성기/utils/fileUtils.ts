
import { UploadFile } from "../types";

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } else {
        reject(new Error('Failed to read file as base64 string.'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL.'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export const dataURLtoFile = (dataUrl: string, filename: string): File => {
  const arr = dataUrl.split(',');
  if (arr.length < 2) {
    throw new Error('Invalid data URL format.');
  }
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) {
    throw new Error('Could not parse MIME type from data URL.');
  }
  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

export const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image to determine dimensions.'));
    };
    img.src = dataUrl;
  });
};

/**
 * [CRITICAL PRE-PROCESSING] cropImageToTargetSize
 * 
 * Strategy: "Black Bar Padding"
 * 1. Creates a 1400x1400 square canvas.
 * 2. Fills the canvas with SOLID BLACK (#000000).
 * 3. Places the source image in the center (Object-fit: Contain).
 * 
 * WHY: This creates explicit "void" areas (black bars) around the image.
 * The Gemini 3.0 Pro model is trained to recognize these black voids as 
 * "areas to be outpainted" (filled with background extensions), ensuring
 * the final result is a seamless 1:1 square image without distorted cropping.
 */
export const cropImageToTargetSize = (file: File): Promise<UploadFile> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context.'));
                }

                // CHANGED: 1:1 Aspect Ratio (Square)
                const targetWidth = 1400;
                const targetHeight = 1400;
                const targetAspectRatio = targetWidth / targetHeight;

                canvas.width = targetWidth;
                canvas.height = targetHeight;
                
                // [CRITICAL] Use BLACK for padding.
                // This tells the AI: "This black area is empty space, please generate background here."
                ctx.fillStyle = '#000000'; 
                ctx.fillRect(0, 0, targetWidth, targetHeight);

                const imgW = img.width;
                const imgH = img.height;
                const imgAspect = imgW / imgH;

                let dx = 0, dy = 0, dWidth = targetWidth, dHeight = targetHeight;

                if (imgAspect > targetAspectRatio) {
                    // Image is wider than target, fit to width
                    dWidth = targetWidth;
                    dHeight = dWidth / imgAspect;
                    dy = (targetHeight - dHeight) / 2;
                } else {
                    // Image is taller than or equal to target, fit to height
                    dHeight = targetHeight;
                    dWidth = dHeight * imgAspect;
                    dx = (targetWidth - dWidth) / 2;
                }

                ctx.drawImage(img, 0, 0, imgW, imgH, dx, dy, dWidth, dHeight);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        return reject(new Error('Canvas to Blob conversion failed.'));
                    }
                    const fittedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                    const previewUrl = URL.createObjectURL(fittedFile);
                    resolve({ file: fittedFile, previewUrl });
                }, 'image/jpeg', 0.95);
            };
            img.onerror = reject;
            img.src = event.target?.result as string;
        };
        reader.onerror = reject;
    });
};

/**
 * Enforces a target aspect ratio on an image from a data URL by padding it.
 * Used for post-processing to ensure no sub-pixel rounding errors occurred during generation.
 */
export const enforceAspectRatio = (
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

            // Fill with Black again for consistency
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
        img.onerror = (err) => {
            console.error("Failed to load image for aspect ratio enforcement.", err);
            reject(new Error('Failed to load image for fitting.'));
        };
        img.src = dataUrl;
    });
};
