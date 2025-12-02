export interface User {
  name: string;
  avatar: string;
  email: string;
}

export interface VideoConfig {
  title: string;
  subtitle: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  images: File[];
  audio: File | null;
}

export enum AppStep {
  LOGIN,
  UPLOAD,
  EDITOR,
  PROCESSING,
  DONE
}

export interface ProcessingResult {
  videoUrl: string;
  videoDescription: string;
  hashtags: string[];
}
