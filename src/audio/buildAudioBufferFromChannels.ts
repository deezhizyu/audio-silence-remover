export function buildAudioBufferFromChannels(channelData: Float32Array<ArrayBuffer>[], sampleRate: number): AudioBuffer {
  const audioBuffer = new AudioBuffer({
    numberOfChannels: channelData.length,
    length: channelData[0]?.length ?? 0,
    sampleRate,
  });

  for (let channelIndex = 0; channelIndex < channelData.length; channelIndex++) {
    audioBuffer.copyToChannel(channelData[channelIndex], channelIndex);
  }

  return audioBuffer;
}
