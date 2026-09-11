'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  tiltAngle: number;
  tiltSpeed: number;
  color: string;
  glowColor: string;
  type: 'firefly' | 'petal' | 'stardust';
  pulsePhase: number;
  pulseSpeed: number;
  alpha: number;
}

export default function Enchanted3DCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Mouse parallax and magic trail
    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = width / 2;
    let targetMouseY = height / 2;

    const mouseTrail: { x: number; y: number; life: number }[] = [];

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
      mouseTrail.push({ x: e.clientX, y: e.clientY, life: 1.0 });
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Color palette for Secret Garden
    const palette = [
      { base: '#AFF8DB', glow: 'rgba(175, 248, 219, 0.45)' },
      { base: '#FFF3B0', glow: 'rgba(255, 243, 176, 0.5)' },
      { base: '#FFB5E8', glow: 'rgba(255, 181, 232, 0.4)' },
      { base: '#E7C6FF', glow: 'rgba(231, 198, 255, 0.35)' },
    ];

    const totalParticles = 40;

    const particles: Particle[] = Array.from({ length: totalParticles }).map(() => {
      const rand = Math.random();
      const type: 'firefly' | 'petal' | 'stardust' =
        rand < 0.45 ? 'firefly' : rand < 0.8 ? 'petal' : 'stardust';
      const col = palette[Math.floor(Math.random() * palette.length)];

      return {
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 400 + 100,
        vx: (Math.random() - 0.5) * 0.4,
        vy: type === 'petal' ? Math.random() * 0.4 + 0.25 : (Math.random() - 0.5) * 0.35,
        size: type === 'petal' ? Math.random() * 4.5 + 3.5 : type === 'firefly' ? Math.random() * 2.5 + 1.8 : Math.random() * 1.5 + 0.8,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        tiltAngle: Math.random() * Math.PI,
        tiltSpeed: Math.random() * 0.02 + 0.008,
        color: col.base,
        glowColor: col.glow,
        type,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.03 + 0.015,
        alpha: Math.random() * 0.4 + 0.4,
      };
    });

    let time = 0;

    const render = () => {
      time += 0.015;

      mouseX += (targetMouseX - mouseX) * 0.035;
      mouseY += (targetMouseY - mouseY) * 0.035;
      const offsetX = (mouseX - width / 2) * 0.04;
      const offsetY = (mouseY - height / 2) * 0.04;

      ctx.clearRect(0, 0, width, height);

      const fov = 400;

      particles.forEach((p) => {
        p.pulsePhase += p.pulseSpeed;
        p.rotation += p.rotationSpeed;
        p.tiltAngle += p.tiltSpeed;

        // Movement with natural wind wave
        p.x += p.vx + Math.sin(time + p.pulsePhase) * 0.5;
        p.y += p.vy;

        // Wrap boundaries
        if (p.y > height + 30) {
          p.y = -30;
          p.x = Math.random() * width;
        }
        if (p.y < -30) {
          p.y = height + 30;
          p.x = Math.random() * width;
        }
        if (p.x > width + 30) p.x = -30;
        if (p.x < -30) p.x = width + 30;

        const scale = fov / (fov + p.z);
        const px = (p.x - offsetX * 0.4) * scale + (width / 2) * (1 - scale);
        const py = (p.y - offsetY * 0.4) * scale + (height / 2) * (1 - scale);
        const currentSize = p.size * scale;
        const pulse = (Math.sin(p.pulsePhase) + 1) * 0.5; // 0 to 1

        ctx.save();
        ctx.translate(px, py);

        if (p.type === 'firefly') {
          // Bioluminescent Firefly with soft radial aura
          const auraRadius = currentSize * (3.5 + pulse * 2.5);
          const currentAlpha = p.alpha * (0.6 + pulse * 0.4);

          const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, auraRadius);
          glowGrad.addColorStop(0, p.glowColor);
          glowGrad.addColorStop(0.5, p.glowColor.replace('0.45', '0.15').replace('0.5', '0.18').replace('0.4', '0.12').replace('0.35', '0.1'));
          glowGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
          ctx.fill();

          // Bright white-gold core
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = currentAlpha;
          ctx.beginPath();
          ctx.arc(0, 0, currentSize * 0.75, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'petal') {
          // Floating curved botanical petal
          const currentTilt = Math.sin(p.tiltAngle);
          ctx.rotate(p.rotation);
          ctx.scale(1, Math.max(0.2, Math.abs(currentTilt)));
          ctx.globalAlpha = p.alpha * 0.65;

          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, -currentSize);
          ctx.bezierCurveTo(
            currentSize * 0.7,
            -currentSize * 0.4,
            currentSize * 0.7,
            currentSize * 0.4,
            0,
            currentSize
          );
          ctx.bezierCurveTo(
            -currentSize * 0.7,
            currentSize * 0.4,
            -currentSize * 0.7,
            -currentSize * 0.4,
            0,
            -currentSize
          );
          ctx.fill();
        } else {
          // Stardust spore
          ctx.globalAlpha = p.alpha * (0.4 + pulse * 0.6);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // Render subtle magical fairy stardust trail on cursor movement
      for (let i = mouseTrail.length - 1; i >= 0; i--) {
        const t = mouseTrail[i];
        t.life -= 0.035;
        if (t.life <= 0) {
          mouseTrail.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = t.life * 0.45;
        ctx.fillStyle = '#AFF8DB';
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.life * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFF3B0';
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.life * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-30 w-full h-full"
      style={{ mixBlendMode: 'screen' }}
      aria-hidden="true"
    />
  );
}
