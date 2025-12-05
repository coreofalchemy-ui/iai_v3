import React from 'react';

export const RedX: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 15 L85 85" stroke="#d00000" strokeWidth="12" strokeLinecap="round" />
        <path d="M85 15 L15 85" stroke="#d00000" strokeWidth="12" strokeLinecap="round" />
    </svg>
);

export const Squiggle: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg className={className} viewBox="0 0 200 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 25 Q25 10 50 25 T100 25 T150 25 T200 25" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
);

export const Scratch: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg className={className} viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 50 L190 50" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <path d="M20 30 L180 70" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
        <path d="M30 70 L170 30" stroke="currentColor" strokeWidth="1" opacity="0.15" />
    </svg>
);

export const ScribbleHighlight: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 80 Q50 20 80 80" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M30 70 Q55 25 75 75" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
    </svg>
);

export const CircleHighlight: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="10 5" />
    </svg>
);

export const Button: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({ children, onClick, className = '' }) => (
    <button
        onClick={onClick}
        className={`bg-[#d00000] text-white text-xs font-bold uppercase py-2 px-4 hover:bg-black transition-colors border-2 border-transparent hover:border-white shadow-md ${className}`}
    >
        {children}
    </button>
);
