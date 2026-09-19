import { getInjectedData } from "./lib/loadInjected";
import { closeWithResult } from "./ipc";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { /*useEffect, useRef,*/ useState } from "react";
import { Slider } from "./components/ui/slider";
import { Button } from "./components/ui/button";
import { transformStartTime } from "./lib/transforms";

const INJECTED = getInjectedData();

export function App() {
  const [origin, setOrigin] = useState(50);
  const [amount, setAmount] = useState(0);
  // const parentRef = useRef<HTMLDivElement>(null);
  // const [w, setW] = useState(1060);

  const clipName = INJECTED?.clipName || "__CLIP_NAME__";
  const clipDuration = Number(INJECTED?.clipDuration) || 1;
  const noteStartTimes = INJECTED?.noteStartTimes || [];

  // useEffect(() => {
  //   if (!parentRef.current) return;
  //   const observer = new ResizeObserver(([entry]) => {
  //     setW(entry.contentRect.width - 32);
  //   });
  //   observer.observe(parentRef.current);
  //   return () => observer.disconnect();
  // }, []);

  const tNoteStartTimes = noteStartTimes.map((startTime) => {
    return transformStartTime(startTime, clipDuration, origin, amount);
  });

  const notes = tNoteStartTimes.map((note, i) => (
    <span
      style={{ left: `${(400 / clipDuration) * note}px` }}
      key={`note-${i}`}
      className="absolute top-8 inline-block w-2 h-2 rounded-full bg-slate-600 -translate-y-1/2"
    ></span>
  ));

  const renderNotes = (
    <div
      className="relative bg-slate-200"
      style={{ width: `${400}px`, height: "64px" }}
    >
      {notes}
      <span
        style={{ left: `${400 * (origin / 100)}px` }}
        className="w-0.5 h-full absolute bg-slate-300 rounded-full"
      ></span>
    </div>
  );

  const onApply = () => {
    closeWithResult({ origin: origin, amount: amount })
  };

  return (
    <Card /*ref={parentRef}*/ className="m-8 shadow-xl">
      <CardHeader>
        <CardTitle>
          Pinch '{clipName}'
        </CardTitle>
        <CardDescription>Ableton Extensions SDK example</CardDescription>
      </CardHeader>
      <CardContent>
        <div>{renderNotes}</div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 items-start">
        <p className="opacity-70">Origin: {origin}% of clip length</p>
        <div className="flex w-full items-center gap-2">
          <span>0%</span>
          <Slider
            min={0}
            max={100}
            value={origin}
            onValueChange={(value: any) => setOrigin(Number(value))}
          />
          <span>100%</span>
        </div>
        <p className="opacity-70">Amount: {amount}</p>
        <div className="flex w-full items-center gap-2">
          <span>-1</span>
          <Slider
            min={-1}
            max={1}
            step={0.05}
            value={amount}
            onValueChange={(value: any) => setAmount(Number(value))}
          />
          <span>+1</span>
        </div>
        <div className="w-full flex flex-row-reverse justify-between items-end gap-2">
          <Button
            size="sm"
            className="bg-slate-600"
            onClick={onApply}
          >
            Transform
          </Button>
          <span className="inline-block text-sm opacity-40">ESC to cancel</span>
        </div>
      </CardFooter>
    </Card>
  );
}
