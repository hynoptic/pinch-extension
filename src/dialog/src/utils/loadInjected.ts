interface InitialData {
  clipName: string;
  logUrl?: string;
}

export function getInjectedData(): InitialData | null {
  const d = (window as unknown as { __INITIAL_DATA__?: Partial<InitialData> })
    .__INITIAL_DATA__;
  if (!d) return null;
  if (typeof d.clipName !== "string" || d.clipName === "__CLIP_NAME__")
    return null;
  if (typeof d.logUrl !== "string" || d.clipName === "__LOG_URL__") return null;
  return {
    clipName: d.clipName,
    logUrl: d.logUrl,
  };
}

export function getLogUrl(): string | null {
  return getInjectedData()?.logUrl ?? null;
}

// export const step = async <T>(
//   label: string,
//   fn: () => Promise<T>,
// ): Promise<T> => {
//   console.log(`[paulstretch] step: ${label}`);
//   try {
//     return await fn();
//   } catch (e) {
//     const detail =
//       e === undefined
//         ? "<undefined>"
//         : e instanceof Error
//           ? `${e.message}\n${e.stack ?? ""}`
//           : typeof e === "object"
//             ? JSON.stringify(e)
//             : String(e);
//     throw new Error(`step "${label}" failed: ${detail}`);
//   }
// };
