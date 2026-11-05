/** Optional, tiny WebAudio blips. Off by default; the AudioContext is created lazily on a user gesture. */
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, peak: number) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(gain).connect(ac.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

export function playBlip(kind: 'right' | 'wrong' | 'streak') {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + 0.01
  if (kind === 'wrong') {
    tone(ac, 330, t, 0.16, 'triangle', 0.08)
    tone(ac, 247, t + 0.12, 0.22, 'triangle', 0.07)
  } else {
    tone(ac, 784, t, 0.12, 'sine', 0.09) // G5
    tone(ac, 1047, t + 0.08, 0.18, 'sine', 0.09) // C6
    if (kind === 'streak') tone(ac, 1319, t + 0.17, 0.24, 'sine', 0.08) // E6
  }
}
