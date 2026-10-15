/** Original compact, deterministic impact synthesis. No downloaded samples/music. */
export type ImpactKind = 'hit' | 'break' | 'explosion';
export function synthesizeImpact(kind: ImpactKind, sampleRate: number): Float32Array {
  const duration = kind === 'explosion' ? .72 : kind === 'break' ? .34 : .12;
  const data = new Float32Array(Math.ceil(duration * sampleRate));
  let seed = 2317, low = 0, mid = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    low += (noise - low) * (1 - Math.exp(-2 * Math.PI * 240 / sampleRate));
    mid += (noise - mid) * (1 - Math.exp(-2 * Math.PI * 2400 / sampleRate));
    let value: number;
    if (kind === 'hit') {
      // Dry pickaxe contact, short mineral resonance and a small grit tail.
      value = .55 * (noise - mid) * Math.exp(-t * 145)
        + .38 * mid * Math.exp(-t * 45)
        + .32 * Math.sin(2 * Math.PI * 1430 * t) * Math.exp(-t * 80)
        + .23 * Math.sin(2 * Math.PI * 617 * t) * Math.exp(-t * 55);
    } else if (kind === 'break') {
      value = .58 * mid * Math.exp(-t * 30) + .27 * low * Math.exp(-t * 13);
      // Irregular little fragment collisions, rather than a sustained hiss.
      for (const [at, f, a] of [[.021, 820, .26], [.056, 1130, .20], [.104, 570, .16], [.173, 910, .1]]) {
        const u = t - at;
        if (u >= 0) value += a * (Math.sin(2 * Math.PI * f * u) + mid) * Math.exp(-u * 70);
      }
    } else {
      const phase = 2 * Math.PI * (54 * t + 70 * .055 * (1 - Math.exp(-t / .055)));
      // Bass supplies weight, while the dry midrange blast survives phone speakers.
      value = .42 * Math.sin(phase) * Math.exp(-t * 10)
        + .8 * low * Math.exp(-t * 7)
        + 2.6 * (mid - low) * Math.exp(-t * 15)
        + .45 * Math.sin(2 * Math.PI * (340 * t - 350 * t * t)) * Math.exp(-t * 24)
        + .32 * (noise - mid) * Math.exp(-t * 65);
      for (const at of [.073, .127, .219, .337]) {
        const u = t - at;
        if (u >= 0) value += .19 * mid * Math.exp(-u * 45);
      }
    }
    const fade = Math.min(1, t / .0015, (duration - t) / .012);
    data[i] = Math.tanh(value * 1.5) * Math.max(0, fade) * .86;
  }
  return data;
}
