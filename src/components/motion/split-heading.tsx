"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import { onIntroDone } from "@/lib/intro";
import { gsap, NO_REDUCED, SplitText } from "@/lib/motion";

type Props = { text: string; as?: "h1" | "h2" | "p" | "span"; className?: string; delay?: number; onScroll?: boolean; waitIntro?: boolean };

export function SplitHeading({ text, as: Tag = "h2", className, delay = 0, onScroll = false, waitIntro = false }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(
    (_, contextSafe) => {
      const mm = gsap.matchMedia();
      mm.add(NO_REDUCED, () => {
        let disposed = false;
        let split: SplitText | undefined;
        const createSplitNow = () => {
          if (disposed || !ref.current) return;
          split = SplitText.create(ref.current, {
            // Only chars are animated; wrapping every word as well creates unused DOM nodes.
            type: "chars",
            mask: "chars",
            onSplit: (self) =>
              gsap.from(self.chars, {
                yPercent: 110,
                duration: 0.86,
                ease: "power3.out",
                stagger: 0.014,
                delay,
                scrollTrigger: onScroll ? { trigger: ref.current, start: "top 85%", once: true } : undefined,
              }),
          });
        };
        const createSplit = contextSafe?.(createSplitNow) ?? createSplitNow;
        const start = () => {
          if (document.fonts.status === "loaded") createSplit();
          else void document.fonts.ready.then(createSplit);
        };
        const off = waitIntro ? onIntroDone(start) : (start(), undefined);
        return () => {
          disposed = true;
          off?.();
          split?.revert();
        };
      });
      return () => mm.revert();
    },
    { scope: ref },
  );
  return (
    <Tag ref={ref} className={className}>
      {text}
    </Tag>
  );
}
