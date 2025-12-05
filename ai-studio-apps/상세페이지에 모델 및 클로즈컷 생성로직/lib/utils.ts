
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { toPng } from 'html-to-image';
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFriendlyErrorMessage(error: unknown, context: string): string {
    if (typeof ProgressEvent !== 'undefined' && error instanceof ProgressEvent) {
        return `파일을 읽는 중 오류가 발생했습니다. 파일이 손상되었거나 지원되지 않는 형식일 수 있습니다. (${context})`;
    }

    let rawMessage = '알 수 없는 오류가 발생했습니다.';
    if (error instanceof Error) {
        rawMessage = error.message;
    } else if (typeof error === 'string') {
        rawMessage = error;
    } else if (error) {
        rawMessage = String(error);
    }

    try {
        const jsonMatch = rawMessage.match(/\{.*\}/);
        if (jsonMatch) {
            const errorJson = JSON.parse(jsonMatch[0]);
            const message = errorJson?.error?.message || rawMessage;
            const code = errorJson?.error?.code;

            if (code === 429) {
                return `API 요청 한도를 초과했습니다. Gemini API 요금제 및 결제 세부 정보를 확인해주세요. 잠시 후 다시 시도해 주십시오.`;
            }
            if (message.includes("Unsupported MIME type")) {
                 return `지원되지 않는 파일 형식입니다. PNG, JPEG, WEBP 같은 이미지 형식을 업로드해주세요.`;
            }
            if (message.includes("The service is currently unavailable")) {
                return `AI 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.`;
            }
            if (message.includes("Internal error encountered")) {
                return `AI 서버 내부 오류가 발생했습니다. 잠시 후 다시 시도하시거나, 문제가 계속되면 다른 이미지를 사용해 보세요.`;
            }
            return `${context}. 오류: ${message}`;
        }
    } catch (e) {
        // Not a valid JSON, fall through to default handling
    }
    
    if (rawMessage.includes("Internal error encountered")) {
        return `AI 서버 내부 오류가 발생했습니다. 잠시 후 다시 시도하시거나, 문제가 계속되면 다른 이미지를 사용해 보세요.`;
    }
    if (rawMessage.includes("Unsupported MIME type")) {
        return `지원되지 않는 파일 형식입니다. PNG, JPEG, WEBP 같은 이미지 형식을 업로드해주세요.`;
    }

    if (rawMessage.includes("The service is currently unavailable")) {
        return `AI 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.`;
    }
    
    return `${context}. 오류: ${rawMessage}`;
}

export async function resizeImage(file: File, targetWidth: number, targetHeight?: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Maintain aspect ratio based on targetWidth
      const ratio = targetWidth / img.width;
      const newWidth = targetWidth;
      const newHeight = img.height * ratio;

      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(img.src);
        return reject(new Error('Could not get canvas context'));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(img.src);
        if (blob) {
          const resizedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(resizedFile);
        } else {
          reject(new Error('Canvas to Blob conversion failed'));
        }
      }, 'image/jpeg', 0.95);
    };
    img.onerror = (err) => {
      if (img.src) {
        URL.revokeObjectURL(img.src);
      }
      reject(new Error('Image loading failed'));
    };
    img.src = URL.createObjectURL(file);
  });
}

export const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const NOISE_TEXTURE_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAp4XiDAAAAUVBMVEWFhYWDg4N3d3dtbW17e3t1dXVoaGhpaWlnZ2dlZWVgYGBvb29xcXFtbW1wcHBpaWlobm5jY2NlZWVsbGxqampmaGpiYmJqampiYmJiaGpramtrrGSUAAAACHRSTlMAAOnz5eXp6PDR0t8AAAAqSURBVEjHY2AYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSigws4AAL2nDD3zD2dOAAAAAElFTSuQmCC";

const FILTER_VALUES: { [key: string]: any } = {
  wconcept: { temp: -140, tint: -3, sat: -8, ctr: -3, black: 12, roll: 10, mid: 4, grain: 0.14, gsize: 21, paper: 0.07, vig: 0.06, glow: 0.05 },
  musinsa: { temp: -200, tint: 0, sat: -2, ctr: 8, black: 4, roll: 4, mid: 0, grain: 0.06, gsize: 18, paper: 0.03, vig: 0.05, glow: 0.00 },
  cm29: { temp: 80, tint: 1, sat: -8, ctr: -6, black: 10, roll: 12, mid: 0, grain: 0.10, gsize: 18, paper: 0.05, vig: 0.05, glow: 0.02 },
  krem: { temp: 80, tint: 1, sat: -6, ctr: -2, black: 8, roll: 6, mid: 2, grain: 0.10, gsize: 18, paper: 0.04, vig: 0.04, glow: 0.04 },
  global: { temp: 0, tint: 0, sat: 0, ctr: 6, black: 0, roll: 4, mid: 2, grain: 0.08, gsize: 18, paper: 0.03, vig: 0.04, glow: 0.00 },
  off: { temp: 0, tint: 0, sat: 0, ctr: 0, black: 0, roll: 0, mid: 0, grain: 0, gsize: 18, paper: 0, vig: 0, glow: 0 },
};

export const getFilterStyles = (preset: string): { base: any, overlays: any[] } => {
    const p = FILTER_VALUES[preset] || FILTER_VALUES['off'];
    if (preset === 'off') return { base: {}, overlays: [] };

    const filters = [
        `saturate(${1 + p.sat / 100})`,
        `contrast(${1 + p.ctr / 100})`,
        `brightness(${1 + (p.black - p.roll) / 100})`,
    ];

    const base = { filter: filters.join(' ') };
    const overlays: any[] = [];
    
    if (p.temp !== 0 || p.tint !== 0) {
        const tempR = p.temp > 0 ? p.temp / 200 * 255 : 0;
        const tempB = p.temp < 0 ? Math.abs(p.temp) / 200 * 255 : 0;
        const tintG = p.tint < 0 ? Math.abs(p.tint) / 10 * 255 : 0;
        
        overlays.push({
            background: `rgb(${tempR}, ${tintG}, ${tempB})`,
            mixBlendMode: 'soft-light',
            opacity: 0.2
        });
    }
    
    if (p.grain > 0 || p.paper > 0) {
        overlays.push({
            backgroundImage: `url(${NOISE_TEXTURE_URL})`,
            backgroundSize: `${p.gsize}px`,
            opacity: p.grain + p.paper,
            mixBlendMode: 'overlay',
        });
    }

    if (p.glow > 0) {
       overlays.push({
           position: 'absolute',
           inset: 0,
           backdropFilter: `blur(${p.glow * 4}px)`,
           opacity: 0.1,
           zIndex: 2,
           pointerEvents: 'none'
       })
    }
    
    return { base, overlays };
}

export const applyFilterToImage = async (imageUrl: string, preset: string): Promise<string> => {
    if (preset === 'off' || !imageUrl) return imageUrl;

    const styles = getFilterStyles(preset);

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '1000px'; 
    container.style.overflow = 'hidden';

    const imageEl = document.createElement('img');
    imageEl.crossOrigin = 'anonymous'; 
    imageEl.src = imageUrl;
    imageEl.style.width = '100%';
    imageEl.style.height = 'auto';
    imageEl.style.display = 'block';
    imageEl.style.filter = styles.base.filter as string;

    const filterableContent = document.createElement('div');
    filterableContent.style.width = '100%';
    filterableContent.style.position = 'relative';

    filterableContent.appendChild(imageEl);

    styles.overlays.forEach(overlayStyle => {
        const overlayDiv = document.createElement('div');
        Object.assign(overlayDiv.style, {
            position: 'absolute',
            inset: '0',
            ...overlayStyle
        });
        filterableContent.appendChild(overlayDiv);
    });

    container.appendChild(filterableContent);
    document.body.appendChild(container);

    await new Promise((resolve, reject) => {
        if (imageEl.complete) {
            resolve(true);
        } else {
            imageEl.onload = () => resolve(true);
            imageEl.onerror = () => reject(new Error('Image could not be loaded for filtering.'));
        }
    });

    const contentHeight = imageEl.offsetHeight;
    container.style.height = `${contentHeight}px`;

    await new Promise(res => setTimeout(res, 50));

    try {
        const dataUrl = await toPng(container, {
            width: 1000,
            height: contentHeight,
            cacheBust: true,
            filter: (node) => {
                if (node.tagName === 'LINK' && (node as HTMLLinkElement).rel === 'stylesheet') {
                    if ((node as HTMLLinkElement).href && (node as HTMLLinkElement).href.startsWith('http')) {
                        return false; 
                    }
                }
                return true;
            },
        });
        return dataUrl;
    } finally {
        document.body.removeChild(container);
    }
};

export const parseImportedHtml = (doc: Document) => {
    const pxToNum = (val: string | null | undefined) => val ? val.replace('px', '').trim() : '16';
    const br2nl = (str: string) => str.replace(/<br\s*\/?>/gi, '\n');

    const textContent = {
        title: doc.querySelector('.intro-block .title')?.textContent ?? '',
        descriptionPara1: br2nl(doc.querySelector('.intro-block .description p:nth-of-type(1)')?.innerHTML ?? ''),
        descriptionPara2: br2nl(doc.querySelector('.intro-block .description p:nth-of-type(2)')?.innerHTML ?? ''),
    };

    const specContent: any = {};
    const specMap: { [key: string]: string } = {
        '사이즈 안내': 'sizeGuide', '제품명': 'productName', '컬러': 'color',
        '인솔': 'insole', '체감 키높이': 'totalHeelHeight', '구성품': 'components', '제조국': 'countryOfOrigin'
    };
    doc.querySelectorAll('.spec-table tr').forEach(row => {
        const th = row.querySelector('th')?.textContent?.trim();
        const td = row.querySelector('td');
        if (th && td) {
            if (specMap[th]) {
                specContent[specMap[th]] = br2nl(td.innerHTML);
            } else if (th === '소재') {
                const text = td.textContent ?? '';
                specContent.upper = text.match(/Upper: (.*?)\s*\//)?.[1]?.trim() ?? '';
                specContent.lining = text.match(/Lining: (.*?)\s*\//)?.[1]?.trim() ?? '';
                specContent.outsole = text.match(/Outsole: (.*?)$/)?.[1]?.trim() ?? '';
            }
        }
    });

    const introInfoTitles = doc.querySelectorAll('.intro-block .info-title');
    const productionInfoTitle = Array.from(introInfoTitles).find(el => el.textContent?.includes('제작기간 정보'));
    if (productionInfoTitle) {
        specContent.productionInfo = br2nl(productionInfoTitle.nextElementSibling?.innerHTML ?? '');
    }

    const heroTextContent = {
        brandName: doc.querySelector('.hero-section .hero-text-top .brand-name')?.textContent ?? '',
        slogan: doc.querySelector('.hero-section .hero-text-top .slogan')?.textContent ?? '',
        descriptionAndTags: doc.querySelector('.hero-section .hero-text-bottom .description-and-tags')?.textContent ?? '',
    };

    const noticeContent = {
        para1: br2nl(doc.querySelector('.notice-section p:nth-of-type(1)')?.innerHTML ?? ''),
        para2: br2nl(doc.querySelector('.notice-section p:nth-of-type(2)')?.innerHTML ?? ''),
    };

    const imageUrls = {
        products: Array.from(doc.querySelectorAll('img[data-gallery-type="products"]')).map(img => (img as HTMLImageElement).src),
        modelShots: Array.from(doc.querySelectorAll('img[data-gallery-type="modelShots"]')).map(img => ({ url: (img as HTMLImageElement).src, generatingParams: { pose: 'imported' } })),
        closeupShots: Array.from(doc.querySelectorAll('img[data-gallery-type="closeupShots"]')).map(img => ({ url: (img as HTMLImageElement).src, generatingParams: { pose: 'imported' } })),
        conceptShot: (doc.querySelector('img[data-gallery-type="conceptShot"]') as HTMLImageElement)?.src ?? '',
        studioWornCloseup: (doc.querySelector('img[data-gallery-type="studioWornCloseup"]') as HTMLImageElement)?.src ?? '',
        finalConceptShot: (doc.querySelector('img[data-gallery-type="finalConceptShot"]') as HTMLImageElement)?.src ?? '',
    };
    
    const getStyleProp = (el: HTMLElement | null, prop: keyof CSSStyleDeclaration) => el ? el.style[prop] as string : null;
    const colorToHex = (color: string) => {
        if (!color || color.startsWith('#')) return color;
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.fillStyle = color;
        return ctx.fillStyle;
    };
    
    const styleContent = doc.querySelector('style')?.textContent ?? '';
    const getFontStyle = (selector: string) => {
        const regex = new RegExp(`${selector.replace('.', '\\.')}[^{]*{[^}]*font-family:\\s*([^;}]+)`);
        const match = styleContent.match(regex);
        return match ? match[1].trim() : '';
    };

    const fontStyles = {
        title: getFontStyle('.intro-block .title'),
        description: getFontStyle('.intro-block .description'),
        heroBrand: getFontStyle('.hero-text-top .brand-name'),
        heroMain: getFontStyle('.hero-text-top .slogan'),
        specTable: getFontStyle('.spec-table'),
    };
    
    const fontSizes = {
        title: pxToNum(getStyleProp(doc.querySelector<HTMLElement>('.intro-block .title'), 'fontSize')),
        descriptionPara1: pxToNum(getStyleProp(doc.querySelector<HTMLElement>('.intro-block .description p:nth-of-type(1)'), 'fontSize')),
        descriptionPara2: pxToNum(getStyleProp(doc.querySelector<HTMLElement>('.intro-block .description p:nth-of-type(2)'), 'fontSize')),
        table: pxToNum(getStyleProp(doc.querySelector<HTMLElement>('.spec-table'), 'fontSize')),
        heroBrandName: pxToNum(getStyleProp(doc.querySelector<HTMLElement>('.hero-section .hero-text-top .brand-name'), 'fontSize')),
        slogan: pxToNum(getStyleProp(doc.querySelector<HTMLElement>('.hero-section .hero-text-top .slogan'), 'fontSize')),
        heroDescriptionAndTags: pxToNum(getStyleProp(doc.querySelector<HTMLElement>('.hero-section .hero-text-bottom .description-and-tags'), 'fontSize')),
    };

    const heroTextColors = {
        brandName: colorToHex(getStyleProp(doc.querySelector<HTMLElement>('.hero-section .hero-text-top .brand-name'), 'color')),
        slogan: colorToHex(getStyleProp(doc.querySelector<HTMLElement>('.hero-section .hero-text-top .slogan'), 'color')),
        descriptionAndTags: colorToHex(getStyleProp(doc.querySelector<HTMLElement>('.hero-section .hero-text-bottom .description-and-tags'), 'color')),
    };

    return {
        content: { textContent, specContent, heroTextContent, noticeContent, imageUrls },
        styles: { fontSizes, fontStyles, heroTextColors }
    };
};
