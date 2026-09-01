import { clampNumber } from '../utils/clampNumber';
import { EDGE_FADE_DURATION_SECONDS } from './applyEdgeFades';

/** Lead-in before scheduled audio actually starts, so `AudioContext.currentTime` never races the scheduling call. */
const SCHEDULING_LEAD_IN_SECONDS = 0.03;
const POSITION_TRACKING_INTERVAL_MILLISECONDS = 40;

export type AlignmentPlaybackSource = 'original' | 'voiceChanged';

/**
 * Plays back either the original video (picture + its own native audio track, perfectly in sync by
 * construction) or the voice-changed audio (video's picture, muted, alongside the voice-changed buffer
 * scheduled through Web Audio) — never both at once, and always from a shared position on the
 * original video's timeline, so switching source mid-scrub keeps the same playhead position.
 *
 * The voice-changed schedule uses the exact same `offsetSeconds + trimStartSeconds` / `trimEndSeconds`
 * numbers `shiftAndTrimAudioChannels` and `applyEdgeFades` use for the real export — see `playVoiceChanged`.
 */
export class AlignmentPreviewPlaybackController {
  private readonly audioContext: AudioContext;
  private videoElement: HTMLVideoElement | null = null;
  private voiceChangedBuffer: AudioBuffer | null = null;

  private activeSourceNode: AudioBufferSourceNode | null = null;
  private activeGainNode: GainNode | null = null;
  private positionTrackingIntervalId: ReturnType<typeof setInterval> | null = null;

  private activeSource: AlignmentPlaybackSource | null = null;
  private isPlaying = false;
  private lastKnownPositionSeconds = 0;

  onTimeUpdate: (positionSeconds: number) => void = () => {};
  onPlaybackStateChange: (isPlaying: boolean, source: AlignmentPlaybackSource | null) => void = () => {};

  constructor() {
    this.audioContext = new AudioContext();
  }

  attachVideoElement(videoElement: HTMLVideoElement | null): void {
    this.videoElement = videoElement;
  }

  setVoiceChangedBuffer(buffer: AudioBuffer | null): void {
    this.voiceChangedBuffer = buffer;
  }

  get currentPositionSeconds(): number {
    return this.isPlaying && this.videoElement ? this.videoElement.currentTime : this.lastKnownPositionSeconds;
  }

  playOriginal(fromSeconds?: number): void {
    const videoElement = this.videoElement;
    if (!videoElement) return;
    if (this.audioContext.state === 'suspended') void this.audioContext.resume();

    this.stopActiveAudioNode();
    const targetSeconds = fromSeconds ?? this.lastKnownPositionSeconds;

    videoElement.muted = false;
    videoElement.currentTime = targetSeconds;
    void videoElement.play();

    this.activeSource = 'original';
    this.isPlaying = true;
    this.lastKnownPositionSeconds = targetSeconds;
    this.onPlaybackStateChange(true, 'original');
    this.startPositionTracking();
  }

  /**
   * `offsetSeconds`/`trimStartSeconds`/`trimEndSeconds` are the literal values the export pipeline uses
   * (`netStartShiftSeconds = offsetSeconds + trimStartSeconds` fed to `shiftAndTrimAudioChannels`, the
   * same `EDGE_FADE_DURATION_SECONDS` fade `applyEdgeFades` applies last) — the preview is built from the
   * same numbers, not a separate approximation of them.
   */
  playVoiceChanged(fromSeconds: number | undefined, offsetSeconds: number, trimStartSeconds: number, trimEndSeconds: number): void {
    const videoElement = this.videoElement;
    const buffer = this.voiceChangedBuffer;
    if (!videoElement || !buffer) return;
    if (this.audioContext.state === 'suspended') void this.audioContext.resume();

    this.stopActiveAudioNode();
    const targetSeconds = Math.max(0, fromSeconds ?? this.lastKnownPositionSeconds);

    const netStartShiftSeconds = offsetSeconds + trimStartSeconds;
    const playableDurationSeconds = Math.max(0, buffer.duration - Math.max(0, netStartShiftSeconds) - trimEndSeconds);

    videoElement.muted = true;
    videoElement.currentTime = targetSeconds;
    void videoElement.play();

    this.activeSource = 'voiceChanged';
    this.isPlaying = true;
    this.lastKnownPositionSeconds = targetSeconds;
    this.onPlaybackStateChange(true, 'voiceChanged');
    this.startPositionTracking();

    if (playableDurationSeconds <= 0 || targetSeconds >= playableDurationSeconds) return; // nothing left to schedule — video plays on silently, matching what export would produce

    // How far `targetSeconds` sits into the processed track: negative shifts mean the track's first
    // `-netStartShiftSeconds` seconds are inserted silence, which the buffer itself doesn't contain.
    const silenceRemainingSeconds = Math.max(0, -netStartShiftSeconds - targetSeconds);
    const bufferOffsetSeconds = Math.max(0, targetSeconds + netStartShiftSeconds);
    const bufferPlayDurationSeconds = buffer.duration - trimEndSeconds - bufferOffsetSeconds;
    if (bufferPlayDurationSeconds <= 0) return;

    // Fade automation is scheduled against the *absolute* start of the processed track (even if that
    // moment is already in the past relative to `contextTime_now`, when starting mid-scrub) so the same
    // fade-in/out shape lands at the same points in the track as export's baked-in fade, and is simply
    // inaudible if playback starts after the fade-in window has already elapsed.
    const schedulingStartContextTime = this.audioContext.currentTime + SCHEDULING_LEAD_IN_SECONDS;
    const trackStartContextTime = schedulingStartContextTime - targetSeconds;
    const audioStartContextTime = schedulingStartContextTime + silenceRemainingSeconds;

    const sourceNode = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    sourceNode.buffer = buffer;
    sourceNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    const fadeSeconds = Math.min(EDGE_FADE_DURATION_SECONDS, playableDurationSeconds / 2);
    gainNode.gain.setValueAtTime(0, trackStartContextTime);
    gainNode.gain.linearRampToValueAtTime(1, trackStartContextTime + fadeSeconds);
    gainNode.gain.setValueAtTime(1, trackStartContextTime + playableDurationSeconds - fadeSeconds);
    gainNode.gain.linearRampToValueAtTime(0, trackStartContextTime + playableDurationSeconds);

    sourceNode.start(audioStartContextTime, bufferOffsetSeconds, bufferPlayDurationSeconds);
    this.activeSourceNode = sourceNode;
    this.activeGainNode = gainNode;
  }

  pause(): void {
    if (!this.isPlaying) return;
    this.lastKnownPositionSeconds = this.currentPositionSeconds;
    this.videoElement?.pause();
    this.stopActiveAudioNode();
    this.isPlaying = false;
    this.onPlaybackStateChange(false, this.activeSource);
    this.onTimeUpdate(this.lastKnownPositionSeconds);
    this.stopPositionTracking();
  }

  /** Seeks to `seconds` on the shared timeline. Restarts playback from there if currently playing (same
      source), otherwise just moves the tracked position and the video element's own currentTime. */
  seek(seconds: number, offsetSeconds: number, trimStartSeconds: number, trimEndSeconds: number): void {
    const wasPlaying = this.isPlaying;
    const source = this.activeSource;

    if (wasPlaying && source === 'original') {
      this.playOriginal(seconds);
    } else if (wasPlaying && source === 'voiceChanged') {
      this.playVoiceChanged(seconds, offsetSeconds, trimStartSeconds, trimEndSeconds);
    } else {
      this.lastKnownPositionSeconds = seconds;
      if (this.videoElement) this.videoElement.currentTime = seconds;
      this.onTimeUpdate(seconds);
    }
  }

  dispose(): void {
    this.stopActiveAudioNode();
    this.stopPositionTracking();
    this.videoElement = null;
    void this.audioContext.close();
  }

  private stopActiveAudioNode(): void {
    if (!this.activeSourceNode) return;
    try {
      this.activeSourceNode.stop();
    } catch {
      // Already stopped/ended - nothing to do.
    }
    this.activeSourceNode.disconnect();
    this.activeGainNode?.disconnect();
    this.activeSourceNode = null;
    this.activeGainNode = null;
  }

  // A timer, not requestAnimationFrame: rAF callbacks stop firing once the tab isn't the one actively
  // rendering, but the video (and any scheduled audio) keeps playing regardless of tab visibility.
  private startPositionTracking(): void {
    this.stopPositionTracking();
    this.positionTrackingIntervalId = setInterval(() => {
      const videoElement = this.videoElement;
      if (!videoElement) return;

      if (videoElement.ended) {
        this.lastKnownPositionSeconds = videoElement.duration || this.lastKnownPositionSeconds;
        this.isPlaying = false;
        this.stopActiveAudioNode();
        this.onPlaybackStateChange(false, this.activeSource);
        this.onTimeUpdate(this.lastKnownPositionSeconds);
        this.stopPositionTracking();
        return;
      }

      this.onTimeUpdate(clampNumber(videoElement.currentTime, 0, videoElement.duration || Infinity));
    }, POSITION_TRACKING_INTERVAL_MILLISECONDS);
  }

  private stopPositionTracking(): void {
    if (this.positionTrackingIntervalId !== null) {
      clearInterval(this.positionTrackingIntervalId);
      this.positionTrackingIntervalId = null;
    }
  }
}
