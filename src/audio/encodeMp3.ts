import { AudioBufferSource, BufferTarget, canEncodeAudio, Mp3OutputFormat, Output, QUALITY_HIGH } from 'mediabunny';
import { registerMp3Encoder } from '@mediabunny/mp3-encoder';
import { buildAudioBufferFromChannels } from './buildAudioBufferFromChannels';

let mp3EncoderRegistrationPromise: Promise<void> | null = null;

async function ensureMp3EncoderRegistered(): Promise<void> {
  if (!mp3EncoderRegistrationPromise) {
    mp3EncoderRegistrationPromise = (async () => {
      if (!(await canEncodeAudio('mp3'))) {
        registerMp3Encoder();
      }
    })();
  }
  return mp3EncoderRegistrationPromise;
}

export async function encodeMp3(channelData: Float32Array<ArrayBuffer>[], sampleRate: number): Promise<Blob> {
  await ensureMp3EncoderRegistered();

  const audioBuffer = buildAudioBufferFromChannels(channelData, sampleRate);

  const output = new Output({
    format: new Mp3OutputFormat(),
    target: new BufferTarget(),
  });
  const audioSource = new AudioBufferSource({ codec: 'mp3', bitrate: QUALITY_HIGH });
  output.addAudioTrack(audioSource);

  await output.start();
  await audioSource.add(audioBuffer);
  audioSource.close();
  await output.finalize();

  return new Blob([output.target.buffer!], { type: 'audio/mp3' });
}
