import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; vx: number; vy: number; size: number; hue: number; spin: number; angle: number };
export function WinParticles({ trigger }: { trigger: string | number | null | undefined }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node || !trigger || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), width = node.width = innerWidth * dpr, height = node.height = innerHeight * dpr;
    node.style.width = `${innerWidth}px`; node.style.height = `${innerHeight}px`; ctx.scale(dpr, dpr);
    const particles: Particle[] = Array.from({ length: 54 }, () => ({ x: innerWidth / 2, y: innerHeight * .45, vx: (Math.random() - .5) * 10, vy: -Math.random() * 9 - 2, size: Math.random() * 5 + 2, hue: 36 + Math.random() * 24, spin: (Math.random() - .5) * .2, angle: Math.random() * Math.PI }));
    let frame = 0, id = 0;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += .22; p.angle += p.spin; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.globalAlpha = Math.max(0, 1 - frame / 72); ctx.fillStyle = `hsl(${p.hue} 88% 65%)`; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.8); ctx.restore(); });
      frame++; if (frame < 74) id = requestAnimationFrame(draw); else ctx.clearRect(0, 0, width, height);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [trigger]);
  return <canvas ref={canvas} className="cg-win-particles" aria-hidden="true" />;
}
