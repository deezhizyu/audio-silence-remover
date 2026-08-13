const BYTES_PER_SAMPLE = 2;
const WAV_HEADER_SIZE_BYTES = 44;

/** Every real browser/CPU today is little-endian; detected once so the hot interleave loop below can write
    through a plain Int16Array (much faster than a DataView call per sample) whenever that holds, falling back
    to the byte-exact DataView path otherwise so output is correct regardless of host endianness. */
const IS_LITTLE_ENDIAN_HOST = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

function writeAsciiString(view: DataView, byteOffset: number, value: string): void {
  for (let index = 0; index < value.length; index++) {
    view.setUint8(byteOffset + index, value.charCodeAt(index));
  }
}

function floatSampleToInt16(sampleValue: number): number {
  const clampedValue = Math.max(-1, Math.min(1, sampleValue));
  return clampedValue < 0 ? clampedValue * 0x8000 : clampedValue * 0x7fff;
}

/** Encodes raw PCM channel data as a 16-bit little-endian WAV file. */
export function encodeWav(channelData: Float32Array<ArrayBuffer>[], sampleRate: number): Blob {
  const numberOfChannels = channelData.length;
  const numberOfFrames = channelData[0]?.length ?? 0;
  const dataSizeBytes = numberOfFrames * numberOfChannels * BYTES_PER_SAMPLE;
  const blockAlign = numberOfChannels * BYTES_PER_SAMPLE;
  const byteRate = sampleRate * blockAlign;

  const arrayBuffer = new ArrayBuffer(WAV_HEADER_SIZE_BYTES + dataSizeBytes);
  const view = new DataView(arrayBuffer);

  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSizeBytes, true);
  writeAsciiString(view, 8, 'WAVE');

  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * BYTES_PER_SAMPLE, true);

  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataSizeBytes, true);

  if (IS_LITTLE_ENDIAN_HOST) {
    const interleavedSamples = new Int16Array(arrayBuffer, WAV_HEADER_SIZE_BYTES, numberOfFrames * numberOfChannels);
    let sampleIndex = 0;
    for (let frame = 0; frame < numberOfFrames; frame++) {
      for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex++) {
        interleavedSamples[sampleIndex++] = floatSampleToInt16(channelData[channelIndex][frame]);
      }
    }
  } else {
    let byteOffset = WAV_HEADER_SIZE_BYTES;
    for (let frame = 0; frame < numberOfFrames; frame++) {
      for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex++) {
        view.setInt16(byteOffset, floatSampleToInt16(channelData[channelIndex][frame]), true);
        byteOffset += BYTES_PER_SAMPLE;
      }
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
