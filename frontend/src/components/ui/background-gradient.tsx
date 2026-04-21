"use client";
import { cn } from "../../lib/utils";
import { motion, useReducedMotion } from "framer-motion";

export const BackgroundGradient = ({
  children,
  className,
  containerClassName,
  animate = true,
}: {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  animate?: boolean;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = animate && !shouldReduceMotion;

  const variants = {
    initial: { backgroundPosition: "0 50%" },
    animate: {
      backgroundPosition: ["0 50%", "100% 50%", "0 50%"],
    },
  };

  return (
    <div className={cn("relative p-[1px] group", containerClassName)}>
      <motion.div
        variants={shouldAnimate ? variants : undefined}
        initial={shouldAnimate ? "initial" : undefined}
        animate={shouldAnimate ? "animate" : undefined}
        transition={
          shouldAnimate
            ? { duration: 10, repeat: Infinity, repeatType: "reverse" }
            : undefined
        }
        style={{ backgroundSize: "400% 400%" }}
        className={cn(
          "absolute inset-0 rounded-xl z-[1] opacity-40 group-hover:opacity-60 blur-sm transition-opacity duration-500",
          "bg-[radial-gradient(circle_farthest-side_at_0_100%,#3b82f6,transparent),radial-gradient(circle_farthest-side_at_100%_0,#06b6d4,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#8b5cf6,transparent),radial-gradient(circle_farthest-side_at_0_0,#10b981,#141316)]",
        )}
      />
      <motion.div
        variants={shouldAnimate ? variants : undefined}
        initial={shouldAnimate ? "initial" : undefined}
        animate={shouldAnimate ? "animate" : undefined}
        transition={
          shouldAnimate
            ? { duration: 10, repeat: Infinity, repeatType: "reverse" }
            : undefined
        }
        style={{ backgroundSize: "400% 400%" }}
        className={cn(
          "absolute inset-0 rounded-xl z-[1]",
          "bg-[radial-gradient(circle_farthest-side_at_0_100%,#3b82f6,transparent),radial-gradient(circle_farthest-side_at_100%_0,#06b6d4,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#8b5cf6,transparent),radial-gradient(circle_farthest-side_at_0_0,#10b981,#141316)]",
        )}
      />
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
};
