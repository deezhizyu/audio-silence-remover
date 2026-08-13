import type { DecodedAudioChannels } from './types';

export async function decodeAudioFile(file: File): Promise<DecodedAudioChannels> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = Array.from({ length: audioBuffer.numberOfChannels }, (_, channelIndex) =>
      audioBuffer.getChannelData(channelIndex).slice(),
    );

    return {
      channelData,
      sampleRate: audioBuffer.sampleRate,
      numberOfFrames: audioBuffer.length,
    };
  } finally {
    await audioContext.close();
  }
}
