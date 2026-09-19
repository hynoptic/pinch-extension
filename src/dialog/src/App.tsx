import { getInjectedData } from "./utils/loadInjected";
import { closeWithResult } from "./ipc";

const INJECTED = getInjectedData();

export function App() {
  const onApply = () => {
    closeWithResult({ sampleRate: "44100", someParam: "baz" });
  };

  return (
    <>
      {INJECTED?.clipName}
      <button className="menu-button primary" onClick={onApply}>
        Apply
      </button>
    </>
  );
}
