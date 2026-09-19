interface InitialData {
  clipName: string;
}

export function getInjectedData(): InitialData | null {
  const d = (window as unknown as { __INITIAL_DATA__?: Partial<InitialData> })
    .__INITIAL_DATA__;
  if (!d) return null;
  if (typeof d.clipName !== "string" || d.clipName === "__CLIP_NAME__")
    return null;
  return {
    clipName: d.clipName,
  };
}
