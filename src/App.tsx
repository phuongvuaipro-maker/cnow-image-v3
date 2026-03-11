/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Upload, Image as ImageIcon, Download, Settings, RefreshCw, Wand2, LayoutPanelLeft, Copy, Check, History } from "lucide-react";
import { Rnd } from "react-rnd";
import clsx from "clsx";
import { GoogleGenAI } from "@google/genai";

export default function App() {
  const [content, setContent] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<{prompt: string, image: string}[]>([]);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Premium Dark");
  const [images, setImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [numImages, setNumImages] = useState<number>(4);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [useLogoAsReference, setUseLogoAsReference] = useState(false);
  const [usePremiumModel, setUsePremiumModel] = useState(false);
  
  const [logoSettings, setLogoSettings] = useState({
    position: "center",
    width: 200,
    opacity: 1,
    padding: 20,
    outline: "none",
    x: 0,
    y: 0,
  });
  
  const [exportSettings, setExportSettings] = useState({
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    cropMode: "cover",
    format: "png",
  });

  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        const has = await window.aistudio.hasSelectedApiKey();
        if (has) setUsePremiumModel(true);
      }
    };
    checkKey();
  }, []);

  const handleTogglePremium = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        const has = await window.aistudio.hasSelectedApiKey();
        if (!has) {
          // @ts-ignore
          await window.aistudio.openSelectKey();
          setUsePremiumModel(true);
        } else {
          setUsePremiumModel(true);
        }
      } else {
        setUsePremiumModel(true);
      }
    } else {
      setUsePremiumModel(false);
    }
  };

  const handleGeneratePrompt = async () => {
    if (!content) return;
    setIsGeneratingPrompt(true);
    setError(null);
    try {
      const apiKeyToUse = process.env.GEMINI_API_KEY;
      if (!apiKeyToUse) throw new Error("Lỗi hệ thống: Không tìm thấy API Key mặc định.");
      // @ts-ignore
      const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
      
      const rules = useLogoAsReference 
        ? `- Incorporate the provided reference image (e.g., face, character, product, or logo) naturally into the scene.
      - If the user explicitly asks for text (e.g., "Airdrop 1000 USDO"), include instructions to render that exact text clearly. Otherwise, do NOT generate random text.
      - Prefer premium, modern, cinematic, futuristic, high-contrast visuals.
      - The output prompt MUST BE IN ENGLISH. Image generation models require English.
      - Return ONLY the prompt text, no markdown, no explanations.`
        : `- If the user explicitly asks for text (e.g., "Airdrop 1000 USDO"), include instructions to render that exact text clearly. Otherwise, do NOT generate text inside the image.
      - Do NOT generate any random logo inside the image.
      - Keep clean composition and reserve negative space for a logo overlay.
      - Prefer premium, modern, cinematic, futuristic, high-contrast visuals.
      - The output prompt MUST BE IN ENGLISH. Image generation models require English.
      - Return ONLY the prompt text, no markdown, no explanations.`;

      const styleMap: Record<string, string> = {
        "Auto / Creative": "creative and unique visual style that best fits the content",
        "Photorealistic": "ultra-realistic, 8k resolution, highly detailed photography, cinematic lighting, photorealistic",
        "3D Render": "3D render, Pixar style, Unreal Engine 5, octane render, vibrant colors, highly detailed 3D",
        "Anime / Manga": "anime style, Studio Ghibli, highly detailed, vibrant colors, 2D illustration",
        "Cinematic": "cinematic lighting, dramatic shadows, movie still, anamorphic lens, epic composition",
        "Watercolor": "watercolor painting, artistic, soft edges, pastel colors, elegant illustration",
        "Corporate": "clean corporate style, professional, modern, minimalist, flat design elements",
        "Crypto News": "crypto theme, neon accents, futuristic, blockchain tech, dark mode UI style",
      };

      const styleInstruction = styleMap[style] || `${style} brand`;

      const promptText = `Convert the following content into a highly detailed visual image generation prompt suitable for a ${styleInstruction}.
      
      Rules:
      ${rules}
      
      Content:
      ${content}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: promptText,
      });

      setPrompt(response.text?.trim() || "");
    } catch (err: any) {
      const msg = err.message || "";
      console.error("Prompt Generation Error:", err);
      if (msg.includes("429") || msg.includes("quota")) {
        setError(`Lỗi 429 (Hết lượt/Quá nhanh): Vui lòng đợi 1 phút. Chi tiết: ${msg}`);
      } else if (msg.includes("400")) {
        setError(`Lỗi 400 (Từ chối yêu cầu): Có thể do API Key sai hoặc nội dung vi phạm chính sách an toàn. Chi tiết: ${msg}`);
      } else {
        setError(`Lỗi: ${msg}`);
      }
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!prompt) return;
    setIsGeneratingImages(true);
    setError(null);
    try {
      // @ts-ignore
      const apiKey = usePremiumModel ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Lỗi hệ thống: Không tìm thấy API Key mặc định.");
      // @ts-ignore
      const ai = new GoogleGenAI({ apiKey });
      
      let logoPart: any = null;
      if (logo && useLogoAsReference) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(logo);
        });
        logoPart = {
          inlineData: {
            data: base64Data,
            mimeType: logo.type,
          }
        };
      }

      const generateImage = async () => {
        const parts: any[] = [{ text: prompt }];
        if (logoPart) {
          parts.unshift(logoPart);
        }

        const modelName = usePremiumModel ? "gemini-3.1-flash-image-preview" : "gemini-2.5-flash-image";

        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: parts,
          },
          config: {
            imageConfig: {
              aspectRatio: exportSettings.aspectRatio || "1:1"
            }
          }
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
        throw new Error("No image data found in response");
      };

      const count = Math.min(Math.max(1, numImages), 4);
      const newImages: string[] = [];
      
      // Chạy tuần tự từng ảnh và nghỉ 3 giây để tránh lỗi 429 (Rate Limit) của Google
      for (let i = 0; i < count; i++) {
        try {
          const img = await generateImage();
          newImages.push(img);
          if (i < count - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch (e: any) {
          if (newImages.length === 0) throw e; // Nếu chưa tạo được ảnh nào thì báo lỗi ra UI
          console.warn("Dừng tạo thêm do lỗi API:", e);
          break; // Giữ lại các ảnh đã tạo thành công
        }
      }

      setImages(prev => [...newImages, ...prev]);
      setSelectedImageIndex(0);
      setSessionHistory(prev => [...newImages.map(img => ({ prompt, image: img })), ...prev].slice(0, 20));
    } catch (err: any) {
      const msg = err.message || "";
      console.error("Image Generation Error:", err);
      if (msg.includes("429") || msg.includes("quota")) {
        setError(`Lỗi 429 (Hết lượt/Quá nhanh): Bạn đã hết lượt dùng miễn phí của Google. Chi tiết: ${msg}`);
      } else if (msg.includes("400")) {
        setError(`Lỗi 400 (Bị chặn): Google từ chối tạo ảnh này. Thường do Prompt chứa từ khóa nhạy cảm (Crypto, bạo lực, v.v.). Chi tiết: ${msg}`);
      } else if (msg.includes("Requested entity was not found") && usePremiumModel) {
        // @ts-ignore
        if (window.aistudio?.openSelectKey) {
          // @ts-ignore
          await window.aistudio.openSelectKey();
          setError("API Key invalid or not found. Please select a valid key and try again.");
          setUsePremiumModel(false);
        } else {
          setError(err.message || "Failed to generate images");
        }
      } else {
        setError(err.message || "Failed to generate images");
      }
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogo(file);
      setLogoPreview(URL.createObjectURL(file));
      // Reset position to center
      setLogoSettings(prev => ({ ...prev, position: "center", x: 0, y: 0 }));
    }
  };

  const handleExport = async () => {
    if (!images[selectedImageIndex]) return;
    setIsExporting(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = exportSettings.width;
      canvas.height = exportSettings.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Load base image
      const baseImg = new Image();
      baseImg.crossOrigin = "anonymous";
      baseImg.src = images[selectedImageIndex];
      await new Promise((resolve, reject) => {
        baseImg.onload = resolve;
        baseImg.onerror = reject;
      });

      // Draw base image with cropMode
      if (exportSettings.cropMode === "cover") {
        const scale = Math.max(canvas.width / baseImg.width, canvas.height / baseImg.height);
        const x = (canvas.width / scale - baseImg.width) / 2;
        const y = (canvas.height / scale - baseImg.height) / 2;
        ctx.drawImage(baseImg, x, y, baseImg.width, baseImg.height, 0, 0, baseImg.width * scale, baseImg.height * scale);
      } else if (exportSettings.cropMode === "contain") {
        const scale = Math.min(canvas.width / baseImg.width, canvas.height / baseImg.height);
        const x = (canvas.width - baseImg.width * scale) / 2;
        const y = (canvas.height - baseImg.height * scale) / 2;
        ctx.drawImage(baseImg, 0, 0, baseImg.width, baseImg.height, x, y, baseImg.width * scale, baseImg.height * scale);
      } else {
        // fill
        ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
      }

      // Load and draw logo
      if (logoPreview && !useLogoAsReference) {
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        logoImg.src = logoPreview;
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
        });

        const logoScale = logoSettings.width / logoImg.width;
        const lWidth = logoSettings.width;
        const lHeight = logoImg.height * logoScale;

        let lX = 0;
        let lY = 0;
        const padding = logoSettings.padding;

        if (logoSettings.position === "top-left") {
          lX = padding;
          lY = padding;
        } else if (logoSettings.position === "top-right") {
          lX = canvas.width - lWidth - padding;
          lY = padding;
        } else if (logoSettings.position === "bottom-left") {
          lX = padding;
          lY = canvas.height - lHeight - padding;
        } else if (logoSettings.position === "bottom-right") {
          lX = canvas.width - lWidth - padding;
          lY = canvas.height - lHeight - padding;
        } else if (logoSettings.position === "center") {
          lX = (canvas.width - lWidth) / 2;
          lY = (canvas.height - lHeight) / 2;
        } else if (logoSettings.position === "top-center") {
          lX = (canvas.width - lWidth) / 2;
          lY = padding;
        } else if (logoSettings.position === "custom") {
          if (previewRef.current) {
            const previewRect = previewRef.current.getBoundingClientRect();
            const scaleX = exportSettings.width / previewRect.width;
            const scaleY = exportSettings.height / previewRect.height;
            lX = logoSettings.x * scaleX;
            lY = logoSettings.y * scaleY;
          }
        }

        ctx.globalAlpha = logoSettings.opacity;

        if (logoSettings.outline === "white") {
          ctx.shadowColor = "rgba(255,255,255,0.8)";
          ctx.shadowBlur = 15;
        } else if (logoSettings.outline === "black") {
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
        }

        ctx.drawImage(logoImg, lX, lY, lWidth, lHeight);
        ctx.globalAlpha = 1.0;
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      }

      const mimeType = exportSettings.format === "jpg" ? "image/jpeg" : `image/${exportSettings.format}`;
      const dataUrl = canvas.toDataURL(mimeType, 0.9);
      
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `cnow-export.${exportSettings.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || "Failed to export image");
    } finally {
      setIsExporting(false);
    }
  };

  const presets = [
    "Auto / Creative", "Photorealistic", "3D Render", "Anime / Manga", 
    "Cinematic", "Watercolor", "Corporate", "Crypto News"
  ];

  const exportTemplates = [
    { name: "Facebook Square", width: 1200, height: 1200, ratio: "1:1" },
    { name: "Facebook Portrait", width: 1080, height: 1350, ratio: "3:4" },
    { name: "Story / Reel", width: 1080, height: 1920, ratio: "9:16" },
    { name: "YouTube Thumbnail", width: 1280, height: 720, ratio: "16:9" },
    { name: "X Post", width: 1600, height: 900, ratio: "16:9" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-96 bg-zinc-900 border-r border-zinc-800 flex flex-col h-screen overflow-y-auto">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-xl font-bold flex items-center gap-2 text-emerald-400">
            <LayoutPanelLeft className="w-6 h-6" />
            CNOW Auto Image
          </h1>
        </div>

        <div className="p-6 space-y-8">
          {/* Model Settings */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Model Settings</h2>
            <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50 space-y-3">
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={usePremiumModel}
                  onChange={handleTogglePremium}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                />
                Use Premium Model (Gemini 3.1)
              </label>
              <p className="text-xs text-zinc-500">
                Requires a paid Google Cloud API key. Default uses Gemini 2.5 Flash.
              </p>
            </div>
          </section>

          {/* Content Section */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">1. Content & Prompt</h2>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your marketing content here..."
              className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
            
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <label className="text-xs text-zinc-500">Style Preset</label>
                <select 
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  {presets.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-500">Aspect Ratio</label>
                <select 
                  value={exportSettings.aspectRatio}
                  onChange={(e) => setExportSettings({...exportSettings, aspectRatio: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="1:1">1:1 (Square)</option>
                  <option value="3:4">3:4 (Portrait)</option>
                  <option value="16:9">16:9 (Landscape)</option>
                  <option value="9:16">9:16 (Vertical)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-500">Images</label>
                <select 
                  value={numImages}
                  onChange={(e) => setNumImages(parseInt(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGeneratePrompt}
              disabled={isGeneratingPrompt || !content}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGeneratingPrompt ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {prompt ? "Regenerate Prompt" : "Generate Prompt"}
            </button>

            {prompt && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-500">Generated Prompt</label>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(prompt);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {isCopied ? "Copied!" : "Copy Prompt"}
                  </button>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                />
                <button
                  onClick={handleGenerateImages}
                  disabled={isGeneratingImages || !prompt}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingImages ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  {images.length > 0 ? `Generate ${numImages} More Images` : `Generate ${numImages} Images`}
                </button>
              </div>
            )}
          </section>

          {/* Logo Section */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">2. Upload Reference Image or Logo</h2>
            <div className="border-2 border-dashed border-zinc-700 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors cursor-pointer relative">
              <input 
                type="file" 
                accept="image/png, image/jpeg, image/webp" 
                onChange={handleLogoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {logoPreview ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={logoPreview} alt="Image preview" className="h-12 object-contain" />
                  <span className="text-xs text-zinc-400">Click to change image</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-500">
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Upload Image (PNG/JPG)</span>
                </div>
              )}
            </div>

            {logoPreview && (
              <div className="space-y-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer pb-2 border-b border-zinc-800/50">
                  <input 
                    type="checkbox" 
                    checked={useLogoAsReference}
                    onChange={(e) => setUseLogoAsReference(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                  />
                  Use as AI Generation Reference (Face/Product/Logo)
                </label>
                
                {!useLogoAsReference && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 flex justify-between">
                        <span>Width</span>
                        <span>{logoSettings.width}px</span>
                      </label>
                      <input 
                        type="range" min="50" max="800" 
                        value={logoSettings.width}
                        onChange={(e) => setLogoSettings({...logoSettings, width: parseInt(e.target.value)})}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 flex justify-between">
                        <span>Opacity</span>
                        <span>{Math.round(logoSettings.opacity * 100)}%</span>
                      </label>
                      <input 
                        type="range" min="0.1" max="1" step="0.1"
                        value={logoSettings.opacity}
                        onChange={(e) => setLogoSettings({...logoSettings, opacity: parseFloat(e.target.value)})}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500">Outline</label>
                      <select 
                        value={logoSettings.outline}
                        onChange={(e) => setLogoSettings({...logoSettings, outline: e.target.value})}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="none">None</option>
                        <option value="white">White Glow</option>
                        <option value="black">Black Drop Shadow</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500">Position Preset</label>
                      <select 
                        value={logoSettings.position}
                        onChange={(e) => setLogoSettings({...logoSettings, position: e.target.value})}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="center">Center</option>
                        <option value="top-center">Top Center</option>
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="custom">Custom (Drag & Resize)</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Export Section */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">3. Export Settings</h2>
            
            <div className="space-y-2">
              <label className="text-xs text-zinc-500">Template</label>
              <select 
                onChange={(e) => {
                  const t = exportTemplates.find(t => t.name === e.target.value);
                  if (t) setExportSettings({...exportSettings, width: t.width, height: t.height, aspectRatio: t.ratio});
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Custom...</option>
                {exportTemplates.map(t => <option key={t.name} value={t.name}>{t.name} ({t.width}x{t.height})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Width</label>
                <input 
                  type="number" 
                  value={exportSettings.width}
                  onChange={(e) => setExportSettings({...exportSettings, width: parseInt(e.target.value)})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Height</label>
                <input 
                  type="number" 
                  value={exportSettings.height}
                  onChange={(e) => setExportSettings({...exportSettings, height: parseInt(e.target.value)})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Format</label>
                <select 
                  value={exportSettings.format}
                  onChange={(e) => setExportSettings({...exportSettings, format: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  <option value="webp">WebP</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Crop Mode</label>
                <select 
                  value={exportSettings.cropMode}
                  onChange={(e) => setExportSettings({...exportSettings, cropMode: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="fill">Fill</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={isExporting || !images[selectedImageIndex]}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-4 shadow-lg shadow-emerald-500/20"
            >
              {isExporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              Download Final Image
            </button>
          </section>
        </div>
      </aside>

      {/* Main Preview Area */}
      <main className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {error && (
          <div className="absolute top-4 right-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm max-w-md z-50">
            {error}
          </div>
        )}

        {images.length > 0 ? (
          <div className="w-full max-w-5xl flex flex-col items-center gap-8">
            {/* Main Preview */}
            <div 
              ref={previewRef}
              className="relative bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 flex items-center justify-center group"
              style={{
                width: '100%',
                maxWidth: '800px',
                aspectRatio: `${exportSettings.width} / ${exportSettings.height}`,
              }}
            >
              <img 
                src={images[selectedImageIndex]} 
                alt="Generated preview" 
                className="w-full h-full object-cover"
                style={{ objectFit: exportSettings.cropMode as any }}
              />
              
              {/* Quick Download Button */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="absolute top-4 right-4 bg-zinc-900/80 hover:bg-emerald-500 text-white p-2.5 rounded-xl backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 z-50 shadow-lg"
                title="Download Image"
              >
                {isExporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              </button>
              
              {/* Logo Overlay Preview */}
              {logoPreview && !useLogoAsReference && (
                <Rnd
                  bounds="parent"
                  position={
                    logoSettings.position === "custom" 
                      ? { x: logoSettings.x, y: logoSettings.y }
                      : undefined
                  }
                  size={
                    logoSettings.position === "custom"
                      ? { width: logoSettings.width, height: 'auto' }
                      : undefined
                  }
                  onDrag={(e, d) => {
                    setLogoSettings(prev => ({ ...prev, x: d.x, y: d.y }));
                  }}
                  onDragStop={(e, d) => {
                    setLogoSettings(prev => ({ ...prev, position: "custom", x: d.x, y: d.y }));
                  }}
                  onResize={(e, direction, ref, delta, position) => {
                    setLogoSettings(prev => ({
                      ...prev,
                      width: parseInt(ref.style.width, 10),
                      x: position.x,
                      y: position.y
                    }));
                  }}
                  disableDragging={logoSettings.position !== "custom"}
                  enableResizing={logoSettings.position === "custom"}
                  className={clsx(
                    "absolute",
                    logoSettings.position !== "custom" && getPositionClasses(logoSettings.position, logoSettings.padding)
                  )}
                  style={{
                    width: logoSettings.position !== "custom" ? logoSettings.width : undefined,
                    opacity: logoSettings.opacity,
                    zIndex: 10,
                  }}
                >
                  <img 
                    src={logoPreview} 
                    alt="Logo overlay" 
                    className={clsx(
                      "w-full h-auto pointer-events-none",
                      logoSettings.outline === "white" && "drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]",
                      logoSettings.outline === "black" && "drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
                    )} 
                  />
                </Rnd>
              )}
            </div>

            {/* Thumbnails */}
            <div className="flex gap-4 overflow-x-auto pb-4 w-full justify-center">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={clsx(
                    "relative w-24 h-24 rounded-xl overflow-hidden border-2 transition-all shrink-0",
                    selectedImageIndex === idx ? "border-emerald-500 scale-105 shadow-lg shadow-emerald-500/20" : "border-zinc-800 opacity-50 hover:opacity-100"
                  )}
                >
                  <img src={img} alt={`Variation ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4 text-zinc-500">
            <div className="w-24 h-24 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto border border-zinc-800">
              <ImageIcon className="w-8 h-8 opacity-50" />
            </div>
            <p>Generate images to see preview</p>
          </div>
        )}

        {/* Session History */}
        {sessionHistory.length > 0 && (
          <div className="w-full max-w-5xl mt-12 pt-8 border-t border-zinc-800/50">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <History className="w-4 h-4" />
              Session History
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {sessionHistory.map((item, idx) => (
                <div key={idx} className="group relative aspect-square rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
                  <img src={item.image} alt="History item" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                    <button 
                      onClick={() => {
                        setImages([item.image]);
                        setSelectedImageIndex(0);
                        setPrompt(item.prompt);
                      }}
                      className="text-xs bg-emerald-500 text-zinc-950 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-400"
                    >
                      Reuse
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function getPositionClasses(position: string, padding: number) {
  switch (position) {
    case 'top-left': return `top-4 left-4`;
    case 'top-center': return `top-4 left-1/2 -translate-x-1/2`;
    case 'top-right': return `top-4 right-4`;
    case 'bottom-left': return `bottom-4 left-4`;
    case 'bottom-right': return `bottom-4 right-4`;
    case 'center': return `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`;
    default: return '';
  }
}
