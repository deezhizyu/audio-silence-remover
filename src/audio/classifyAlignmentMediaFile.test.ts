import { describe, expect, test } from 'vitest';
import { classifyAlignmentMediaFile } from './classifyAlignmentMediaFile';

function makeFile(name: string, type: string): File {
  return new File([], name, { type });
}

describe('classifyAlignmentMediaFile', () => {
  test('classifies a video MIME type as video', () => {
    expect(classifyAlignmentMediaFile(makeFile('clip.mp4', 'video/mp4'))).toBe('video');
  });

  test('classifies an audio MIME type as audio', () => {
    expect(classifyAlignmentMediaFile(makeFile('voice.wav', 'audio/wav'))).toBe('audio');
  });

  test('falls back to the .mp4 extension when the MIME type is empty', () => {
    expect(classifyAlignmentMediaFile(makeFile('clip.MP4', ''))).toBe('video');
  });

  test('falls back to the .mov extension when the MIME type is empty', () => {
    expect(classifyAlignmentMediaFile(makeFile('clip.mov', ''))).toBe('video');
  });

  test('treats an unrecognized type/extension as audio', () => {
    expect(classifyAlignmentMediaFile(makeFile('voice.m4a', ''))).toBe('audio');
  });
});
