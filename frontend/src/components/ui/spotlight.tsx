"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useAnimation, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";

export const Spotlight = ({
  gradientFirst = "radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(210, 100%, 85%, .08) 0, hsla(210, 100%, 55%, .02) 50%, hsla(210, 100%, 45%, 0) 80%)",
  gradientSecond = "radial-gradient(50% 50% at 50% 50%, hsla(210, 100%, 85%, .06) 0, hsla(210, 100%, 55%, .02) 80%, transparent 100%)",
  gradientThird = "radial-gradient(50% 50% at 50% 50%, hsla(210, 100%, 85%, .04) 0, hsla(210, 100%, 45%, .02) 80%, transparent 100%)",
  translateY = -350,
  width = 560,
  height = 1380,
  smallWidth = 240,
  duration = 7,
  xOffset = 100,
  className,
}: {
  gradientFirst?: string;
  gradientSecond?: string;
  gradientThird?: string;
  translateY?: number;
  width?: number;
  height?: number;
  smallWidth?: number;
  duration?: number;
  xOffset?: number;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const [mounted, setMounted] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (shouldReduceMotion) {
      controls.set({ x: 0 });
      return;
    }
    const runAnimation = async () => {
      await controls.start({
        x: [0, xOffset, -xOffset, 0],
        transition: {
          duration,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
        },
      });
    };
    runAnimation();
  }, [mounted, controls, duration, shouldReduceMotion, xOffset]);

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden",
        className,
      )}
    >
      <motion.div
        animate={controls}
        className="absolute top-0 left-1/2 -translate-x-1/2"
        style={{ translateY, width, height }}
      >
        <div
          className="absolute inset-0"
          style={{ background: gradientFirst }}
        />
        <div
          className="absolute top-0 right-0"
          style={{
            background: gradientSecond,
            width: smallWidth,
            height,
          }}
        />
        <div
          className="absolute top-0 left-0"
          style={{
            background: gradientThird,
            width: smallWidth,
            height,
          }}
        />
      </motion.div>
    </motion.div>
  );
};
