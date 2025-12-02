import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { VideoConfig } from '../types';

interface VisualizerCanvasProps {
  config: VideoConfig;
  isPlaying: boolean;
  onEnded: () => void;
  onExportProgress?: (progress: number) => void;
}

export interface VisualizerHandle {
  startExport: () => Promise<Blob>;
}

const VisualizerCanvas = forwardRef<VisualizerHandle, VisualizerCanvasProps>(({ config, isPlaying, onEnded, onExportProgress }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef<number>();
  const imageBitmapsRef = useRef<ImageBitmap[]>([]);
  
  // To track time manually during export or playback
  const startTimeRef = useRef<number>(0);
  
  const WIDTH = 1280;
  const HEIGHT = 720;

  useEffect(() => {
    // Preload images as ImageBitmaps for performance
    const loadImages = async () => {
      const promises = config.images.map(file => createImageBitmap(file));
      imageBitmapsRef.current = await Promise.all(promises);
    };
    loadImages();
  }, [config.images]);

  useEffect(() => {
    if (!config.audio) return;
    
    // Setup Audio
    const audio = new Audio(URL.createObjectURL(config.audio));
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    sourceRef.current = source;

    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('ended', onEnded);
      if (ctx.state !== 'closed') ctx.close();
    };
  }, [config.audio, onEnded]);

  useEffect(() => {
    if (isPlaying && audioRef.current && audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      audioRef.current.play().catch(e => console.error("Playback failed", e));
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (audioRef.current) audioRef.current.pause();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [isPlaying]);

  const drawFrame = (ctx: CanvasRenderingContext2D, currentTime: number, duration: number, dataArray: Uint8Array) => {
    if (!imageBitmapsRef.current.length) return;

    // 1. Background (Image Transitions)
    const totalImages = imageBitmapsRef.current.length;
    // If multiple images, allocate time slots. If 1, show it always.
    const slideDuration = duration > 0 ? duration / totalImages : 5; 
    const currentIndex = Math.min(
      Math.floor(currentTime / slideDuration),
      totalImages - 1
    );
    const nextIndex = (currentIndex + 1) % totalImages;
    
    // Calculate fade
    const timeInSlide = currentTime - (currentIndex * slideDuration);
    const fadeDuration = 1.0; // 1 second crossfade
    
    // Draw Current
    ctx.globalAlpha = 1;
    drawImageProp(ctx, imageBitmapsRef.current[currentIndex], 0, 0, WIDTH, HEIGHT);

    // Crossfade to next if approaching end of slide (only if not last image or looping)
    if (totalImages > 1 && timeInSlide > slideDuration - fadeDuration) {
       const fadeProgress = (timeInSlide - (slideDuration - fadeDuration)) / fadeDuration;
       ctx.globalAlpha = fadeProgress;
       drawImageProp(ctx, imageBitmapsRef.current[nextIndex], 0, 0, WIDTH, HEIGHT);
    }
    
    ctx.globalAlpha = 1; // Reset alpha

    // 2. Dark Gradient Overlay for text readability
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "rgba(0,0,0,0.3)");
    gradient.addColorStop(0.5, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 3. Title (Fades out after 4 seconds)
    if (currentTime < 4) {
      const titleOpacity = 1 - (currentTime / 4);
      ctx.globalAlpha = Math.max(0, titleOpacity);
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.font = `bold 80px ${config.fontFamily === 'serif' ? 'Playfair Display' : config.fontFamily === 'mono' ? 'Roboto Mono' : 'Inter'}`;
      ctx.fillText(config.title, WIDTH / 2, HEIGHT / 2);
      ctx.globalAlpha = 1;
    }

    // 4. Subtitle (Always on, bottom right-ish)
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.textAlign = "right";
    ctx.font = `italic 30px ${config.fontFamily === 'serif' ? 'Playfair Display' : 'Inter'}`;
    ctx.fillText(config.subtitle, WIDTH - 50, HEIGHT - 50);

    // 5. Visualizer (Left corner waveshape)
    if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const barWidth = 6;
        const gap = 2;
        const maxBarHeight = 150;
        const visualizerX = 50;
        const visualizerY = HEIGHT - 50;
        const barsToDraw = 40; // Only draw bass/mids

        ctx.fillStyle = "#4E8cFF"; // Gemini Blue
        
        for(let i = 0; i < barsToDraw; i++) {
           // Emphasize lower frequencies
           const value = dataArray[i];
           const percent = value / 255;
           const height = percent * maxBarHeight;
           
           // Draw rounded pill bars
           const x = visualizerX + (i * (barWidth + gap));
           const y = visualizerY - height;
           
           ctx.beginPath();
           ctx.roundRect(x, y, barWidth, height, 4);
           ctx.fill();
        }
    }
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas || !audioRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentTime = audioRef.current.currentTime;
    const duration = audioRef.current.duration || 1;
    
    const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 0;
    const dataArray = new Uint8Array(bufferLength);

    drawFrame(ctx, currentTime, duration, dataArray);

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  // Helper to draw image cover (like CSS object-fit: cover)
  function drawImageProp(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
    const r = Math.min(w / img.width, h / img.height);
    let nw = img.width * r, nh = img.height * r;
    let ar = 1;
    
    // Decide if we cover based on aspect
    if (nw < w) ar = w / nw;
    if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;  
    nw *= ar;
    nh *= ar;

    let cx = (w - nw) * 0.5;
    let cy = (h - nh) * 0.5;

    ctx.drawImage(img, cx, cy, nw, nh);
  }

  useImperativeHandle(ref, () => ({
    startExport: async () => {
      const canvas = canvasRef.current;
      const audio = audioRef.current;
      if (!canvas || !audio) throw new Error("Not ready");

      // Ensure main loop is stopped
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      audio.pause(); 
      audio.currentTime = 0;

      return new Promise((resolve, reject) => {
        const stream = canvas.captureStream(30); // 30 FPS
        
        // Add audio track to stream
        const audioStream = (audio as any).captureStream ? (audio as any).captureStream() : null;
        if (audioStream) {
            const tracks = audioStream.getAudioTracks();
            if (tracks.length > 0) {
                 stream.addTrack(tracks[0]);
            }
        }

        // Prefer MP4 if available (Chrome/Edge), else WebM
        let mimeType = 'video/webm;codecs=vp9';
        if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mimeType = 'video/webm';
        }

        let recorder: MediaRecorder;
        try {
            recorder = new MediaRecorder(stream, { mimeType });
        } catch (e) {
            // Fallback for Safari/others if codec specific fails
            recorder = new MediaRecorder(stream);
        }

        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            resolve(blob);
            audio.pause();
            audio.currentTime = 0;
        };

        // Start playing and recording
        audio.play().then(() => {
            recorder.start();
            checkEnd();
        }).catch(e => {
            console.error("Export Play Error:", e);
            reject(e);
        });

        // Monitor progress
        const checkEnd = () => {
            if (audio.ended) {
                recorder.stop();
            } else {
                 if (onExportProgress && audio.duration) {
                    onExportProgress((audio.currentTime / audio.duration) * 100);
                 }
                requestAnimationFrame(checkEnd);
                // Also need to keep drawing the canvas
                const ctx = canvas.getContext('2d');
                if(ctx && analyserRef.current) {
                    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                    drawFrame(ctx, audio.currentTime, audio.duration, dataArray);
                }
            }
        };
      });
    }
  }));

  return (
    <canvas 
        ref={canvasRef} 
        width={WIDTH} 
        height={HEIGHT} 
        className="w-full h-full object-contain bg-black rounded-lg shadow-2xl"
    />
  );
});

VisualizerCanvas.displayName = 'VisualizerCanvas';

export default VisualizerCanvas;