'use client';

import { useEffect, useRef, useCallback } from 'react';

interface TrailParticle {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  rotation: number;
}

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export default function OwlCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: -100, y: -100, isHovering: false });
  const owlRef = useRef({ x: -100, y: -100, rotation: 0, vx: 0, vy: 0 });
  
  // Trail of owl shapes
  const trailRef = useRef<TrailParticle[]>([]);
  // Floating neon sparkles
  const sparklesRef = useRef<SparkleParticle[]>([]);
  
  const animFrameRef = useRef<number>(0);
  const owlImgRef = useRef<HTMLImageElement | null>(null);

  const drawOwl = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    opacity: number,
    rotation: number
  ) => {
    if (!owlImgRef.current || !owlImgRef.current.complete) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = opacity;
    ctx.drawImage(owlImgRef.current, -size / 2, -size / 2, size, size);
    ctx.restore();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Load owl image
    const img = new Image();
    img.src = '/darknote.png';
    img.onload = () => {
      owlImgRef.current = img;
    };

    const ctx = canvas.getContext('2d')!;
    let lastTime = performance.now();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let lastHoverCheck = 0;
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;

      // move the pointer dot right now, straight off the mouse event. it's a GPU
      // transform so it never waits on a canvas frame, which is what kills the
      // laggy feeling.
      const dot = dotRef.current;
      if (dot) dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;

      // the closest() walk is a bit pricey to run on every single move, so only
      // re-check the hover state ~10x a second.
      if (e.timeStamp - lastHoverCheck > 100) {
        lastHoverCheck = e.timeStamp;
        const target = e.target as HTMLElement | null;
        const isClickable = !!target?.closest(
          'a, button, input, textarea, select, [role="button"], .wallet-adapter-button, [onclick]'
        );
        mouseRef.current.isHovering = isClickable;
        if (dot) dot.classList.toggle('owl-dot-hover', isClickable);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);

    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const owl = owlRef.current;
      const mouse = mouseRef.current;

      // Initialize owl position if it's offscreen
      if (owl.x === -100 && mouse.x !== -100) {
        owl.x = mouse.x;
        owl.y = mouse.y;
      }

      // Spring physics for owl following cursor
      const dx = mouse.x - owl.x;
      const dy = mouse.y - owl.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Spring physics for owl following cursor, tightened for snappier feel
      const stiffness = 24;
      const damping = 3.5;

      const ax = dx * stiffness - owl.vx * damping;
      const ay = dy * stiffness - owl.vy * damping;

      owl.vx += ax * dt;
      owl.vy += ay * dt;
      owl.x += owl.vx * dt;
      owl.y += owl.vy * dt;

      // Rotation based on movement direction and speed
      const targetRotation = Math.atan2(owl.vy, owl.vx + 0.001) * 0.15;
      owl.rotation += (targetRotation - owl.rotation) * 0.1;

      // Add trail particles only when actually moving fast
      if (dist > 4) {
        trailRef.current.push({
          x: owl.x,
          y: owl.y,
          opacity: 0.35,
          scale: 0.8,
          rotation: owl.rotation,
        });

        // Fewer sparkles, only on fast movement
        if (Math.random() < 0.15) {
          const speed = Math.sqrt(owl.vx * owl.vx + owl.vy * owl.vy);
          const angle = Math.atan2(owl.vy, owl.vx) + Math.PI + (Math.random() - 0.5) * 0.5;
          const sparkleSpeed = (speed * 0.08) + Math.random() * 20;
          
          sparklesRef.current.push({
            x: owl.x + (Math.random() - 0.5) * 10,
            y: owl.y + (Math.random() - 0.5) * 10,
            vx: Math.cos(angle) * sparkleSpeed,
            vy: Math.sin(angle) * sparkleSpeed - (10 + Math.random() * 20), // drift upwards slightly
            size: 1.5 + Math.random() * 2.5,
            color: Math.random() > 0.3 ? 'rgba(168, 130, 255, 0.8)' : 'rgba(216, 180, 254, 0.9)', // purple / lavender neon
            alpha: 1.0,
            life: 0,
            maxLife: 0.4 + Math.random() * 0.5,
          });
        }
      }

      // Limit owl trail length
      if (trailRef.current.length > 4) {
        trailRef.current.shift();
      }

      // Draw owl trail echoes
      for (let i = 0; i < trailRef.current.length; i++) {
        const p = trailRef.current[i];
        const age = i / trailRef.current.length; // 0 (oldest) to 1 (newest)
        p.opacity *= 0.92;
        p.scale *= 0.94;

        if (p.opacity > 0.02) {
          const trailSize = 24 * p.scale * (0.4 + age * 0.6);
          drawOwl(ctx, p.x, p.y, trailSize, p.opacity * 0.35, p.rotation);
        }
      }
      trailRef.current = trailRef.current.filter(p => p.opacity > 0.02);

      // Update and draw sparkles
      for (let i = 0; i < sparklesRef.current.length; i++) {
        const s = sparklesRef.current[i];
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.alpha = Math.max(0, 1 - s.life / s.maxLife);

        if (s.alpha > 0) {
          ctx.save();
          ctx.fillStyle = s.color;
          // cheap glow: a bigger, fainter circle behind the sparkle. way lighter
          // than ctx.shadowBlur, which was tanking the frame rate.
          ctx.globalAlpha = s.alpha * 0.22;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = s.alpha;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      sparklesRef.current = sparklesRef.current.filter(s => s.life < s.maxLife);

      // Draw main owl
      const owlSize = 32;
      // Draw offset from cursor
      const owlOffsetX = 12;
      const owlOffsetY = 12;
      drawOwl(ctx, owl.x + owlOffsetX, owl.y + owlOffsetY, owlSize, 0.95, owl.rotation);

      // the pointer dot itself is a DOM element moved in handleMouseMove, so we
      // don't draw it on the canvas anymore.

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawOwl]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      />
      <div ref={dotRef} className="owl-dot" aria-hidden="true" />
    </>
  );
}
