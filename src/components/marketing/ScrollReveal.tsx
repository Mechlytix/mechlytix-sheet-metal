"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// ─────────────────────────────────────────────────────────
// ScrollReveal — GSAP ScrollTrigger wrapper for sections
// Wraps children in an element that fades/slides in on scroll
// ─────────────────────────────────────────────────────────

gsap.registerPlugin(ScrollTrigger);

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "none";
  duration?: number;
  as?: keyof HTMLElementTagNameMap;
}

export default function ScrollReveal({
  children,
  className,
  delay = 0,
  direction = "up",
  duration = 0.8,
  as: Tag = "div" as keyof HTMLElementTagNameMap,
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fromVars: gsap.TweenVars = {
      opacity: 0,
      duration,
      delay,
      ease: "power3.out",
    };

    if (direction === "up") fromVars.y = 40;
    else if (direction === "left") fromVars.x = -40;
    else if (direction === "right") fromVars.x = 40;

    const tween = gsap.from(el, {
      ...fromVars,
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        toggleActions: "play none none none",
      },
    });

    return () => {
      tween.kill();
    };
  }, [delay, direction, duration]);

  // @ts-expect-error — dynamic tag
  return <Tag ref={ref} className={className}>{children}</Tag>;
}
