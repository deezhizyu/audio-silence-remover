import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from 'mediabunny';

export interface DecodedMediaAudioTrack {
  channelData: Float32Array<ArrayBuffer>[];
  sampleRate: number;
  durationSeconds: number;
}

/** Decodes the primary audio track out of a media file — a plain audio file or a video file with an
    embedded audio track both work identically here, since only the audio track is read.

    Uses `AudioSampleSink` (WebCodecs `AudioData`-backed) rather than mediabunny's `AudioBufferSink`:
    the latter yields Web Audio API `AudioBuffer` instances, which don't exist in a Worker's global
    scope, and this function runs inside the audio alignment worker. */
export async function decodeMediaFileAudioTrack(file: File): Promise<DecodedMediaAudioTrack> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const audioTrack = await input.getPrimaryAudioTrack();
  if (!audioTrack) throw new Error(`"${file.name}" has no audio track.`);

  const sampleRate = await audioTrack.getSampleRate();
  const numberOfChannels = await audioTrack.getNumberOfChannels();
  const sink = new AudioSampleSink(audioTrack);

  const channelChunksByChannel: Float32Array[][] = Array.from({ length: numberOfChannels }, () => []);
  let totalNumberOfFrames = 0;

  for await (const sample of sink.samples()) {
    totalNumberOfFrames += sample.numberOfFrames;
    for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex++) {
      const channelFrames = new Float32Array(sample.numberOfFrames);
      sample.copyTo(channelFrames, { format: 'f32-planar', planeIndex: channelIndex });
      channelChunksByChannel[channelIndex].push(channelFrames);
    }
    sample.close();
  }

  const channelData = channelChunksByChannel.map(chunks => {
    const merged = new Float32Array(totalNumberOfFrames);
    let writeOffset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, writeOffset);
      writeOffset += chunk.length;
    }
    return merged;
  });

  return { channelData, sampleRate, durationSeconds: totalNumberOfFrames / sampleRate };
}
