import { useEffect, useState } from 'react';

/** 3·2·1·GO. durationMs를 네 단계로 나눠 GO도 플레이 시작 직전에 한 단계만큼 보인다. */
export function Countdown({ durationMs = 3000 }: { durationMs?: number }) {
  const steps = ['3', '2', '1', 'GO'];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => Math.min(i + 1, steps.length - 1)),
      // steps.length - 1로 나누면 GO가 플레이 시작과 같은 순간에 바뀌어 보이지 않는다
      durationMs / steps.length,
    );
    return () => clearInterval(id);
  }, [durationMs, steps.length]);

  return (
    <div className="mg-countdown" role="status" aria-live="assertive">
      {steps[index]}
    </div>
  );
}
