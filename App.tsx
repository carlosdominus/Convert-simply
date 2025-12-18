import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Settings2, 
  Download, 
  Sparkles, 
  RefreshCw, 
  X, 
  Check,
  Zap,
  Layers,
  ArrowRight,
  Palette,
  Scan,
  Cpu,
  Trash2,
  Plus,
  FileImage,
  Archive,
  Command
} from 'lucide-react';
import JSZip from 'jszip';
import { AppStatus, ConversionSettings, QueueItem, ProcessedResult } from './types';
import { processImageClientSide, formatBytes, blobToBase64 } from './services/imageProcessing';
import { analyzeImage } from './services/geminiService';

const App: React.FC = () => {
  // State
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isZipping, setIsZipping] = useState(false);
  
  const isProcessing = queue.some(item => item.status === AppStatus.PROCESSING);
  const isAllComplete = queue.length > 0 && queue.every(item => item.status === AppStatus.COMPLETE);
  
  const [settings, setSettings] = useState<ConversionSettings>({
    format: 'image/jpeg',
    quality: 0.8,
    resizeRatio: 1,
    useAIAnalysis: false,
    isVector: false,
    colorCount: 16,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: QueueItem[] = Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .map(file => ({
        id: generateId(),
        file,
        previewUrl: URL.createObjectURL(file),
        originalSize: file.size,
        status: AppStatus.IDLE
      }));
    setQueue(prev => [...prev, ...newItems]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const removeItem = (id: string) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item?.result?.url) URL.revokeObjectURL(item.result.url);
      return prev.filter(i => i.id !== id);
    });
  };

  const clearQueue = () => {
    queue.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.result?.url) URL.revokeObjectURL(item.result.url);
    });
    setQueue([]);
  };

  const processBatch = async () => {
    const itemsToProcess = queue.filter(item => item.status === AppStatus.IDLE || item.status === AppStatus.ERROR);
    if (itemsToProcess.length === 0) return;

    setQueue(prev => prev.map(item => 
      itemsToProcess.find(i => i.id === item.id) ? { ...item, status: AppStatus.PROCESSING } : item
    ));

    for (const item of itemsToProcess) {
      try {
        const blob = await processImageClientSide(
          item.file,
          settings.format,
          settings.quality,
          settings.resizeRatio,
          settings.isVector,
          settings.colorCount
        );
        
        const url = URL.createObjectURL(blob);
        let aiDesc = '';
        let aiTags: string[] = [];

        if (settings.useAIAnalysis) {
          try {
            const base64Original = await blobToBase64(item.file);
            const analysis = await analyzeImage(base64Original, item.file.type);
            aiDesc = analysis.description;
            aiTags = analysis.tags;
          } catch (e) {
            console.warn("AI Analysis failed", item.id);
          }
        }

        const result: ProcessedResult = { blob, url, size: blob.size, aiDescription: aiDesc, aiTags: aiTags };
        setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: AppStatus.COMPLETE, result } : i));
      } catch (error) {
        setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: AppStatus.ERROR, error: "Failed" } : i));
      }
    }
  };

  const getExtension = () => {
    let ext = settings.format.split('/')[1];
    if (ext === 'svg+xml') ext = 'svg';
    return ext;
  };

  const downloadFile = (item: QueueItem) => {
    if (!item.result) return;
    const link = document.createElement('a');
    link.href = item.result.url;
    link.download = `${item.file.name.split('.')[0]}_converted.${getExtension()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = async () => {
    const completedItems = queue.filter(item => item.status === AppStatus.COMPLETE && item.result);
    if (completedItems.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      const ext = getExtension();
      completedItems.forEach(item => {
        if (item.result) zip.file(`${item.file.name.split('.')[0]}_converted.${ext}`, item.result.blob);
      });
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = "cleave_batch.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("ZIP Error", error);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden selection:bg-apple-blue selection:text-white font-sans">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 -z-10 bg-[#F5F5F7]">
        <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-white to-transparent opacity-80"></div>
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-100 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-float"></div>
        <div className="absolute top-[10%] left-[-10%] w-[600px] h-[600px] bg-purple-100 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-white/70 backdrop-blur-xl border-b border-black/[0.03] flex items-center justify-between px-6 lg:px-12 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shadow-lg shadow-black/10">
            <Command size={18} />
          </div>
          <span className="font-semibold text-lg tracking-tight text-apple-text">Cleave.</span>
        </div>
        <div className="flex items-center gap-4">
           {queue.length > 0 && (
             <span className="text-xs font-medium text-apple-gray hidden sm:block">
               {queue.length} files in queue
             </span>
           )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-28 pb-20 px-4 lg:px-8 max-w-[1400px] mx-auto min-h-screen">
        
        {/* Empty State / Hero */}
        {queue.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] animate-scale-in">
            <div className="text-center mb-10 space-y-4">
              <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter text-apple-text">
                Convert simply.
              </h1>
              <p className="text-xl text-apple-gray font-normal max-w-xl mx-auto">
                The ultimate tool for vectors, compression, and AI analysis.
              </p>
            </div>

            <div 
              className="group relative w-full max-w-2xl h-[320px] rounded-[2.5rem] bg-white border border-black/[0.04] shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all duration-500 ease-out flex flex-col items-center justify-center cursor-pointer overflow-hidden"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileSelect} />
              
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              
              <div className="w-20 h-20 rounded-full bg-apple-bg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                <Upload size={32} className="text-apple-text opacity-80" strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-semibold text-apple-text mb-2 relative z-10">Drop files to start</h3>
              <p className="text-apple-gray text-base relative z-10">Supports JPG, PNG, WEBP, AVIF</p>
            </div>
          </div>
        )}

        {/* Workspace */}
        {queue.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slide-up">
            
            {/* List Section */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl font-semibold text-apple-text tracking-tight">Library</h2>
                <div className="flex gap-2">
                   <button onClick={() => addMoreInputRef.current?.click()} className="glass-button px-4 py-2 rounded-full text-sm font-medium text-apple-blue flex items-center gap-2">
                     <Plus size={16} /> Add
                   </button>
                   <input type="file" ref={addMoreInputRef} className="hidden" accept="image/*" multiple onChange={handleFileSelect} />
                   
                   <button onClick={clearQueue} className="glass-button px-4 py-2 rounded-full text-sm font-medium text-red-500 hover:text-red-600 flex items-center gap-2">
                     <Trash2 size={16} /> Clear
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {queue.map((item, index) => (
                  <div 
                    key={item.id}
                    className="bg-white/80 backdrop-blur-md border border-white/60 p-3 rounded-2xl flex items-center gap-4 hover:shadow-lg transition-all duration-300 group"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-xl bg-apple-bg overflow-hidden flex-shrink-0 relative shadow-inner">
                       <img 
                        src={item.status === AppStatus.COMPLETE && item.result ? item.result.url : item.previewUrl} 
                        className="w-full h-full object-cover" 
                        alt=""
                      />
                      {item.status === AppStatus.PROCESSING && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-sm">
                          <RefreshCw className="animate-spin text-white" size={20} />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-apple-text truncate">{item.file.name}</h4>
                        {item.status === AppStatus.COMPLETE && (
                           <Check size={14} className="text-green-500" strokeWidth={3} />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1 text-xs text-apple-gray font-medium">
                        <span>{formatBytes(item.originalSize)}</span>
                        {item.status === AppStatus.COMPLETE && item.result && (
                          <>
                            <ArrowRight size={10} className="text-apple-gray/50" />
                            <span className="text-apple-text">{formatBytes(item.result.size)}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${item.result.size > item.originalSize ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                              {Math.round(((item.result.size - item.originalSize) / item.originalSize) * 100)}%
                            </span>
                          </>
                        )}
                        {item.result?.aiTags && item.result.aiTags.length > 0 && (
                          <span className="hidden sm:flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            <Sparkles size={10} /> {item.result.aiTags[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {item.status === AppStatus.COMPLETE && (
                        <button onClick={() => downloadFile(item)} className="w-10 h-10 rounded-full bg-apple-text text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
                          <Download size={18} />
                        </button>
                      )}
                      <button onClick={() => removeItem(item.id)} className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center text-apple-gray transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar Controls */}
            <div className="lg:col-span-4 space-y-4">
              <div className="sticky top-24 space-y-4">
                
                {/* Main Settings Card */}
                <div className="bg-white/70 backdrop-blur-xl border border-white/50 p-6 rounded-[2rem] shadow-xl shadow-black/[0.02]">
                  <div className="flex items-center gap-2 mb-6">
                    <Settings2 size={20} className="text-apple-text" />
                    <h3 className="font-semibold text-apple-text">Configuration</h3>
                  </div>

                  {/* Toggle */}
                  <div className="bg-black/[0.04] p-1 rounded-xl flex mb-8">
                     <button 
                       onClick={() => setSettings(s => ({ ...s, isVector: false, format: 'image/jpeg' }))}
                       className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${!settings.isVector ? 'bg-white text-apple-text shadow-sm' : 'text-apple-gray hover:text-apple-text shadow-none'}`}
                     >
                       Raster
                     </button>
                     <button 
                       onClick={() => setSettings(s => ({ ...s, isVector: true, format: 'image/svg+xml' }))}
                       className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${settings.isVector ? 'bg-white text-apple-text shadow-sm' : 'text-apple-gray hover:text-apple-text shadow-none'}`}
                     >
                       Vector
                     </button>
                  </div>

                  {/* Dynamic Controls */}
                  <div className="space-y-6">
                    {!settings.isVector ? (
                      <>
                        <div className="space-y-3">
                          <label className="text-xs font-semibold text-apple-gray uppercase tracking-wider">Format</label>
                          <div className="grid grid-cols-2 gap-2">
                             {(['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const).map(fmt => (
                               <button 
                                 key={fmt}
                                 onClick={() => setSettings(s => ({ ...s, format: fmt }))}
                                 className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${settings.format === fmt ? 'border-apple-blue bg-blue-50/50 text-apple-blue' : 'border-transparent bg-white hover:bg-black/[0.02] text-apple-text'}`}
                               >
                                 {fmt.split('/')[1].toUpperCase()}
                               </button>
                             ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                           <div className="flex justify-between">
                             <label className="text-xs font-semibold text-apple-gray uppercase tracking-wider">Quality</label>
                             <span className="text-xs font-bold text-apple-text">{Math.round(settings.quality * 100)}%</span>
                           </div>
                           <input 
                             type="range" min="0.1" max="1" step="0.1" value={settings.quality}
                             onChange={(e) => setSettings(s => ({...s, quality: parseFloat(e.target.value)}))}
                             className="w-full h-1.5 bg-black/10 rounded-full appearance-none cursor-pointer accent-apple-blue"
                           />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                         <div className="p-4 bg-orange-50/80 rounded-2xl border border-orange-100/50">
                           <div className="flex items-center gap-2 text-orange-600 mb-1">
                             <Cpu size={14} />
                             <span className="text-xs font-bold uppercase">Processor Intensive</span>
                           </div>
                           <p className="text-xs text-orange-800/70">Vectorizing images happens locally. Larger images may take time.</p>
                         </div>
                         <div className="space-y-3">
                           <div className="flex justify-between">
                             <label className="text-xs font-semibold text-apple-gray uppercase tracking-wider">Colors</label>
                             <span className="text-xs font-bold text-apple-text">{settings.colorCount}</span>
                           </div>
                           <input 
                             type="range" min="2" max="64" step="2" value={settings.colorCount}
                             onChange={(e) => setSettings(s => ({...s, colorCount: parseInt(e.target.value)}))}
                             className="w-full h-1.5 bg-black/10 rounded-full appearance-none cursor-pointer accent-apple-text"
                           />
                        </div>
                      </div>
                    )}

                    <div className="h-px bg-black/[0.05]"></div>

                    {/* AI Feature */}
                    <div 
                      onClick={() => setSettings(s => ({...s, useAIAnalysis: !s.useAIAnalysis}))}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors border ${settings.useAIAnalysis ? 'bg-purple-50/50 border-purple-100' : 'bg-transparent border-transparent hover:bg-black/[0.02]'}`}
                    >
                       <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center ${settings.useAIAnalysis ? 'bg-purple-500 text-white' : 'bg-black/5 text-black/40'}`}>
                           <Sparkles size={14} />
                         </div>
                         <div className="text-sm">
                           <p className="font-semibold text-apple-text">AI Analysis</p>
                           <p className="text-xs text-apple-gray">Generate tags & descriptions</p>
                         </div>
                       </div>
                       <div className={`w-10 h-6 rounded-full p-1 transition-colors ${settings.useAIAnalysis ? 'bg-purple-500' : 'bg-gray-200'}`}>
                         <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings.useAIAnalysis ? 'translate-x-4' : ''}`}></div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button */}
                {isAllComplete ? (
                   <button 
                     onClick={downloadAll}
                     disabled={isZipping}
                     className="w-full py-4 rounded-2xl bg-apple-text text-white font-semibold shadow-xl shadow-black/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                   >
                     {isZipping ? <RefreshCw className="animate-spin" size={20} /> : <Archive size={20} />}
                     Download All {getExtension().toUpperCase()}
                   </button>
                ) : (
                  <button 
                    onClick={processBatch}
                    disabled={isProcessing || queue.every(i => i.status === AppStatus.COMPLETE)}
                    className="w-full py-4 rounded-2xl bg-apple-blue text-white font-semibold shadow-xl shadow-blue-500/20 hover:bg-apple-blueHover hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="animate-spin" size={20} /> Processing...
                      </>
                    ) : (
                      <>
                        Start Conversion <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                )}
                
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

export default App;