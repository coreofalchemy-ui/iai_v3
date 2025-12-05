import React from 'react';

interface StartScreenProps {
    onGenerate: (pFiles: File[], mFiles: File[], mode: 'original' | 'studio' | 'frame') => void;
    isLoading: boolean;
}

// Feature Card Data
const features = [
    {
        id: 'style-transfer',
        title: 'STYLE TRANSFER',
        subtitle: 'TRY STYLE TRANSFER',
        description: 'Instantly apply iconic artistic styles to your designs.',
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=400&fit=crop',
        action: 'frame'
    },
    {
        id: 'fabric-generation',
        title: 'FABRIC GENERATION',
        subtitle: 'GENERATE FABRIC',
        description: 'Create unique, realistic textile patterns and materials.',
        image: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=300&h=400&fit=crop',
        action: null
    },
    {
        id: 'virtual-tryon',
        title: 'VIRTUAL TRY-ON',
        subtitle: 'EXPERIENCE VIRTUAL TRY-ON',
        description: 'Real-time garment visualization on any body type.',
        image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300&h=400&fit=crop',
        action: null
    },
    {
        id: 'trend-prediction',
        title: 'TREND PREDICTION',
        subtitle: 'EXPLORE TRENDS',
        description: 'Stay ahead with AI-powered fashion forecasts.',
        image: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=300&h=400&fit=crop',
        action: null
    },
    {
        id: 'sketch-to-image',
        title: 'SKETCH-TO-IMAGE',
        subtitle: 'CONVERT SKETCH',
        description: 'Turn your rough concepts into high-quality renders.',
        image: 'https://images.unsplash.com/photo-1558618047-f4b511165ce0?w=300&h=400&fit=crop',
        action: null
    },
    {
        id: 'pattern-creation',
        title: 'CUSTOM PATTERN CREATION',
        subtitle: 'CREATE PATTERN',
        description: 'Design bespoke motifs and prints with intuitive tools.',
        image: 'https://images.unsplash.com/photo-1558171814-78d5e7e5b9b5?w=300&h=400&fit=crop',
        action: null
    }
];

// Portfolio Items
const portfolioItems = [
    { id: 1, title: 'Generative Couture', subtitle: 'Collection 01', image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=500&fit=crop' },
    { id: 2, title: 'Synthetic Streetwear', subtitle: 'Series A', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=500&fit=crop' },
    { id: 3, title: 'Synthetic Sheetwear', subtitle: 'Series B', image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&h=500&fit=crop' }
];

export default function StartScreen({ onGenerate, isLoading }: StartScreenProps) {
    const handleFeatureClick = (feature: typeof features[0]) => {
        if (feature.id === 'style-transfer') {
            // Style Transfer 클릭 시 프레임 생성 모드로 진입
            onGenerate([], [], 'frame');
        }
    };

    return (
        <div className="min-h-screen paper-bg">
            {/* Header / Navigation */}
            <header className="sticky top-0 z-50 bg-[#F5F0E8]/95 backdrop-blur-sm border-b-2 border-black">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl md:text-4xl font-bold handwritten tracking-wide" style={{ fontFamily: "'Permanent Marker', cursive" }}>
                                i.m impact
                            </h1>
                        </div>

                        {/* Navigation */}
                        <nav className="hidden md:flex items-center gap-6">
                            <span className="text-xs uppercase tracking-wider font-semibold cursor-pointer hover:text-red-600 transition-colors">≡ MENU</span>
                            <span className="text-xs uppercase tracking-wider font-semibold cursor-pointer hover:text-red-600 transition-colors">AI TOOLS</span>
                            <span className="text-xs uppercase tracking-wider font-semibold cursor-pointer hover:text-red-600 transition-colors">PORTFOLIO</span>
                            <span className="text-xs uppercase tracking-wider font-semibold cursor-pointer hover:text-red-600 transition-colors">ABOUT</span>
                            <button className="px-4 py-2 border-2 border-black text-xs uppercase tracking-wider font-semibold hover:bg-black hover:text-white transition-all">
                                JOIN
                            </button>
                            <span className="text-xs uppercase tracking-wider font-semibold cursor-pointer hover:text-red-600 transition-colors">LOGIN</span>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Subheader */}
            <div className="border-b border-gray-300 py-2">
                <div className="container mx-auto px-6">
                    <p className="text-sm uppercase tracking-widest text-gray-600" style={{ fontFamily: "'Special Elite', monospace" }}>
                        AI FASHION DETAIL PAGE
                    </p>
                </div>
            </div>

            {/* Hero Section */}
            <section className="py-12 md:py-20">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                        {/* Left: Hero Images Collage */}
                        <div className="relative">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative transform rotate-[-2deg]">
                                    <div className="absolute -top-3 -right-3 text-4xl text-red-600 font-bold z-10">✕</div>
                                    <img
                                        src="https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=500&fit=crop"
                                        alt="Fashion Model 1"
                                        className="w-full h-64 object-cover border-4 border-black shadow-[6px_6px_0_rgba(0,0,0,0.3)]"
                                    />
                                </div>
                                <div className="relative transform rotate-[3deg] mt-8">
                                    <img
                                        src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=500&fit=crop"
                                        alt="Fashion Model 2"
                                        className="w-full h-64 object-cover border-4 border-black shadow-[6px_6px_0_rgba(0,0,0,0.3)]"
                                    />
                                    <div className="absolute -bottom-3 -left-3 text-4xl text-red-600 font-bold">✕</div>
                                </div>
                            </div>
                            {/* Decorative Ink Splatters */}
                            <div className="absolute -bottom-4 left-1/4 w-8 h-8 bg-red-600 rounded-full opacity-60"></div>
                            <div className="absolute -top-2 right-1/4 w-4 h-4 bg-red-600 rounded-full opacity-40"></div>
                        </div>

                        {/* Right: Hero Text */}
                        <div className="space-y-6">
                            <h2 className="text-5xl md:text-7xl font-black uppercase leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                                REDEFINE FASHION WITH AI.<br />
                                UNLEASH CREATIVITY.
                            </h2>
                            <p className="text-lg text-gray-600 max-w-md">
                                Explore the cutting-edge of generative design, fabric synthesis, and virtual try-ons.
                            </p>
                            {/* Decorative Line */}
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-1 bg-black"></div>
                                <span className="text-red-600 text-2xl">✕</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Feature Cards Grid */}
            <section className="py-16">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {features.map((feature, index) => (
                            <div
                                key={feature.id}
                                onClick={() => handleFeatureClick(feature)}
                                className={`group relative bg-[#FFFEF9] border-2 border-black p-6 transition-all duration-300 ${feature.action ? 'cursor-pointer hover:shadow-[8px_8px_0_rgba(0,0,0,0.3)] hover:-translate-y-1' : 'opacity-75'
                                    }`}
                                style={{
                                    transform: `rotate(${index % 2 === 0 ? '-1deg' : '1deg'})`
                                }}
                            >
                                {/* Red X Decoration */}
                                <div className="absolute -top-3 -right-3 text-3xl text-red-600 font-bold opacity-80">✕</div>

                                <div className="flex gap-6">
                                    {/* Feature Image */}
                                    <div className="w-32 h-40 flex-shrink-0 overflow-hidden border-2 border-black">
                                        <img
                                            src={feature.image}
                                            alt={feature.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                    </div>

                                    {/* Feature Content */}
                                    <div className="flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-2xl font-black uppercase mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                                                {feature.title}
                                            </h3>
                                            {feature.action && (
                                                <button className="inline-block px-3 py-1 bg-red-600 text-white text-xs uppercase tracking-wider font-semibold mb-3 hover:bg-red-700 transition-colors"
                                                    style={{ fontFamily: "'Special Elite', monospace" }}>
                                                    {feature.subtitle}
                                                </button>
                                            )}
                                            <p className="text-sm text-gray-600 leading-relaxed">
                                                {feature.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Hover Indicator for Active Features */}
                                {feature.action && (
                                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-xs uppercase tracking-wider font-bold">Enter →</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Portfolio Section */}
            <section className="py-16 bg-red-600">
                <div className="container mx-auto px-6">
                    <h2 className="text-4xl md:text-5xl font-black text-white uppercase text-center mb-12" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                        AI FASHION PORTFOLIO VIEW
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {portfolioItems.map((item, index) => (
                            <div
                                key={item.id}
                                className="group relative"
                                style={{ transform: `rotate(${index === 1 ? '0deg' : index === 0 ? '-2deg' : '2deg'})` }}
                            >
                                {/* Red X Decoration */}
                                <div className="absolute -top-4 -right-4 text-4xl text-white font-bold z-10">✕</div>

                                <div className="relative overflow-hidden border-4 border-white shadow-lg">
                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        className="w-full h-80 object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                        <p className="text-white text-xs uppercase tracking-wider opacity-80">{item.subtitle}</p>
                                        <h3 className="text-white font-bold">{item.title}</h3>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Portfolio Actions */}
                    <div className="flex justify-center gap-6 mt-12">
                        <button className="flex items-center gap-2 px-6 py-3 border-2 border-white text-white uppercase tracking-wider text-sm font-semibold hover:bg-white hover:text-red-600 transition-all">
                            <span className="text-xl">✕</span>
                            VIEW FULL PORTFOLIO
                        </button>
                        <button className="px-6 py-3 bg-white text-red-600 border-2 border-white uppercase tracking-wider text-sm font-semibold hover:bg-transparent hover:text-white transition-all">
                            SUBMIT YOUR AI DESIGNS
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 border-t-2 border-black">
                <div className="container mx-auto px-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-6 text-xs uppercase tracking-wider text-gray-600">
                            <span className="hover:text-black cursor-pointer transition-colors">TERMS OF USE</span>
                            <span className="hover:text-black cursor-pointer transition-colors">PRIVACY POLICY</span>
                            <span className="hover:text-black cursor-pointer transition-colors">CONTACT</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="w-8 h-8 flex items-center justify-center border-2 border-black rounded-full hover:bg-black hover:text-white cursor-pointer transition-all">f</span>
                            <span className="w-8 h-8 flex items-center justify-center border-2 border-black rounded-full hover:bg-black hover:text-white cursor-pointer transition-all">○</span>
                            <span className="w-8 h-8 flex items-center justify-center border-2 border-black rounded-full hover:bg-black hover:text-white cursor-pointer transition-all">✕</span>
                            <span className="w-8 h-8 flex items-center justify-center border-2 border-black rounded-full hover:bg-black hover:text-white cursor-pointer transition-all">▶</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
