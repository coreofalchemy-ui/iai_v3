import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RedX, Squiggle, Scratch, ScribbleHighlight, CircleHighlight } from './Scribbles';
import { TrendChart } from './TrendChart';
import { ToolType, ToolConfig } from './types';
import ShoeUploadModal from './ShoeUploadModal';
import QuickTransferModal, { QuickTransferOptions } from './QuickTransferModal';
import './landing.css';

// --- Images ---
const TOOL_IMAGES: Record<string, string> = {
    [ToolType.StyleTransfer]: "https://images.unsplash.com/photo-1598554125029-72d737432a3d?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.QuickTransfer]: "https://images.unsplash.com/photo-1579353977828-2a5eab4f01fa?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.VirtualTryOn]: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.TrendPrediction]: "",
    [ToolType.SketchToImage]: "https://images.unsplash.com/photo-1589830308519-c28b92c489b9?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.OutfitRec]: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.PatternCreation]: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80&v=4"
};

const TOOL_IMAGES_HOVER: Record<string, string> = {
    [ToolType.StyleTransfer]: "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.QuickTransfer]: "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.VirtualTryOn]: "https://images.unsplash.com/photo-1611095790444-1dfa35e37b52?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.TrendPrediction]: "",
    [ToolType.SketchToImage]: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.OutfitRec]: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.PatternCreation]: "https://images.unsplash.com/photo-1620799140408-ed5341cd2431?auto=format&fit=crop&w=800&q=80&v=4"
};

const FALLBACK_IMAGES: Record<string, string> = {
    [ToolType.StyleTransfer]: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.QuickTransfer]: "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.VirtualTryOn]: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.SketchToImage]: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.OutfitRec]: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80&v=4",
    [ToolType.PatternCreation]: "https://images.unsplash.com/photo-1574169208507-84376144848b?auto=format&fit=crop&w=800&q=80&v=4",
    "default": "https://images.unsplash.com/photo-1550614000-4b9519e0037a?auto=format&fit=crop&w=800&q=80&v=4"
};

const TOOLS_ROW_1: ToolConfig[] = [
    { id: ToolType.StyleTransfer, title: 'Style Transfer', description: 'Instantly apply iconic artistic styles to your designs.', actionText: 'Try Style Transfer', image: TOOL_IMAGES[ToolType.StyleTransfer] },
    { id: ToolType.QuickTransfer, title: 'Quick Transfer', description: 'Model + Shoe composite with AI-powered tone matching.', actionText: 'Try Quick Transfer', image: TOOL_IMAGES[ToolType.QuickTransfer] }
];

const TOOLS_ROW_2: ToolConfig[] = [
    { id: ToolType.VirtualTryOn, title: 'Virtual Try-On', description: 'Real-time garment visualization on any body type.', actionText: 'Experience Virtual Try-On', image: TOOL_IMAGES[ToolType.VirtualTryOn] },
    { id: ToolType.TrendPrediction, title: 'Content Generator', description: 'Create stunning content with AI shoe replacement.', actionText: 'Generate Content', image: '' }
];

const TOOLS_ROW_3: ToolConfig[] = [
    { id: ToolType.SketchToImage, title: 'Sketch-to-Image', description: 'Turn your rough concepts into high-quality renders.', actionText: 'Convert Sketch', image: TOOL_IMAGES[ToolType.SketchToImage] },
    { id: ToolType.OutfitRec, title: 'Model Generator', description: 'Generate faces, swap outfits, and change poses.', actionText: 'Generate Model', image: TOOL_IMAGES[ToolType.OutfitRec] },
    { id: ToolType.PatternCreation, title: 'Custom Pattern Creation', description: 'Design bespoke motifs and prints with intuitive tools.', actionText: 'Create Pattern', image: TOOL_IMAGES[ToolType.PatternCreation] }
];

// --- Components ---
const NavBar: React.FC<{ onNavigate: () => void }> = ({ onNavigate }) => (
    <nav className="flex flex-col md:flex-row justify-between items-center px-8 py-4 border-b-4 border-black bg-[#f2f0e9] sticky top-0 z-50">
        <div className="flex items-center">
            <div className="w-12 h-12 bg-[#d00000] rounded-full mr-4 border-2 border-black"></div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-[#d00000] impact-font leading-[0.8]">i.m impact</h1>
        </div>
        <div className="flex flex-wrap gap-4 md:gap-6 mt-4 md:mt-0 font-bold text-sm items-center font-oswald tracking-widest">
            <button className="bg-[#d00000] text-white px-3 py-1 flex items-center gap-2 hover:bg-black transition-colors border-2 border-black"><span className="text-xl leading-none">≡</span> MENU</button>
            <button onClick={onNavigate} className="hover:text-[#d00000] decoration-2 underline-offset-4 uppercase">AI Tools</button>
            <a href="#portfolio" className="hover:text-[#d00000] decoration-2 underline-offset-4 uppercase">Portfolio</a>
            <a href="#about" className="hover:text-[#d00000] decoration-2 underline-offset-4 uppercase">About</a>
            <button onClick={onNavigate} className="bg-black text-white px-5 py-2 hover:bg-[#d00000] transition-colors uppercase border-2 border-transparent hover:border-black">Join</button>
            <a href="#login" className="border-2 border-black px-5 py-2 hover:bg-black hover:text-white transition-colors uppercase">Login</a>
        </div>
    </nav>
);

const MarqueeSection = () => (
    <div className="w-full bg-[#d00000] border-y-4 border-black overflow-hidden py-3 relative z-20">
        <div className="whitespace-nowrap animate-marquee flex gap-8">
            {Array(20).fill("I.M IMPACT /// AI FASHION /// REDEFINE ///").map((text, i) => (
                <span key={i} className="text-2xl font-bold impact-font text-white tracking-widest uppercase">{text}</span>
            ))}
        </div>
    </div>
);

const Hero = () => (
    <header className="relative w-full p-6 md:p-16 overflow-hidden bg-[#f2f0e9]">
        <div className="absolute top-4 left-4 text-xs font-mono tracking-widest border-b border-black">AI FASHION DETAIL PAGE</div>
        <Squiggle className="absolute top-10 right-10 w-48 text-black opacity-30" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10 mt-8">
            <div className="lg:col-span-4 relative h-[500px] flex items-center justify-center">
                <div className="absolute top-0 left-0 w-3/4 h-3/4 border-2 border-black p-2 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rotate-[-3deg] z-10">
                    <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80&v=4" alt="Model 1" className="w-full h-full object-cover grayscale contrast-125" onError={(e) => { e.currentTarget.src = FALLBACK_IMAGES['default']; }} />
                    <ScribbleHighlight className="absolute top-0 right-0 w-32 h-32 text-[#d00000] opacity-80" />
                    <RedX className="absolute bottom-[-20px] left-[-20px] w-20 h-20 rotate-12 z-20" />
                </div>
                <div className="absolute bottom-10 right-0 w-48 h-56 border-2 border-black bg-white p-1 rotate-[5deg] z-20 shadow-lg">
                    <img src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=400&q=80&v=4" alt="Detail" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = FALLBACK_IMAGES[ToolType.PatternCreation]; }} />
                    <CircleHighlight className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 text-black" />
                </div>
                <div className="absolute top-[-20px] left-[-10px] z-30 font-marker text-4xl text-black rotate-[-15deg]">#RAW</div>
            </div>

            <div className="lg:col-span-4 flex flex-col justify-center items-center text-center z-30 pt-10 lg:pt-0">
                <h2 className="text-7xl md:text-8xl font-bold impact-font mb-6 leading-[0.8] uppercase">Redefine<br /><span className="text-[#d00000]">Fashion</span><br />With AI.</h2>
                <div className="w-24 h-2 bg-black mb-6"></div>
                <p className="font-mono text-sm mb-8 max-w-xs leading-relaxed uppercase bg-white p-2 border border-black shadow-[4px_4px_0px_0px_rgba(208,0,0,1)]">Unleash Creativity. Explore the cutting-edge of generative design.</p>
                <Scratch className="w-full h-32 absolute bottom-0 opacity-20 pointer-events-none" />
            </div>

            <div className="lg:col-span-4 relative h-[500px] hidden lg:block">
                <div className="absolute top-0 right-4 w-48 h-64 border-2 border-black bg-white p-1 rotate-[3deg] z-20 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] group hover:scale-105 transition-transform">
                    <img src="https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=400&q=80&v=4" alt="Red Dress" className="w-full h-full object-cover contrast-110" onError={(e) => { e.currentTarget.src = FALLBACK_IMAGES[ToolType.OutfitRec]; }} />
                    <RedX className="absolute -top-6 -right-6 w-16 h-16 text-[#d00000] z-30" />
                </div>
                <div className="absolute top-32 left-8 w-56 h-64 border-2 border-black bg-white p-1 rotate-[-4deg] z-10 grayscale hover:grayscale-0 transition-all">
                    <img src="https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?auto=format&fit=crop&w=400&q=80&v=4" alt="Black Outfit" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = FALLBACK_IMAGES['default']; }} />
                </div>
                <div className="absolute bottom-0 right-10 w-44 h-44 border-2 border-black bg-white p-1 rotate-[-8deg] z-30">
                    <img src="https://images.unsplash.com/photo-1559563458-527698bf5295?auto=format&fit=crop&w=400&q=80&v=4" alt="Fur" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = FALLBACK_IMAGES[ToolType.QuickTransfer]; }} />
                    <div className="absolute bottom-2 right-2 bg-black text-white text-[10px] px-1 font-mono">TEXTURE_GEN</div>
                </div>
                <Squiggle className="absolute bottom-20 left-0 w-32 h-8 rotate-45 text-[#d00000]" />
            </div>
        </div>
    </header>
);

const FeatureCard: React.FC<{ tool: ToolConfig; onSelect: () => void; wide?: boolean }> = ({ tool, onSelect, wide }) => {
    const isTrend = tool.id === ToolType.TrendPrediction;

    return (
        <div className="relative border-2 border-black bg-white p-3 md:p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[10px_10px_0px_0px_rgba(208,0,0,1)] transition-all h-full flex flex-col group">
            <div className={`w-full ${wide ? 'h-64' : 'aspect-[4/3]'} relative overflow-hidden border border-black bg-gray-100 mb-4`}>
                {isTrend ? (
                    <TrendChart />
                ) : (
                    <div className="relative w-full h-full cursor-pointer overflow-hidden">
                        <img src={tool.image} alt={tool.title} className="absolute inset-0 w-full h-full object-cover filter contrast-110 transition-opacity duration-300 group-hover:opacity-0" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGES[tool.id] || FALLBACK_IMAGES['default']; }} />
                        <img src={TOOL_IMAGES_HOVER[tool.id] || tool.image} alt={`${tool.title} Effect`} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 opacity-0 group-hover:opacity-100" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGES[tool.id] || FALLBACK_IMAGES['default']; }} />
                        {tool.id === ToolType.SketchToImage && (<div className="absolute top-2 right-2 bg-white border border-black px-2 py-1 text-[10px] font-bold z-20 group-hover:bg-[#d00000] group-hover:text-white">SKETCH → REAL</div>)}
                        <RedX className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-full bg-black text-white text-center py-1 text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity z-30">SYSTEM.APPLY_EFFECT({tool.id})</div>
                    </div>
                )}
            </div>

            <div className="flex flex-col flex-grow justify-between relative z-10">
                <div className="mb-4">
                    <h3 className="text-2xl md:text-3xl font-bold impact-font uppercase leading-none mb-2 group-hover:text-[#d00000] transition-colors">{tool.title}</h3>
                    <p className="font-mono text-xs leading-tight opacity-80">{tool.description}</p>
                </div>
                <button onClick={onSelect} className="bg-[#d00000] text-white text-[10px] md:text-xs font-bold uppercase py-2 px-4 self-start hover:bg-black transition-colors border-2 border-transparent hover:border-white shadow-md">
                    <span className="bg-white text-black px-1 mr-1 text-[8px] border border-black inline-block transform -translate-y-[1px]">AI</span> {tool.actionText}
                </button>
            </div>
            <div className="absolute inset-0 border-4 border-[#d00000] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>
        </div>
    );
};

const PortfolioSection = () => (
    <section id="portfolio" className="border-t-4 border-black mt-0">
        <div className="bg-[#d00000] py-8 text-center border-b-4 border-black relative overflow-hidden">
            <h2 className="text-5xl md:text-8xl impact-font text-black uppercase tracking-tighter relative z-10 mix-blend-multiply">AI FASHION PORTFOLIO VIEW</h2>
            <Squiggle className="absolute top-1/2 right-1/4 w-64 h-24 text-white opacity-40 -translate-y-1/2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-b-4 border-black bg-black">
            {["https://images.unsplash.com/photo-1539109136881-3be0616acf4b", "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6", "https://images.unsplash.com/photo-1581044777550-4cfa60707c03", "https://images.unsplash.com/photo-1529139574466-a302d2753cd4", "https://images.unsplash.com/photo-1578632292335-df3abbb0d586", "https://images.unsplash.com/photo-1534528741775-53994a69daeb"].map((img, i) => (
                <div key={i} className="relative group border-r border-white/20 last:border-r-0 aspect-[2/3] overflow-hidden cursor-crosshair">
                    <img src={`${img}?auto=format&fit=crop&w=400&q=80&v=4`} alt="Portfolio" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all grayscale group-hover:grayscale-0 duration-500" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGES['default']; }} />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 duration-200 pointer-events-none bg-black/20"><RedX className="w-24 h-24" /></div>
                    <div className="absolute top-2 left-2 text-xs font-mono text-white/50 group-hover:text-[#d00000] bg-black px-1">REF_00{i + 1}</div>
                </div>
            ))}
        </div>
        <div className="bg-[#111] p-12 flex flex-col md:flex-row justify-center items-center gap-8 relative overflow-hidden">
            <RedX className="absolute right-[-50px] bottom-[-50px] w-64 h-64 text-[#d00000] opacity-20 rotate-45" />
            <div className="bg-[#d00000] text-white border-2 border-white px-8 py-3 font-bold uppercase hover:bg-white hover:text-[#d00000] cursor-pointer transition-colors shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] flex items-center gap-2"><span className="text-xl">✕</span> View Full Portfolio</div>
            <div className="bg-white text-black border-2 border-black px-8 py-3 font-bold uppercase hover:bg-black hover:text-white cursor-pointer transition-colors shadow-[6px_6px_0px_0px_rgba(208,0,0,1)]">Submit Your AI Designs</div>
        </div>
    </section>
);

const Footer = () => (
    <footer className="bg-[#f2f0e9] border-t-4 border-black p-10 text-xs font-mono relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 relative z-10">
            <div className="flex gap-8 uppercase font-bold tracking-widest text-sm">
                <a href="#" className="hover:text-[#d00000] underline decoration-2 decoration-wavy">Terms of Use</a>
                <a href="#" className="hover:text-[#d00000] underline decoration-2 decoration-wavy">Privacy Policy</a>
                <a href="#" className="hover:text-[#d00000] underline decoration-2 decoration-wavy">Contact</a>
            </div>
            <div className="flex gap-4">
                {['fb', 'ig', 'tw', 'yt'].map(s => (<div key={s} className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center hover:bg-[#d00000] hover:text-white hover:border-[#d00000] cursor-pointer transition-all text-lg font-black uppercase">{s}</div>))}
            </div>
        </div>
        <Squiggle className="absolute bottom-[-10px] left-1/2 transform -translate-x-1/2 w-96 h-12 text-[#d00000] opacity-50" />
        <div className="mt-12 text-center font-bold opacity-40 uppercase tracking-widest">© 2025 i.m impact | AI Fashion Studio</div>
    </footer>
);

// --- Main Landing Page ---
export default function LandingPage() {
    const navigate = useNavigate();
    const [showShoeUploadModal, setShowShoeUploadModal] = useState(false);
    const [showQuickTransferModal, setShowQuickTransferModal] = useState(false);

    const handleNavigateToApp = () => {
        navigate('/detail-generator');
    };

    const handleStyleTransferClick = () => {
        setShowShoeUploadModal(true);
    };

    const handleQuickTransferClick = () => {
        setShowQuickTransferModal(true);
    };

    const handleGenerateWithShoes = (shoes: File[]) => {
        // Navigate with shoe files in state
        navigate('/detail-generator', {
            state: {
                shoes: shoes.map(file => ({
                    name: file.name,
                    url: URL.createObjectURL(file)
                }))
            }
        });
    };

    const handleGenerateWithoutShoes = () => {
        setShowShoeUploadModal(false);
        navigate('/detail-generator');
    };

    const handleQuickTransferGenerate = (options: QuickTransferOptions) => {
        setShowQuickTransferModal(false);
        navigate('/detail-generator', {
            state: {
                quickTransfer: options
            }
        });
    };

    const handleFeatureCardClick = (toolId: string) => {
        if (toolId === ToolType.StyleTransfer) {
            handleStyleTransferClick();
        } else if (toolId === ToolType.QuickTransfer) {
            handleQuickTransferClick();
        } else if (toolId === ToolType.TrendPrediction) {
            navigate('/content-generator');
        } else if (toolId === ToolType.SketchToImage) {
            navigate('/sketch-editor');
        } else if (toolId === ToolType.OutfitRec) {
            navigate('/model-generator');
        } else if (toolId === ToolType.VirtualTryOn) {
            navigate('/gemini-chat'); // Gemini Chat for now
        } else {
            handleNavigateToApp();
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#f2f0e9]">
            <NavBar onNavigate={handleNavigateToApp} />

            <main className="flex-grow">
                <Hero />
                <MarqueeSection />

                <div id="tools" className="container mx-auto px-4 md:px-12 py-20 relative">
                    <div className="absolute left-[-20px] top-[100px] font-marker text-9xl text-gray-200 rotate-90 pointer-events-none z-0">CREATE</div>

                    <div className="relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-12">
                            {TOOLS_ROW_1.map(tool => (<div key={tool.id} className="h-[400px]"><FeatureCard tool={tool} onSelect={() => handleFeatureCardClick(tool.id)} /></div>))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-12">
                            {TOOLS_ROW_2.map(tool => (<div key={tool.id} className="h-[400px]"><FeatureCard tool={tool} onSelect={() => handleFeatureCardClick(tool.id)} wide /></div>))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-8">
                            {TOOLS_ROW_3.map(tool => (<div key={tool.id} className="h-[450px]"><FeatureCard tool={tool} onSelect={() => handleFeatureCardClick(tool.id)} /></div>))}
                        </div>
                    </div>
                </div>

                <PortfolioSection />
            </main>

            <Footer />

            {/* Shoe Upload Modal */}
            <ShoeUploadModal
                visible={showShoeUploadModal}
                onClose={() => setShowShoeUploadModal(false)}
                onGenerate={handleGenerateWithShoes}
                onGenerateWithoutShoes={handleGenerateWithoutShoes}
            />

            {/* Quick Transfer Modal */}
            <QuickTransferModal
                visible={showQuickTransferModal}
                onClose={() => setShowQuickTransferModal(false)}
                onGenerate={handleQuickTransferGenerate}
            />
        </div>
    );
}
