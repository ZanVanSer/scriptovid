export type MusicState = {
  enabled: boolean;
  audioUrl: string | null;
  filePath: string | null;
  fileName: string | null;
  duration: number | null;
  loop: boolean;
  volume: number;
};

export function createDefaultMusicState(): MusicState {
  return {
    enabled: false,
    audioUrl: null,
    filePath: null,
    fileName: null,
    duration: null,
    loop: false,
    volume: 25,
  };
}
