import { useEffect, useState } from 'react';

/** 3·2·1·GO. GO는 플레이 시작 직전에 잠깐 보인다. */
export function Countdown({ durationMs = 3000 }: { durationMs?: number }) {
  const steps = ['3', '2', '1', 'GO'];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), durationMs / (steps.length - 1));
    return () => clearInterval(id);
  }, [durationMs, steps.length]);

  return (
    <div className="mg-countdown" role="status" aria-live="assertive">
      {steps[index]}
    </div>
  );
}
