let audioCtx: AudioContext | null = null

export function useSwooshSound() {
  function play() {
    try {
      if (!audioCtx) audioCtx = new AudioContext()
      const ctx = audioCtx
      const duration = 0.18
      const sampleRate = ctx.sampleRate
      const length = Math.floor(sampleRate * duration)
      const buffer = ctx.createBuffer(1, length, sampleRate)
      const data = buffer.getChannelData(0)

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate
        const envelope = Math.max(0, 1 - t / duration)
        data[i] = (Math.random() * 2 - 1) * envelope
      }

      const source = ctx.createBufferSource()
      source.buffer = buffer

      const bandpass = ctx.createBiquadFilter()
      bandpass.type = 'bandpass'
      bandpass.frequency.value = 2500
      bandpass.Q.value = 1.2
      bandpass.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + duration)
      bandpass.Q.linearRampToValueAtTime(0.6, ctx.currentTime + duration)

      const gain = ctx.createGain()
      gain.gain.value = 0.25
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

      source.connect(bandpass)
      bandpass.connect(gain)
      gain.connect(ctx.destination)
      source.start()
    } catch { /* Audio not available */ }
  }

  return { play }
}
