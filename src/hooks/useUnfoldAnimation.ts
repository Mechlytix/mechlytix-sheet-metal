"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { gsap } from "gsap";

export interface UnfoldAnimationState {
  /** Current animation progress 0 (folded) → 1 (flat) */
  progress: number;
  /** Whether the animation is currently playing */
  isPlaying: boolean;
  /** Playback speed multiplier */
  speed: number;
}

export interface UnfoldAnimationControls {
  /** Start playing the unfold animation */
  play: () => void;
  /** Pause the animation */
  pause: () => void;
  /** Toggle play/pause */
  toggle: () => void;
  /** Reset to folded state */
  reset: () => void;
  /** Scrub to a specific progress value */
  scrubTo: (progress: number) => void;
  /** Set playback speed */
  setSpeed: (speed: number) => void;
}

/**
 * Hook that manages the GSAP-driven unfold animation.
 * Returns a progress ref (for useFrame reads) and UI controls.
 */
export function useUnfoldAnimation() {
  const progressRef = useRef(0);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const speedRef = useRef(1);

  const [state, setState] = useState<UnfoldAnimationState>({
    progress: 0,
    isPlaying: false,
    speed: 1,
  });

  // Proxy object that GSAP animates — we read .value in useFrame
  const proxy = useRef({ value: 0 });

  const syncState = useCallback((playing: boolean) => {
    setState((prev) => ({
      ...prev,
      progress: proxy.current.value,
      isPlaying: playing,
    }));
  }, []);

  const play = useCallback(() => {
    tweenRef.current?.kill();
    const startVal = proxy.current.value;
    // If already at end, restart from beginning
    const from = startVal >= 0.99 ? 0 : startVal;
    proxy.current.value = from;
    progressRef.current = from;

    tweenRef.current = gsap.to(proxy.current, {
      value: 1,
      duration: 1.8 / speedRef.current,
      ease: "power2.inOut",
      onUpdate: () => {
        progressRef.current = proxy.current.value;
        setState((prev) => ({
          ...prev,
          progress: proxy.current.value,
          isPlaying: true,
        }));
      },
      onComplete: () => syncState(false),
    });
    syncState(true);
  }, [syncState]);

  const pause = useCallback(() => {
    tweenRef.current?.pause();
    syncState(false);
  }, [syncState]);

  const toggle = useCallback(() => {
    if (tweenRef.current?.isActive()) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  const reset = useCallback(() => {
    tweenRef.current?.kill();
    proxy.current.value = 0;
    progressRef.current = 0;
    syncState(false);
  }, [syncState]);

  const scrubTo = useCallback((value: number) => {
    tweenRef.current?.kill();
    proxy.current.value = value;
    progressRef.current = value;
    setState((prev) => ({
      ...prev,
      progress: value,
      isPlaying: false,
    }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    speedRef.current = speed;
    setState((prev) => ({ ...prev, speed }));
    // If currently playing, update the tween's timeScale
    if (tweenRef.current?.isActive()) {
      tweenRef.current.timeScale(speed);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      tweenRef.current?.kill();
    };
  }, []);

  const controls: UnfoldAnimationControls = {
    play,
    pause,
    toggle,
    reset,
    scrubTo,
    setSpeed,
  };

  return { progressRef, state, controls };
}
