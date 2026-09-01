import {
  ALL_FORMATS,
  AudioSample,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  Conversion,
  Input,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
} from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import type { VideoContainerFormat } from './decideOutputContainerFormat';

let aacEncoderRegistrationPromise: Promise<void> | null = null;

async function ensureAacEncoderRegistered(): Promise<void> {
  if (!aacEncoderRegistrationPromise) {
    aacEncoderRegistrationPromise = (async () => {
      if (!(await canEncodeAudio('aac'))) {
        registerAacEncoder();
      }
    })();
  }
  return aacEncoderRegistrationPromise;
}

/** Interleaves per-channel `Float32Array`s into a single planar buffer (channel 0's frames, then channel
    1's, ...), the layout `AudioSample`'s `'f32-planar'` format expects. */
function buildPlanarAudioSample(channelData: Float32Array<ArrayBuffer>[], sampleRate: number): AudioSample {
  const numberOfChannels = channelData.length;
  const numberOfFrames = channelData[0]?.length ?? 0;
  const planarData = new Float32Array(numberOfChannels * numberOfFrames);
  for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex++) {
    planarData.set(channelData[channelIndex], channelIndex * numberOfFrames);
  }

  return new AudioSample({ data: planarData, format: 'f32-planar', numberOfChannels, sampleRate, timestamp: 0 });
}

/** Muxes `processedChannelData` into `videoFile`'s own video track, copied byte-for-byte with no
    re-encode (same quality/bitrate/resolution), replacing only the audio track.

    Uses `AudioSampleSource` (WebCodecs `AudioData`-backed) rather than mediabunny's
    `AudioBufferSource`: the latter takes a Web Audio API `AudioBuffer`, which doesn't exist in a
    Worker's global scope, and this function runs inside the audio alignment worker. */
export async function muxAudioIntoVideoContainer(
  videoFile: File,
  processedChannelData: Float32Array<ArrayBuffer>[],
  sampleRate: number,
  containerFormat: VideoContainerFormat,
): Promise<Blob> {
  await ensureAacEncoderRegistered();

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(videoFile) });
  const output = new Output({
    format: containerFormat === 'mov' ? new MovOutputFormat() : new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  const conversion = await Conversion.init({ input, output, audio: { discard: true }, composable: true, tracks: 'primary' });
  if (!conversion.isValid) throw new Error('Could not copy the original video track for this file.');

  const audioSource = new AudioSampleSource({ codec: 'aac', quality: QUALITY_HIGH });
  output.addAudioTrack(audioSource);

  const audioSample = buildPlanarAudioSample(processedChannelData, sampleRate);

  await output.start();
  await Promise.all([
    conversion.execute(),
    audioSource.add(audioSample).then(() => {
      audioSample.close();
      audioSource.close();
    }),
  ]);
  await output.finalize();

  return new Blob([output.target.buffer!], { type: containerFormat === 'mov' ? 'video/quicktime' : 'video/mp4' });
}
