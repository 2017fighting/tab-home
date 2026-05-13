export function useConfetti() {
  function shoot(x: number, y: number) {
    const colors = ['#c8713a', '#5a7a62', '#5a6b7a', '#b35a5a', '#e8c85a', '#6b8cce']
    const count = 24

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div')
      particle.style.cssText = `
        position: fixed; left: ${x}px; top: ${y}px;
        width: 8px; height: 8px; border-radius: 2px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        pointer-events: none; z-index: 99999;
        transition: transform 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.9s ease-out;
      `
      document.body.appendChild(particle)

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4
      const distance = 60 + Math.random() * 100
      const dx = Math.cos(angle) * distance
      const dy = Math.sin(angle) * distance - 30

      requestAnimationFrame(() => {
        particle.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360}deg)`
        particle.style.opacity = '0'
      })

      setTimeout(() => particle.remove(), 950)
    }
  }

  return { shoot }
}
