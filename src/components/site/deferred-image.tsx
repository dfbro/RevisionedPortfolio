"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
  fetchPriority?: "high" | "low" | "auto";
  draggable?: boolean;
  onClick?: () => void;
};

/** Starts low-priority image requests only when their rendered box is close to the viewport. */
export function DeferredImage({ src, alt, className, eager = false, fetchPriority = "low", draggable, onClick }: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    if (eager) return;
    const image = ref.current;
    if (!image) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      // Wait until the image actually enters the viewport; large native-lazy margins can
      // download whole below-the-fold sections while the hero is still animating.
      { rootMargin: "0px" },
    );
    observer.observe(image);
    return () => observer.disconnect();
  }, [eager, src]);

  const load = eager || nearViewport;
  return (
    <img
      ref={ref}
      src={load ? src : undefined}
      data-deferred-src={load ? undefined : src}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : fetchPriority}
      decoding="async"
      draggable={draggable}
      onClick={onClick}
    />
  );
}
