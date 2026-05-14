// Minimal PCM → WAV (RIFF) encoder. Lyria streams 48 kHz, 16-bit, stereo
// little-endian PCM, so the defaults match Lyria.

export interface WavFormat {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

export const LYRIA_PCM: WavFormat = {
  sampleRate: 48_000,
  channels: 2,
  bitsPerSample: 16,
};

// Gemini TTS returns 24 kHz mono 16-bit little-endian PCM.
export const GEMINI_TTS_PCM: WavFormat = {
  sampleRate: 24_000,
  channels: 1,
  bitsPerSample: 16,
};

export function pcmChunksToWav(
  chunks: readonly Uint8Array[],
  format: WavFormat = LYRIA_PCM,
): Buffer {
  const { sampleRate, channels, bitsPerSample } = format;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  let dataLength = 0;
  for (const chunk of chunks) dataLength += chunk.byteLength;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);            // PCM fmt chunk size
  header.writeUInt16LE(1, 20);             // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataLength, 40);

  return Buffer.concat([header, ...chunks.map((c) => Buffer.from(c))]);
}
