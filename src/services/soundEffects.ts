/**
 * Section XV: Audio, Visual Effects & Device Performance Manager
 * Uses Web Audio API synthesis so zero external audio files or paid assets are required.
 */

export interface AudioVisualSettings {
  soundEnabled: boolean;
  volume: number; // 0.0 to 1.0
  reducedMotion: boolean;
  lowSpecMode: boolean;
}

const SETTINGS_STORAGE_KEY = 'quizzi_arena_av_settings_v1';

class SoundAndExperienceManager {
  private ctx: AudioContext | null = null;
  private settings: AudioVisualSettings = {
    soundEnabled: true,
    volume: 0.65,
    reducedMotion: false,
    lowSpecMode: false,
  };

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.settings = {
          soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
          volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.65,
          reducedMotion: Boolean(parsed.reducedMotion),
          lowSpecMode: Boolean(parsed.lowSpecMode),
        };
      }
    } catch {
      // ignore storage errors
    }
  }

  public getSettings(): AudioVisualSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<AudioVisualSettings>): AudioVisualSettings {
    this.settings = { ...this.settings, ...partial };
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
      } catch {
        // ignore
      }
    }
    return this.getSettings();
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.settings.soundEnabled || this.settings.volume <= 0.01) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private playToneSequence(
    notes: Array<{ freq: number; durationSec: number; delaySec: number; type?: OscillatorType }>
  ): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainMultiplier = Math.max(0.05, Math.min(1, this.settings.volume)) * 0.18;

    for (const n of notes) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = n.type || 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.delaySec);

        gain.gain.setValueAtTime(0.0001, now + n.delaySec);
        gain.gain.exponentialRampToValueAtTime(gainMultiplier, now + n.delaySec + 0.015);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + n.delaySec + Math.max(0.03, n.durationSec)
        );

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.delaySec);
        osc.stop(now + n.delaySec + n.durationSec + 0.02);
      } catch {
        // ignore audio errors on restricted devices
      }
    }
  }

  public playMatchStart(): void {
    this.playToneSequence([
      { freq: 440, durationSec: 0.12, delaySec: 0, type: 'triangle' },
      { freq: 554.37, durationSec: 0.12, delaySec: 0.12, type: 'triangle' },
      { freq: 659.25, durationSec: 0.22, delaySec: 0.24, type: 'triangle' },
    ]);
  }

  public playCountdownTick(isUrgent = false): void {
    this.playToneSequence([
      {
        freq: isUrgent ? 880 : 620,
        durationSec: 0.05,
        delaySec: 0,
        type: 'sine',
      },
    ]);
  }

  public playCorrectAnswer(): void {
    this.playToneSequence([
      { freq: 523.25, durationSec: 0.1, delaySec: 0, type: 'triangle' },
      { freq: 659.25, durationSec: 0.12, delaySec: 0.09, type: 'triangle' },
      { freq: 783.99, durationSec: 0.22, delaySec: 0.19, type: 'triangle' },
    ]);
  }

  public playWrongAnswer(): void {
    this.playToneSequence([
      { freq: 311.13, durationSec: 0.14, delaySec: 0, type: 'sawtooth' },
      { freq: 246.94, durationSec: 0.24, delaySec: 0.14, type: 'sawtooth' },
    ]);
  }

  public playLevelUp(): void {
    this.playToneSequence([
      { freq: 523.25, durationSec: 0.1, delaySec: 0, type: 'triangle' },
      { freq: 659.25, durationSec: 0.1, delaySec: 0.1, type: 'triangle' },
      { freq: 783.99, durationSec: 0.1, delaySec: 0.2, type: 'triangle' },
      { freq: 1046.5, durationSec: 0.35, delaySec: 0.3, type: 'triangle' },
    ]);
  }

  public playBadgeUnlocked(): void {
    this.playToneSequence([
      { freq: 587.33, durationSec: 0.1, delaySec: 0, type: 'sine' },
      { freq: 880, durationSec: 0.28, delaySec: 0.1, type: 'sine' },
    ]);
  }

  public playVictoryFanfare(): void {
    this.playToneSequence([
      { freq: 523.25, durationSec: 0.12, delaySec: 0, type: 'triangle' },
      { freq: 659.25, durationSec: 0.12, delaySec: 0.13, type: 'triangle' },
      { freq: 783.99, durationSec: 0.12, delaySec: 0.26, type: 'triangle' },
      { freq: 1046.5, durationSec: 0.4, delaySec: 0.39, type: 'triangle' },
    ]);
  }
}

export const soundManager = new SoundAndExperienceManager();
