
export type FilterPresetName = 'original' | 'wconcept' | 'musinsa' | 'cm29' | 'krem' | 'global';

export interface FilterParams {
    name: string;
    label: string;
    temp: number; // -100 to 100
    tint: number; // -100 to 100
    sat: number;  // -100 to 100
    ctr: number;  // -100 to 100
    black: number; // 0 to 100 (Shadow lift)
    roll: number;  // 0 to 100 (Highlight rolloff/dim)
    grain: number; // 0.0 to 1.0
    gsize: number; // px
    glow: number;  // 0.0 to 1.0 (Opacity of blur layer)
}

export const FILTER_PRESETS: Record<FilterPresetName, FilterParams> = {
    original: {
        name: 'original', label: '원본 (Original)',
        temp: 0, tint: 0, sat: 0, ctr: 0, black: 0, roll: 0, grain: 0, gsize: 0, glow: 0
    },
    wconcept: {
        name: 'wconcept', label: 'W컨셉 (성수동 감성)',
        temp: -14, tint: -3, sat: -8, ctr: -3, black: 12, roll: 10, grain: 0.14, gsize: 21, glow: 0.05
    },
    musinsa: {
        name: 'musinsa', label: '무신사 (힙 스트릿)',
        // Adjusted for "Hip" feel: Cool but not blue (-50), High Contrast (+15), Desaturated (-15)
        temp: -50, tint: 0, sat: -15, ctr: 15, black: 5, roll: 5, grain: 0.10, gsize: 18, glow: 0
    },
    cm29: {
        name: 'cm29', label: '29CM (빈티지 웜)',
        temp: 8, tint: 1, sat: -8, ctr: -6, black: 10, roll: 12, grain: 0.10, gsize: 18, glow: 0.02
    },
    krem: {
        name: 'krem', label: '크림 (쨍한 느낌)',
        temp: 8, tint: 1, sat: -6, ctr: -2, black: 8, roll: 6, grain: 0.10, gsize: 18, glow: 0.04
    },
    global: {
        name: 'global', label: '핀터레스트 (클린)',
        temp: 0, tint: 0, sat: 0, ctr: 6, black: 0, roll: 4, grain: 0.08, gsize: 18, glow: 0
    }
};

/**
 * Generates the CSS styles for the filter layers
 */
export const getFilterStyles = (presetName: FilterPresetName) => {
    const params = FILTER_PRESETS[presetName] || FILTER_PRESETS.original;

    // 1. Base CSS Filter (Sat, Ctr, Brightness)
    // Saturation: 1 + (sat / 100)
    // Contrast: 1 + (ctr / 100)
    // Brightness: Adjusted by Highlight Roll (dimming) and Black (lift) - Simplified
    // We'll use brightness to handle 'roll' primarily (dimming highlights)
    const saturation = 1 + (params.sat / 100);
    const contrast = 1 + (params.ctr / 100);
    const brightness = 1 - (params.roll / 200); // Slight dimming for film look

    const baseFilter = `saturate(${saturation}) contrast(${contrast}) brightness(${brightness})`;

    // 2. Color Grading Overlay (Soft Light)
    // Temp > 0: Red/Orange, Temp < 0: Blue/Cyan
    // Tint: Green vs Magenta (Not fully implemented in RGB shift easily without matrix, simplifying)
    let r = 128, g = 128, b = 128; // Neutral gray
    if (params.temp > 0) {
        r += params.temp * 1.5; // Warmer
        b -= params.temp * 0.5;
    } else {
        b -= params.temp * 1.5; // Cooler (param is negative)
        r += params.temp * 0.5;
    }
    // Tint (Green +, Magenta -) relative to RGB?
    // Simplified: Add G if tint > 0
    g += params.tint * 2;

    const overlayColor = `rgba(${Math.min(255, Math.max(0, r))}, ${Math.min(255, Math.max(0, g))}, ${Math.min(255, Math.max(0, b))}, 0.2)`;

    // 3. Grain Overlay
    // We'll simulate grain with a noise SVG data URI or simple pattern
    // For simplicity, we can use a repeating radial gradient or url if available.
    // Using a base64 noise PNG is better, but generating a simple CSS noise pattern:
    const grainOpacity = params.grain;

    // 4. Glow (Backdrop Blur or Box Shadow?)
    // 'backdrop-filter: blur()' on an overlay creates a "frosted glass" look, not bloom.
    // To fake bloom/glow with CSS only is hard without duplicating the image.
    // We'll use a subtle white overlay with screen mode for "haze"?
    // Or just brightness lift?
    // Using opacity of a white layer for "Glow" parameter as a simplified "Fog" effect.
    const glowOpacity = params.glow;

    return {
        containerStyle: {
            filter: baseFilter,
            position: 'relative' as const,
        },
        overlayStyle: {
            position: 'absolute' as const,
            inset: 0,
            backgroundColor: overlayColor,
            mixBlendMode: 'soft-light' as const,
            pointerEvents: 'none' as const,
            zIndex: 10
        },
        grainStyle: {
            position: 'absolute' as const,
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='${grainOpacity}'/%3E%3C/svg%3E")`,
            backgroundSize: `${100 + params.gsize}%`, // Just scale it a bit
            mixBlendMode: 'overlay' as const,
            pointerEvents: 'none' as const,
            opacity: 1, // Controlled by SVG opacity
            zIndex: 11
        },
        glowStyle: {
            position: 'absolute' as const,
            inset: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            mixBlendMode: 'screen' as const,
            opacity: glowOpacity,
            pointerEvents: 'none' as const,
            zIndex: 12,
            filter: 'blur(10px)'
        }
    };
};
