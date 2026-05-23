"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  thousandsSeparator?: boolean;
}

export default function AnimatedNumber({
  value,
  decimals = 2,
  duration = 600,
  className = "",
  thousandsSeparator = false,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = previousRef.current;
    const end = value;
    if (start === end) return;

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        previousRef.current = end;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = thousandsSeparator
    ? displayValue.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : displayValue.toFixed(decimals);

  return <span className={className}>{formatted}</span>;
}
