// Sound effects composable for slot machine style tier sounds
// Uses Web Audio API for generating sounds without external files

interface SoundConfig {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  decay?: number;
}

class SoundEffectsManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private playTone(config: SoundConfig): void {
    if (!this.enabled) return;

    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(config.gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      config.decay || 0.001,
      ctx.currentTime + config.duration
    );

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + config.duration);
  }

  private playSequence(notes: SoundConfig[], interval: number): void {
    notes.forEach((note, index) => {
      setTimeout(() => this.playTone(note), index * interval);
    });
  }

  // TIER 1: L'Etincelle - Son doux, une simple note cristalline
  playEtincelle(): void {
    this.playTone({
      frequency: 880, // A5
      duration: 0.3,
      type: 'sine',
      gain: 0.15,
      decay: 0.01
    });
  }

  // TIER 2: La Flamme - Arpege ascendant doux
  playFlamme(): void {
    const notes: SoundConfig[] = [
      { frequency: 523.25, duration: 0.2, type: 'sine', gain: 0.2 }, // C5
      { frequency: 659.25, duration: 0.2, type: 'sine', gain: 0.25 }, // E5
      { frequency: 783.99, duration: 0.3, type: 'sine', gain: 0.3 }, // G5
    ];
    this.playSequence(notes, 100);
  }

  // TIER 3: L'Embrasement - Fanfare courte style machine a sous
  playEmbrasement(): void {
    const notes: SoundConfig[] = [
      { frequency: 523.25, duration: 0.15, type: 'square', gain: 0.15 }, // C5
      { frequency: 659.25, duration: 0.15, type: 'square', gain: 0.18 }, // E5
      { frequency: 783.99, duration: 0.15, type: 'square', gain: 0.2 }, // G5
      { frequency: 1046.50, duration: 0.4, type: 'sine', gain: 0.25 }, // C6
    ];
    this.playSequence(notes, 80);

    // Add shimmer effect
    setTimeout(() => {
      this.playShimmer();
    }, 400);
  }

  // TIER 4: La Revelation - Jackpot complet!
  playRevelation(): void {
    // Initial impact
    this.playTone({
      frequency: 150,
      duration: 0.5,
      type: 'sine',
      gain: 0.3,
      decay: 0.05
    });

    // Rising fanfare
    const fanfare: SoundConfig[] = [
      { frequency: 261.63, duration: 0.12, type: 'square', gain: 0.2 }, // C4
      { frequency: 329.63, duration: 0.12, type: 'square', gain: 0.22 }, // E4
      { frequency: 392.00, duration: 0.12, type: 'square', gain: 0.24 }, // G4
      { frequency: 523.25, duration: 0.12, type: 'square', gain: 0.26 }, // C5
      { frequency: 659.25, duration: 0.12, type: 'square', gain: 0.28 }, // E5
      { frequency: 783.99, duration: 0.12, type: 'square', gain: 0.3 }, // G5
      { frequency: 1046.50, duration: 0.5, type: 'sine', gain: 0.35 }, // C6
    ];
    setTimeout(() => this.playSequence(fanfare, 70), 100);

    // Coin cascade
    setTimeout(() => this.playCoinCascade(), 700);

    // Victory chime
    setTimeout(() => this.playVictoryChime(), 1200);
  }

  // TIER 5: L'Accomplissement (100%) - Ultimate celebration
  playAccomplissement(): void {
    // Deep resonant gong
    this.playTone({
      frequency: 80,
      duration: 2,
      type: 'sine',
      gain: 0.4,
      decay: 0.01
    });

    // Triumphant fanfare
    const triumphant: SoundConfig[] = [
      { frequency: 392.00, duration: 0.2, type: 'square', gain: 0.25 }, // G4
      { frequency: 523.25, duration: 0.2, type: 'square', gain: 0.28 }, // C5
      { frequency: 659.25, duration: 0.2, type: 'square', gain: 0.3 }, // E5
      { frequency: 783.99, duration: 0.3, type: 'sine', gain: 0.35 }, // G5
      { frequency: 1046.50, duration: 0.5, type: 'sine', gain: 0.4 }, // C6
    ];
    setTimeout(() => this.playSequence(triumphant, 150), 300);

    // Extended coin cascade
    setTimeout(() => this.playCoinCascade(20, 100), 1000);

    // Multiple victory chimes
    setTimeout(() => this.playVictoryChime(), 1800);
    setTimeout(() => this.playVictoryChime(), 2200);
    setTimeout(() => this.playVictoryChime(), 2600);

    // Final shimmer wave
    setTimeout(() => {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => this.playShimmer(), i * 200);
      }
    }, 3000);
  }

  // Helper: Shimmer/sparkle effect
  private playShimmer(): void {
    const frequencies = [2000, 2500, 3000, 2200, 2800];
    frequencies.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone({
          frequency: freq + Math.random() * 500,
          duration: 0.1,
          type: 'sine',
          gain: 0.08,
          decay: 0.001
        });
      }, i * 30);
    });
  }

  // Helper: Coin cascade effect (slot machine coins falling)
  private playCoinCascade(count: number = 12, interval: number = 60): void {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.playTone({
          frequency: 1200 + Math.random() * 800,
          duration: 0.08,
          type: 'sine',
          gain: 0.1 + Math.random() * 0.05,
          decay: 0.001
        });
      }, i * interval);
    }
  }

  // Helper: Victory chime
  private playVictoryChime(): void {
    const chime: SoundConfig[] = [
      { frequency: 1318.51, duration: 0.15, type: 'sine', gain: 0.2 }, // E6
      { frequency: 1567.98, duration: 0.15, type: 'sine', gain: 0.22 }, // G6
      { frequency: 2093.00, duration: 0.3, type: 'sine', gain: 0.25 }, // C7
    ];
    this.playSequence(chime, 100);
  }

  // Tier transition sound (when crossing tier threshold)
  playTierTransition(fromTier: number, toTier: number): void {
    if (toTier <= fromTier) return;

    // Rising whoosh
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.5);

    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.6);

    // Play appropriate tier sound
    setTimeout(() => {
      switch (toTier) {
        case 2:
          this.playFlamme();
          break;
        case 3:
          this.playEmbrasement();
          break;
        case 4:
          this.playRevelation();
          break;
        case 5:
          this.playAccomplissement();
          break;
      }
    }, 300);
  }

  // Donation sound based on amount tier
  playDonationSound(tier: 'petit' | 'moyen' | 'grand' | 'exceptionnel'): void {
    switch (tier) {
      case 'petit':
        this.playEtincelle();
        break;
      case 'moyen':
        this.playFlamme();
        break;
      case 'grand':
        this.playEmbrasement();
        break;
      case 'exceptionnel':
        this.playRevelation();
        break;
    }
  }

  // Streak activation sound
  playStreakActivation(): void {
    const rising: SoundConfig[] = [
      { frequency: 400, duration: 0.1, type: 'sine', gain: 0.15 },
      { frequency: 500, duration: 0.1, type: 'sine', gain: 0.18 },
      { frequency: 600, duration: 0.1, type: 'sine', gain: 0.2 },
      { frequency: 800, duration: 0.2, type: 'sine', gain: 0.25 },
    ];
    this.playSequence(rising, 80);
  }

  // Ambient hum for atmosphere (optional)
  playAmbientPulse(): void {
    this.playTone({
      frequency: 60,
      duration: 2,
      type: 'sine',
      gain: 0.05,
      decay: 0.01
    });
  }
}

// Singleton instance
const soundManager = new SoundEffectsManager();

export function useSoundEffects() {
  return {
    playEtincelle: () => soundManager.playEtincelle(),
    playFlamme: () => soundManager.playFlamme(),
    playEmbrasement: () => soundManager.playEmbrasement(),
    playRevelation: () => soundManager.playRevelation(),
    playAccomplissement: () => soundManager.playAccomplissement(),
    playTierTransition: (from: number, to: number) => soundManager.playTierTransition(from, to),
    playDonationSound: (tier: 'petit' | 'moyen' | 'grand' | 'exceptionnel') => soundManager.playDonationSound(tier),
    playStreakActivation: () => soundManager.playStreakActivation(),
    playAmbientPulse: () => soundManager.playAmbientPulse(),
    setEnabled: (enabled: boolean) => soundManager.setEnabled(enabled),
    isEnabled: () => soundManager.isEnabled(),
  };
}
