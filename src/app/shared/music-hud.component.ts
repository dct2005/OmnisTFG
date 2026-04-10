import { Component, ElementRef, Input, OnInit, ViewChild, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

declare var Swal: any;

@Component({
  selector: 'app-music-hud',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="music-hud-container" [class.playing]="isPlaying()">
      <div class="hud-glass">
        <canvas #visualizer class="visualizer-canvas"></canvas>
        
        <div class="hud-controls">
          <button class="btn-play" (click)="togglePlay()">
            <span class="material-icons-round">{{ isPlaying() ? 'pause' : 'play_arrow' }}</span>
          </button>
          
          <div class="track-info">
            <div class="track-name">{{ trackName }}</div>
            <div class="hud-analyzer-bars">
              @for (bar of bars; track $index) {
                <div class="analyzer-bar" [style.height.px]="bar"></div>
              }
            </div>
            
            <audio #audioElement 
              [src]="safeUrl" 
              (ended)="onEnded()"
              [muted]="false"
              [volume]="1.0"
              [attr.crossorigin]="(musicUrl || '').startsWith('data:') ? null : 'anonymous'"></audio>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .music-hud-container {
      position: relative;
      width: 100%;
      height: 80px;
      border-radius: 12px;
      overflow: hidden;
      margin-top: 1rem;
      border: 1px solid rgba(0, 242, 255, 0.2);
      transition: all 0.3s;
    }
    
    .music-hud-container.playing {
      border-color: #00f2ff;
      box-shadow: 0 0 20px rgba(0, 242, 255, 0.3);
    }
    
    .hud-glass {
      position: absolute;
      inset: 0;
      background: rgba(13, 27, 42, 0.8);
      backdrop-filter: blur(15px);
      display: flex;
      align-items: center;
      padding: 0 1rem;
      border-radius: 12px;
    }
    
    .visualizer-canvas {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 40px;
      opacity: 0.5;
      pointer-events: none;
    }
    
    .hud-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
      width: 100%;
      z-index: 2;
    }
    
    .btn-play {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(0, 242, 255, 0.1);
      border: 2px solid #00f2ff;
      color: #00f2ff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-play:hover {
      background: rgba(0, 242, 255, 0.2);
      transform: scale(1.1);
    }
    
    .track-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    
    .track-name {
      font-size: 0.85rem;
      color: #fff;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-shadow: 0 0 10px rgba(0, 242, 255, 0.5);
    }
    
    .hud-analyzer-bars {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      height: 18px;
    }
    
    .analyzer-bar {
      width: 3px;
      background: #00f2ff;
      border-radius: 1px;
      transition: height 0.1s ease;
      box-shadow: 0 0 5px rgba(0, 242, 255, 0.5);
    }
  `]
})
export class MusicHudComponent implements OnInit, OnDestroy {
  @Input() trackName: string = 'Profile Track';
  
  @ViewChild('visualizer') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('audioElement') audioRef!: ElementRef<HTMLAudioElement>;
  
  private sanitizer = inject(DomSanitizer);
  private blobUrl: string | null = null;
  safeUrl: SafeUrl = '';

  @Input() set musicUrl(value: string | null | undefined) {
    if (!value || value === this._musicUrl) return;
    this._musicUrl = value;
    this.processUrl(value);
  }
  get musicUrl(): string { return this._musicUrl; }
  private _musicUrl: string = '';

  private processUrl(url: string) {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }

    if (!url) {
      this.safeUrl = '';
      return;
    }

    if (url.startsWith('data:audio')) {
      try {
        const parts = url.split(';base64,');
        if (parts.length < 2) return;
        
        const contentType = parts[0].split(':')[1];
        const b64Data = parts[1].replace(/\s/g, '');
        const raw = window.atob(b64Data);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);

        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }

        const blob = new Blob([uInt8Array], { type: contentType });
        this.blobUrl = URL.createObjectURL(blob);
      } catch (e) {
        console.error('Error creating blob:', e);
        this.blobUrl = url;
      }
    } else {
      this.blobUrl = url;
    }

    if (this.blobUrl) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.blobUrl);
      
      setTimeout(() => {
        if (!this.isPlaying()) {
          this.togglePlay();
        }
      }, 1000);
    } else {
      this.safeUrl = '';
    }
  }

  isPlaying = signal(false);
  bars = Array(30).fill(2);
  
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private dataArray: any;
  private animationId?: number;
  private source?: MediaElementAudioSourceNode;

  ngOnInit() {}

  ngOnDestroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.audioContext) this.audioContext.close();
    if (this.blobUrl && this.blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.blobUrl);
    }
  }

  togglePlay() {
    const audio = this.audioRef.nativeElement;
    
    if (this.isPlaying()) {
      audio.pause();
      this.isPlaying.set(false);
    } else {
      if (!this.audioContext) {
        this.initAudioContext();
      }
      
      this.audioContext?.resume().then(() => {
        audio.volume = 1.0;
        audio.muted = false;
        audio.play().then(() => {
          this.isPlaying.set(true);
          this.startVisualizer();
        }).catch(err => {
          console.error('Audio play failed:', err);
          this.isPlaying.set(false);
          
          if (typeof Swal !== 'undefined') {
            Swal.fire({
              icon: 'error',
              title: 'Error de Reproducción',
              text: 'El navegador ha bloqueado o no ha podido cargar la pista: ' + err.message,
              background: '#0d1b2a',
              color: '#ffffff',
              confirmButtonColor: '#00f2ff'
            });
          }
        });
      });
    }
  }

  onEnded() {
    this.isPlaying.set(false);
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.bars = Array(30).fill(2);
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      const audio = this.audioRef.nativeElement;
      if (!this.source) {
        this.source = this.audioContext.createMediaElementSource(audio);
      }
      
      this.source.connect(this.analyser);
      this.source.connect(this.audioContext.destination);
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
    } catch (e) {
      console.error('Error Audio Engine:', e);
    }
  }

  private startVisualizer() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    
    const renderFrame = () => {
      if (!this.isPlaying()) return;
      
      this.animationId = requestAnimationFrame(renderFrame);
      if (this.analyser && this.dataArray) {
        this.analyser.getByteFrequencyData(this.dataArray);
      }
      
      const now = Date.now();
      for (let i = 0; i < this.bars.length; i++) {
        const freqValue = this.dataArray ? (this.dataArray[i * 2] || 0) : 0;
        const pulse = Math.sin(now / 150 + i) * 3;
        this.bars[i] = Math.max(2 + pulse, (freqValue / 255) * 20);
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      
      if (this.dataArray) {
        const barWidth = (width / this.dataArray.length) * 2.5;
        let x = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          const freqValue = this.dataArray[i];
          const pulse = Math.sin(now / 150 + i) * (height / 10);
          const barHeight = Math.max(2 + pulse, (freqValue / 255) * height);
          
          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          gradient.addColorStop(0, 'rgba(0, 242, 255, 0.1)');
          gradient.addColorStop(1, 'rgba(0, 242, 255, 0.8)');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(x, height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }
    };
    renderFrame();
  }
}
