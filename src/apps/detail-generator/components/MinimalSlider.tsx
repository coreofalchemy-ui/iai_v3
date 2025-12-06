import React from 'react';

interface MinimalSliderProps {
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    className?: string;
    step?: number;
}

export const MinimalSlider: React.FC<MinimalSliderProps> = ({
    value,
    min,
    max,
    onChange,
    className = "",
    step = 1
}) => {
    return (
        <div className={`relative flex items-center ${className}`}>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-[2px] bg-[#333] appearance-none cursor-pointer focus:outline-none border-none outline-none ring-0 shadow-none m-0 p-0"
                style={{
                    WebkitAppearance: 'none',
                    background: '#333'
                }}
            />
            <style>{`
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: #000;
                    border: 2px solid #e5e5e5;
                    cursor: pointer;
                    margin-top: -6px; /* thumb height/2 - track height/2 */
                    /* transform: translateY(50%); REMOVED for better centering */
                    box-shadow: 0 0 2px rgba(0,0,0,0.5);
                }
                input[type=range]::-moz-range-thumb {
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: #000;
                    border: 2px solid #e5e5e5;
                    cursor: pointer;
                    box-shadow: 0 0 2px rgba(0,0,0,0.5);
                }
                input[type=range]::-webkit-slider-runnable-track {
                    width: 100%;
                    height: 2px;
                    cursor: pointer;
                    background: #333;
                    border-radius: 1px;
                }
                input[type=range]::-moz-range-track {
                    width: 100%;
                    height: 2px;
                    cursor: pointer;
                    background: #333;
                    border-radius: 1px;
                }
            `}</style>
        </div>
    );
};
