import { describe, expect, test } from 'vitest';
import { decideOutputContainerFormat } from './decideOutputContainerFormat';

describe('decideOutputContainerFormat', () => {
  test('recognizes .mov (any case) as the mov container', () => {
    expect(decideOutputContainerFormat('clip.mov')).toBe('mov');
    expect(decideOutputContainerFormat('CLIP.MOV')).toBe('mov');
    expect(decideOutputContainerFormat('clip.Mov')).toBe('mov');
  });

  test('treats .mp4 and any other extension as the mp4 container', () => {
    expect(decideOutputContainerFormat('clip.mp4')).toBe('mp4');
    expect(decideOutputContainerFormat('CLIP.MP4')).toBe('mp4');
    expect(decideOutputContainerFormat('clip.m4v')).toBe('mp4');
    expect(decideOutputContainerFormat('clip')).toBe('mp4');
  });
});
