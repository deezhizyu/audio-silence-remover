export type AlignmentMediaFileKind = 'video' | 'audio';

const VIDEO_FILE_EXTENSIONS = ['.mp4', '.mov'];

/** The alignment page accepts one mixed batch of files; each one is either an original video or a
    voice-changed audio track. Videos are recognized by MIME type or extension; anything else in the
    accepted batch is treated as audio. */
export function classifyAlignmentMediaFile(file: File): AlignmentMediaFileKind {
  if (file.type.startsWith('video/')) return 'video';
  const lowerCaseName = file.name.toLowerCase();
  if (VIDEO_FILE_EXTENSIONS.some(extension => lowerCaseName.endsWith(extension))) return 'video';
  return 'audio';
}
