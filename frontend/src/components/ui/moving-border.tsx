"use client";
import React, { useRef } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { cn } from "../../lib/utils";

export function MovingBorder({
  children,
  duration = 2000,
  rx = "30%",
  ry = "30%",
  className,
  containerClassName,
  borderClassName,
  as: Component = "button",
  ...otherProps
}: {
  children: React.ReactNode;
  duration?: number;
  rx?: string;
  ry?: string;
  className?: string;
  containerClassName?: string;
  borderClassName?: string;
  as?: React.ElementType;
  [key: string]: unknown;
}) {
  const pathRef = useRef<SVGRectElement>(null);
  const progress = useMotionValue<number>(0);
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = !shouldReduceMotion && duration > 0;

  useAnimationFrame((time) => {
    if (!shouldAnimate) return;
    const length = pathRef.current?.getTotalLength();
    if (length) {
      const pxPerMs = length / duration;
      progress.set((time * pxPerMs) % length);
    }
  });

  const x = useTransform(progress, (val) => {
    return pathRef.current?.getPointAtLength(val).x ?? 0;
  });
  const y = useTransform(progress, (val) => {
    return pathRef.current?.getPointAtLength(val).y ?? 0;
  });

  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <Component
      className={cn(
        "relative h-auto w-auto overflow-hidden bg-transparent p-[1px]",
        containerClassName,
      )}
      {...otherProps}
    >
      <div className="absolute inset-0" style={{ borderRadius: "inherit" }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="absolute h-full w-full"
          width="100%"
          height="100%"
        >
          <rect
            fill="none"
            width="100%"
            height="100%"
            rx={rx}
            ry={ry}
            ref={pathRef}
          />
        </svg>
        {shouldAnimate ? (
          <motion.div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              display: "inline-block",
              transform,
            }}
          >
            <div
              className={cn(
                "h-20 w-20 opacity-[0.8] blur-[12px]",
                borderClassName,
              )}
              style={{
                background:
                  "radial-gradient(#3b82f6 40%, #06b6d4 60%, transparent 80%)",
              }}
            />
          </motion.div>
        ) : (
          <div
            className="absolute inset-0 opacity-60"
            style={{
              borderRadius: "inherit",
              boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.35)",
            }}
          />
        )}
      </div>
      <div
        className={cn("relative z-10 flex items-center gap-2", className)}
        style={{
          borderRadius: "inherit",
        }}
      >
        {children}
      </div>
    </Component>
  );
}
