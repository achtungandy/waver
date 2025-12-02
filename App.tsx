import React, { useState, useRef, useEffect } from 'react';
import { User, VideoConfig, AppStep, ProcessingResult } from './types';
import { generateVideoMetadata, analyzeMoodAndSuggestFont } from './services/geminiService';
import VisualizerCanvas, { VisualizerHandle } from './components/VisualizerCanvas';
import { 
  Music, Image as ImageIcon, Video, Upload, Play, Pause, 
  Download, Youtube, Wand2, Loader2, CheckCircle, Type, UserCircle 
} from 'lucide-react';

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<VideoConfig>({
    title: '',
    subtitle: '',
    fontFamily: 'sans',
    images: [],
    audio: null
  });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);

  const visualizerRef = useRef<VisualizerHandle>(null);

  // --- Step 1: Login ---
  const handleLogin = () => {
    // Mock Login
    setUser({
      name: "Creator Studio User",
      email: "user@example.com",
      avatar: "https://picsum.photos/100/100"
    });
    setStep(AppStep.UPLOAD);
  };

  // --- Step 2: Upload ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setConfig(prev => ({ ...prev, images: [...prev.images, ...Array.from(e.target.files || [])] }));
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setConfig(prev => ({ ...prev, audio: file }));
      
      // Auto-analyze with Gemini when audio is picked
      setIsGeminiLoading(true);
      const analysis = await analyzeMoodAndSuggestFont(file.name);
      setConfig(prev => ({
        ...prev,
        fontFamily: analysis.font as any || 'sans',
        subtitle: prev.subtitle || analysis.suggestedSubtitle
      }));
      setIsGeminiLoading(false);
    }
  };

  // --- Step 3: Editor & Gemini ---
  const handleGenerateMetadata = async () => {
    setIsGeminiLoading(true);
    // Simulate smart autofill
    if (!config.title) {
        setConfig(prev => ({ ...prev, title: "My Awesome Journey" }));
    }
    const meta = await generateVideoMetadata(config.title || "My Video", config.subtitle);
    // We store this for the final step
    setResult(prev => ({
        ...prev!,
        videoUrl: prev?.videoUrl || '',
        videoDescription: meta.description,
        hashtags: meta.hashtags
    }));
    setIsGeminiLoading(false);
  };

  // --- Step 4: Export ---
  const handleExport = async () => {
    // We do NOT unmount the editor here. We switch state to PROCESSING
    // which the renderEditor function will use to show an overlay.
    setIsPlaying(false); // Stop preview playback
    setStep(AppStep.PROCESSING);
    setIsProcessing(true);
    
    // 1. Generate final metadata if not already done
    if (!result?.videoDescription) {
        const meta = await generateVideoMetadata(config.title, config.subtitle);
        setResult({
            videoUrl: '', // Filled later
            videoDescription: meta.description,
            hashtags: meta.hashtags
        });
    }

    // 2. Start Canvas Recording
    // Using setTimeout to allow the UI to update to "Processing" state before heavy lifting
    setTimeout(async () => {
        if (visualizerRef.current) {
            try {
                const blob = await visualizerRef.current.startExport();
                const url = URL.createObjectURL(blob);
                setResultBlob(blob);
                setResult(prev => ({ ...prev!, videoUrl: url }));
                setStep(AppStep.DONE);
            } catch (err) {
                console.error(err);
                alert("Error exporting video. Please try again.");
                setStep(AppStep.EDITOR);
            } finally {
                setIsProcessing(false);
            }
        } else {
            console.error("Visualizer ref is missing");
            setStep(AppStep.EDITOR);
            setIsProcessing(false);
        }
    }, 100);
  };

  const handlePublishYoutube = () => {
      alert(`Publishing to YouTube channel of ${user?.name}...\n\nTitle: ${config.title}\nDesc: ${result?.videoDescription}\nTags: ${result?.hashtags.join(' ')}`);
  };

  // --- Render Helpers ---

  const renderLogin = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gemini-blue to-gemini-purple pb-2">
          Gemini WaveCreator
        </h1>
        <p className="text-slate-400 text-lg">Create AI-enhanced music videos in seconds.</p>
      </div>
      
      <button 
        onClick={handleLogin}
        className="flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-full font-bold hover:bg-slate-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C.79 9.81 0 12 0 12s.79 4.19 2.18 6.95l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Sign in with Google
      </button>
    </div>
  );

  const renderUpload = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <h2 className="text-3xl font-bold text-center">Upload Assets</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Photos */}
        <div className="bg-slate-800 p-8 rounded-2xl border-2 border-dashed border-slate-600 hover:border-gemini-blue transition-colors group text-center cursor-pointer relative">
          <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
          <ImageIcon className="w-12 h-12 mx-auto mb-4 text-slate-400 group-hover:text-gemini-blue" />
          <h3 className="font-semibold text-lg">Select Photos</h3>
          <p className="text-sm text-slate-500 mt-2">{config.images.length} photos selected</p>
        </div>

        {/* Audio */}
        <div className="bg-slate-800 p-8 rounded-2xl border-2 border-dashed border-slate-600 hover:border-gemini-purple transition-colors group text-center cursor-pointer relative">
          <input type="file" accept="audio/*" onChange={handleAudioUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
          {isGeminiLoading ? (
             <Loader2 className="w-12 h-12 mx-auto mb-4 text-gemini-purple animate-spin" />
          ) : (
             <Music className="w-12 h-12 mx-auto mb-4 text-slate-400 group-hover:text-gemini-purple" />
          )}
          <h3 className="font-semibold text-lg">Select Audio</h3>
          <p className="text-sm text-slate-500 mt-2">{config.audio ? config.audio.name : "No audio selected"}</p>
        </div>
      </div>

      <div className="flex justify-end pt-8">
        <button 
            disabled={!config.audio || config.images.length === 0}
            onClick={() => setStep(AppStep.EDITOR)}
            className="bg-gemini-blue disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2"
        >
          Next: Editor <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs">&rarr;</div>
        </button>
      </div>
    </div>
  );

  // Separate function for processing overlay content
  const renderProcessingOverlay = () => (
    <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl animate-fade-in">
        <div className="relative w-32 h-32 mb-8">
            <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="#1e293b" strokeWidth="8" fill="none" />
                <circle 
                    cx="64" cy="64" r="60" 
                    stroke="#4E8cFF" 
                    strokeWidth="8" 
                    fill="none" 
                    strokeDasharray={2 * Math.PI * 60}
                    strokeDashoffset={2 * Math.PI * 60 * (1 - exportProgress / 100)}
                    className="transition-all duration-300"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xl font-bold">
                {Math.round(exportProgress)}%
            </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Rendering your masterpiece...</h2>
        <p className="text-slate-400">Combining audio, transitions, and generating waveforms.</p>
        <p className="text-slate-500 text-sm mt-4">Please keep this tab active.</p>
    </div>
  );

  const renderEditor = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full relative">
      
      {/* Processing Overlay - Renders ON TOP of editor to keep editor mounted */}
      {step === AppStep.PROCESSING && renderProcessingOverlay()}

      {/* Left: Controls */}
      <div className="lg:col-span-1 bg-slate-800 p-6 rounded-2xl space-y-6 overflow-y-auto max-h-[80vh]">
        <div className="space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Type className="w-5 h-5 text-gemini-blue" /> Text Overlay
          </h3>
          
          <div>
            <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Main Title (Fades Out)</label>
            <div className="relative mt-1">
                <input 
                    type="text" 
                    value={config.title}
                    onChange={(e) => setConfig({...config, title: e.target.value})}
                    placeholder="e.g. Summer Vibes"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-gemini-blue focus:outline-none transition-all"
                />
                 <button 
                    onClick={handleGenerateMetadata}
                    title="Auto-generate title"
                    className="absolute right-2 top-2 p-1.5 hover:bg-slate-700 rounded-md text-gemini-purple"
                >
                    <Wand2 className="w-4 h-4" />
                </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Subtitle (Always On)</label>
            <input 
                type="text" 
                value={config.subtitle}
                onChange={(e) => setConfig({...config, subtitle: e.target.value})}
                placeholder="e.g. Artist Name"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 mt-1 focus:border-gemini-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Font Style</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
                {(['sans', 'serif', 'mono'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setConfig({...config, fontFamily: f})}
                        className={`p-2 rounded-lg border ${config.fontFamily === f ? 'border-gemini-blue bg-gemini-blue/10 text-gemini-blue' : 'border-slate-700 hover:border-slate-500'} capitalize`}
                    >
                        {f}
                    </button>
                ))}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-700 space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <Music className="w-5 h-5 text-gemini-purple" /> Preview
            </h3>
            <div className="flex gap-4">
                <button 
                    disabled={step === AppStep.PROCESSING}
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                    {isPlaying ? <Pause className="w-5 h-5"/> : <Play className="w-5 h-5"/>}
                    {isPlaying ? 'Pause' : 'Play'}
                </button>
            </div>
        </div>

        <div className="pt-6 border-t border-slate-700">
             <button 
                disabled={step === AppStep.PROCESSING}
                onClick={handleExport}
                className="w-full bg-gradient-to-r from-gemini-blue to-gemini-purple hover:opacity-90 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg"
            >
                {step === AppStep.PROCESSING ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                    <Video className="w-6 h-6" /> 
                )}
                {step === AppStep.PROCESSING ? 'Processing...' : 'Export Video'}
            </button>
        </div>
      </div>

      {/* Right: Canvas Preview */}
      <div className="lg:col-span-2 bg-black rounded-2xl overflow-hidden flex items-center justify-center relative aspect-video shadow-2xl border border-slate-800">
         <VisualizerCanvas 
            ref={visualizerRef}
            config={config} 
            isPlaying={isPlaying} 
            onEnded={() => setIsPlaying(false)}
            onExportProgress={(p) => setExportProgress(p)}
         />
      </div>
    </div>
  );

  const renderDone = () => (
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start animate-fade-in">
          <div className="space-y-6">
              <div className="flex items-center gap-4 text-green-400">
                  <CheckCircle className="w-10 h-10" />
                  <h2 className="text-3xl font-bold text-white">Ready!</h2>
              </div>
              
              <div className="bg-slate-800 p-6 rounded-2xl space-y-4">
                  <div>
                      <h3 className="text-slate-400 text-sm font-bold uppercase">Video Title</h3>
                      <p className="text-xl font-semibold">{config.title}</p>
                  </div>
                  <div>
                      <h3 className="text-slate-400 text-sm font-bold uppercase">AI Description</h3>
                      <p className="text-slate-300 italic">"{result?.videoDescription}"</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                      {result?.hashtags.map(tag => (
                          <span key={tag} className="text-gemini-blue text-sm bg-gemini-blue/10 px-2 py-1 rounded">
                              {tag}
                          </span>
                      ))}
                  </div>
              </div>

              <div className="flex gap-4">
                  {resultBlob && (
                      <a 
                        href={URL.createObjectURL(resultBlob)} 
                        download={`gemini-wave-${Date.now()}.mp4`}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                      >
                          <Download className="w-5 h-5" /> Download MP4
                      </a>
                  )}
                  <button 
                    onClick={handlePublishYoutube}
                    className="flex-1 bg-[#FF0000] hover:bg-[#cc0000] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                  >
                      <Youtube className="w-5 h-5" /> Publish
                  </button>
              </div>
              
              <button 
                onClick={() => setStep(AppStep.EDITOR)}
                className="text-slate-400 hover:text-white underline text-sm"
              >
                Back to Editor
              </button>
          </div>

          <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
              <video 
                src={result?.videoUrl} 
                controls 
                className="w-full aspect-video"
              />
          </div>
          
          <div className="absolute top-4 right-4 bg-slate-800 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg animate-slide-in">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm font-medium">Render complete</span>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-6">
      {/* Header */}
      {user && (
        <header className="flex justify-between items-center max-w-7xl mx-auto mb-12">
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-gemini-blue to-gemini-purple"></div>
                WaveCreator
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-800 pr-4 pl-1 py-1 rounded-full">
                    <img src={user.avatar} alt="User" className="w-8 h-8 rounded-full" />
                    <span className="text-sm font-medium">{user.name}</span>
                </div>
            </div>
        </header>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto relative">
        {step === AppStep.LOGIN && renderLogin()}
        {step === AppStep.UPLOAD && renderUpload()}
        {/* We keep EDITOR active during PROCESSING to ensure Canvas/Audio doesn't unmount */}
        {(step === AppStep.EDITOR || step === AppStep.PROCESSING) && renderEditor()}
        {step === AppStep.DONE && renderDone()}
      </main>
    </div>
  );
}