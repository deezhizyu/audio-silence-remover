import { computePlaybackSegments, type PlaybackSegment } from './computePlaybackSegments';
import type { DetectionConfig, SilenceRegion } from './types';

/** Lead-in before scheduled audio actually starts, so `AudioContext.currentTime` never races the scheduling call. */
const SCHEDULING_LEAD_IN_SECONDS = 0.03;
/** Per-segment fade at each skip boundary so a hard cut never produces an audible click. */
const SEGMENT_FADE_SECONDS = 0.008;
const POSITION_TRACKING_INTERVAL_MILLISECONDS = 40;

interface SegmentPosition {
  segmentIndex: number;
  offsetSeconds: number;
}

/**
 * Plays the original decoded audio but only schedules the ranges `computePlaybackSegments` says survive the
 * current silence configuration — silence gets skipped exactly where the exported file would cut it, without
 * ever re-encoding a trimmed copy. Play/seek always (re)builds the schedule from scratch rather than trying to
 * reuse suspended nodes, which keeps behavior correct even when the silence configuration changes mid-playback.
 */
export class PreviewPlaybackController {
  private readonly audioContext: AudioContext;
  private readonly audioBuffer: AudioBuffer;

  private segments: PlaybackSegment[] = [];
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  private positionTrackingIntervalId: ReturnType<typeof setInterval> | null = null;

  private isPlaying = false;
  private playbackStartContextTime = 0;
  private playbackStartSegmentIndex = 0;
  private playbackStartOffsetSeconds = 0;
  private lastKnownOriginalTimeSeconds = 0;

  onTimeUpdate: (originalTimeSeconds: number) => void = () => {};
  onPlaybackStateChange: (isPlaying: boolean) => void = () => {};

  constructor(audioBuffer: AudioBuffer) {
    this.audioBuffer = audioBuffer;
    this.audioContext = new AudioContext();
  }

  get durationSeconds(): number {
    return this.audioBuffer.duration;
  }

  updateSegments(regions: SilenceRegion[], config: DetectionConfig): void {
    const resumeFromSeconds = this.isPlaying ? this.getCurrentOriginalTimeSeconds() : this.lastKnownOriginalTimeSeconds;
    this.segments = computePlaybackSegments(this.audioBuffer.duration, this.audioBuffer.sampleRate, regions, config);

    if (this.isPlaying) {
      this.play(resumeFromSeconds);
      return;
    }

    const located = this.locateSegmentPosition(resumeFromSeconds);
    this.lastKnownOriginalTimeSeconds = located
      ? this.segments[located.segmentIndex].originalStartSeconds + located.offsetSeconds
      : resumeFromSeconds;
  }

  play(fromOriginalSeconds?: number): void {
    if (this.audioContext.state === 'suspended') void this.audioContext.resume();
    this.stopActiveSourceNodes();

    const targetOriginalSeconds = fromOriginalSeconds ?? this.lastKnownOriginalTimeSeconds;
    const located = this.locateSegmentPosition(targetOriginalSeconds);
    if (!located) {
      if (targetOriginalSeconds > 0) this.play(0);
      return;
    }

    this.playbackStartSegmentIndex = located.segmentIndex;
    this.playbackStartOffsetSeconds = located.offsetSeconds;
    this.playbackStartContextTime = this.audioContext.currentTime + SCHEDULING_LEAD_IN_SECONDS;

    this.scheduleSegmentsFrom(located.segmentIndex, located.offsetSeconds, this.playbackStartContextTime);

    this.isPlaying = true;
    this.lastKnownOriginalTimeSeconds = targetOriginalSeconds;
    this.onPlaybackStateChange(true);
    this.startPositionTracking();
  }

  pause(): void {
    if (!this.isPlaying) return;
    this.lastKnownOriginalTimeSeconds = this.getCurrentOriginalTimeSeconds();
    this.stopActiveSourceNodes();
    this.isPlaying = false;
    this.onPlaybackStateChange(false);
    this.onTimeUpdate(this.lastKnownOriginalTimeSeconds);
    this.stopPositionTracking();
  }

  restart(): void {
    this.play(0);
  }

  dispose(): void {
    this.stopActiveSourceNodes();
    this.stopPositionTracking();
    void this.audioContext.close();
  }

  /** Finds which segment a moment in the original timeline falls into, snapping forward past any gap (skipped silence). */
  private locateSegmentPosition(originalSeconds: number): SegmentPosition | null {
    for (let index = 0; index < this.segments.length; index++) {
      const segment = this.segments[index];
      if (originalSeconds < segment.originalStartSeconds) return { segmentIndex: index, offsetSeconds: 0 };
      if (originalSeconds < segment.originalEndSeconds) {
        return { segmentIndex: index, offsetSeconds: originalSeconds - segment.originalStartSeconds };
      }
    }
    return null;
  }

  private scheduleSegmentsFrom(startIndex: number, offsetIntoFirstSegment: number, startContextTime: number): void {
    let scheduledContextTime = startContextTime;

    for (let index = startIndex; index < this.segments.length; index++) {
      const segment = this.segments[index];
      const segmentOffsetSeconds = index === startIndex ? offsetIntoFirstSegment : 0;
      const bufferOffsetSeconds = segment.originalStartSeconds + segmentOffsetSeconds;
      const durationSeconds = segment.originalEndSeconds - bufferOffsetSeconds;
      if (durationSeconds <= 0) continue;

      const sourceNode = this.audioContext.createBufferSource();
      const segmentGain = this.audioContext.createGain();
      sourceNode.buffer = this.audioBuffer;
      sourceNode.connect(segmentGain);
      segmentGain.connect(this.audioContext.destination);

      const fadeSeconds = Math.min(SEGMENT_FADE_SECONDS, durationSeconds / 2);
      segmentGain.gain.setValueAtTime(0, scheduledContextTime);
      segmentGain.gain.linearRampToValueAtTime(1, scheduledContextTime + fadeSeconds);
      segmentGain.gain.setValueAtTime(1, scheduledContextTime + durationSeconds - fadeSeconds);
      segmentGain.gain.linearRampToValueAtTime(0, scheduledContextTime + durationSeconds);

      sourceNode.start(scheduledContextTime, bufferOffsetSeconds, durationSeconds);
      this.activeSourceNodes.push(sourceNode);

      scheduledContextTime += durationSeconds;
    }

    const lastSourceNode = this.activeSourceNodes[this.activeSourceNodes.length - 1];
    if (!lastSourceNode) {
      this.handlePlaybackEnded();
      return;
    }
    lastSourceNode.onended = () => {
      if (this.activeSourceNodes[this.activeSourceNodes.length - 1] === lastSourceNode) this.handlePlaybackEnded();
    };
  }

  private handlePlaybackEnded(): void {
    this.isPlaying = false;
    this.lastKnownOriginalTimeSeconds = this.segments.length > 0 ? this.segments[this.segments.length - 1].originalEndSeconds : 0;
    this.activeSourceNodes = [];
    this.onTimeUpdate(this.lastKnownOriginalTimeSeconds);
    this.onPlaybackStateChange(false);
    this.stopPositionTracking();
  }

  private stopActiveSourceNodes(): void {
    for (const sourceNode of this.activeSourceNodes) {
      sourceNode.onended = null;
      try {
        sourceNode.stop();
      } catch {
        // Already stopped/ended - nothing to do.
      }
      sourceNode.disconnect();
    }
    this.activeSourceNodes = [];
  }

  private getCurrentOriginalTimeSeconds(): number {
    if (!this.isPlaying) return this.lastKnownOriginalTimeSeconds;

    const startSegment = this.segments[this.playbackStartSegmentIndex];
    const elapsedSeconds = this.audioContext.currentTime - this.playbackStartContextTime;
    if (elapsedSeconds <= 0 || !startSegment) {
      return startSegment ? startSegment.originalStartSeconds + this.playbackStartOffsetSeconds : this.lastKnownOriginalTimeSeconds;
    }

    let remainingSeconds = elapsedSeconds;
    for (let index = this.playbackStartSegmentIndex; index < this.segments.length; index++) {
      const segment = this.segments[index];
      const segmentOffsetSeconds = index === this.playbackStartSegmentIndex ? this.playbackStartOffsetSeconds : 0;
      const segmentRemainingDuration = segment.originalEndSeconds - segment.originalStartSeconds - segmentOffsetSeconds;

      if (remainingSeconds < segmentRemainingDuration) {
        return segment.originalStartSeconds + segmentOffsetSeconds + remainingSeconds;
      }
      remainingSeconds -= segmentRemainingDuration;
    }

    const lastSegment = this.segments[this.segments.length - 1];
    return lastSegment ? lastSegment.originalEndSeconds : 0;
  }

  // A timer, not requestAnimationFrame: rAF callbacks stop firing once the tab isn't the one actively
  // rendering (backgrounded or occluded), even though Web Audio playback itself keeps running regardless.
  // People frequently switch tabs while audio plays, so the displayed position has to keep up either way.
  private startPositionTracking(): void {
    this.stopPositionTracking();
    this.positionTrackingIntervalId = setInterval(() => {
      this.onTimeUpdate(this.getCurrentOriginalTimeSeconds());
    }, POSITION_TRACKING_INTERVAL_MILLISECONDS);
  }

  private stopPositionTracking(): void {
    if (this.positionTrackingIntervalId !== null) {
      clearInterval(this.positionTrackingIntervalId);
      this.positionTrackingIntervalId = null;
    }
  }
}
