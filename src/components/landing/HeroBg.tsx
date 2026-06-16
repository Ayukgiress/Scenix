import { useEffect, useRef } from "react"

interface Orb {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  hue: number
  alpha: number
  pulse: number
  pulseSpeed: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  hue: number
  size: number
}

export function HeroBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf: number
    const orbs: Orb[] = []
    const particles: Particle[] = []

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // seed orbs
    const orbHues = [285, 220, 190, 300, 260]
    for (let i = 0; i < 5; i++) {
      orbs.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 180 + Math.random() * 160,
        hue: orbHues[i],
        alpha: 0.07 + Math.random() * 0.06,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.004 + Math.random() * 0.006,
      })
    }

    const spawnParticle = () => {
      const edge = Math.floor(Math.random() * 4)
      let x = 0, y = 0
      if (edge === 0) { x = Math.random() * canvas.width; y = 0 }
      else if (edge === 1) { x = canvas.width; y = Math.random() * canvas.height }
      else if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height }
      else { x = 0; y = Math.random() * canvas.height }
      const cx = canvas.width / 2, cy = canvas.height / 2
      const angle = Math.atan2(cy - y, cx - x) + (Math.random() - 0.5) * 1.2
      const speed = 0.4 + Math.random() * 0.8
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 120 + Math.random() * 180,
        hue: [285, 220, 190, 260][Math.floor(Math.random() * 4)],
        size: 1 + Math.random() * 1.5,
      })
    }

    let frame = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      frame++

      ctx.fillStyle = "rgba(0,0,0,0)"
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // draw orbs
      for (const orb of orbs) {
        orb.pulse += orb.pulseSpeed
        orb.x += orb.vx
        orb.y += orb.vy
        if (orb.x < -orb.r) orb.x = canvas.width + orb.r
        if (orb.x > canvas.width + orb.r) orb.x = -orb.r
        if (orb.y < -orb.r) orb.y = canvas.height + orb.r
        if (orb.y > canvas.height + orb.r) orb.y = -orb.r

        const pulsedR = orb.r + Math.sin(orb.pulse) * 30
        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, pulsedR)
        grad.addColorStop(0, `oklch(0.72 0.18 ${orb.hue} / ${orb.alpha * 1.6})`)
        grad.addColorStop(0.5, `oklch(0.62 0.14 ${orb.hue} / ${orb.alpha * 0.8})`)
        grad.addColorStop(1, `oklch(0.5 0.1 ${orb.hue} / 0)`)
        ctx.beginPath()
        ctx.arc(orb.x, orb.y, pulsedR, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      }

      // spawn & draw particles
      if (frame % 4 === 0 && particles.length < 80) spawnParticle()
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.life++
        if (p.life > p.maxLife) { particles.splice(i, 1); continue }
        const t = p.life / p.maxLife
        const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2)
        ctx.fillStyle = `oklch(0.82 0.16 ${p.hue} / ${alpha * 0.55})`
        ctx.fill()
      }

      // grid lines — subtle perspective-ish horizontal lines
      ctx.save()
      ctx.strokeStyle = "oklch(1 0 0 / 0.028)"
      ctx.lineWidth = 1
      const gridSpacing = 48
      for (let y = 0; y < canvas.height; y += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
      }
      for (let x = 0; x < canvas.width; x += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
      }
      ctx.restore()
    }

    draw()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
