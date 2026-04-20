"use client";
import { useEffect, useRef, useCallback } from "react";
import { cn } from "../../lib/utils";

interface SparklesCoreProps {
  background?: string;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  particleColor?: string;
  particleDensity?: number;
  className?: string;
}

export const SparklesCore = ({
  background = "transparent",
  minSize = 0.4,
  maxSize = 1.2,
  speed = 1,
  particleColor = "#93c5fd",
  particleDensity = 60,
  className,
}: SparklesCoreProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<
    {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      fadeSpeed: number;
    }[]
  >([]);
  const animationRef = useRef<number>(0);

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 147, g: 197, b: 253 };
  };

  const initParticles = useCallback(
    (w: number, h: number) => {
      const count = Math.floor((w * h) / (10000 / particleDensity));
      particles.current = Array.from({ length: Math.min(count, 150) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * (maxSize - minSize) + minSize,
        speedX: (Math.random() - 0.5) * speed * 0.3,
        speedY: (Math.random() - 0.5) * speed * 0.3,
        opacity: Math.random(),
        fadeSpeed: Math.random() * 0.02 + 0.005,
      }));
    },
    [maxSize, minSize, particleDensity, speed],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
      initParticles(canvas.width, canvas.height);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const rgb = hexToRgb(particleColor);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.opacity += p.fadeSpeed;
        if (p.opacity >= 1 || p.opacity <= 0) p.fadeSpeed *= -1;
        if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
        if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, p.opacity))})`;
        ctx.fill();
      });
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      ro.disconnect();
    };
  }, [particleColor, initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0", className)}
      style={{ background, pointerEvents: "none" }}
    />
  );
};
