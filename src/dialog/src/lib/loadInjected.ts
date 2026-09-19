interface InitialData {
  clipName: string;
  clipDuration: string;
  noteStartTimes: number[];
}

export function getInjectedData(): InitialData | null {
  const d = (window as unknown as { __INITIAL_DATA__?: Partial<InitialData> })
    .__INITIAL_DATA__;
  if (!d) return null;
  if (typeof d.clipName !== "string" || d.clipName === "__CLIP_NAME__")
    return null;
  if (
    typeof d.clipDuration !== "string" ||
    d.clipDuration === "__CLIP_DURATION__"
  )
    return null;
  if (
    typeof d.noteStartTimes !== "string" ||
    d.clipDuration === "__NOTE_START_TIMES__"
  )
    return null;
  
  return {
    clipName: d.clipName,
    clipDuration: d.clipDuration,
    noteStartTimes: JSON.parse(d.noteStartTimes),
  };
}
