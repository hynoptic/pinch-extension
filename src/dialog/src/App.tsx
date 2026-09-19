import { closeWithResult } from "./ipc";

interface InitialData {
  message: string;
}

function getSimpleInjectedData(): InitialData | null {
  const d = (window as unknown as { __INITIAL_DATA__?: Partial<InitialData> })
    .__INITIAL_DATA__;
  if (!d) return null;
  if (typeof d.message !== "string" || d.message === "__MESSAGE__") return null;
  return {
    message: d.message,
  };
}

const INJECTED = getSimpleInjectedData();

export function App() {
  const onApply = () => {
    closeWithResult({ sampleRate: "44100", someParam: "baz" });
  };

  return (
    <>
      {INJECTED?.message}
      <button className="menu-button primary" onClick={onApply}>
        Apply
      </button>
    </>
  );
}
