import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BRAND } from "../brand";

// Procedural recreation of the "abstract motion graphics" look from the
// Envato packs the user downloaded (dynamic-abstract-motion-graphics-
// elements-pack, dynamic-circular-punch-hole-transitions-pack): those are
// After Effects (.aep) / Final Cut Pro (.motr) project files, and the only
// rendered output bundled with them is a tiny preview -- 340x192 / 480x270
// -- unusable upscaled to a 1080p+ frame (checked directly: still that
// resolution, no larger render exists in the pack). Rather than skip the
// "energetic explainer" motion-graphics feel entirely, this rebuilds it
// from scratch in CSS: soft drifting glow blobs + a slow-rotating radar
// ring, on-brand teal/amber, resolution-independent like WipeReveal in
// Video.tsx already is for the punch-hole transition.
const Blob: React.FC<{
  color: string;
  size: number;
  baseX: number;
  baseY: number;
  driftX: number;
  driftY: number;
  periodFrames: number;
  phase: number;
}> = ({ color, size, baseX, baseY, driftX, driftY, periodFrames, phase }) => {
  const frame = useCurrentFrame();
  const angle = ((frame + phase) / periodFrames) * Math.PI * 2;
  const x = baseX + Math.sin(angle) * driftX;
  const y = baseY + Math.cos(angle * 0.8) * driftY;
  const pulse = 1 + Math.sin(angle * 1.3) * 0.08;
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        transform: `translate(-50%, -50%) scale(${pulse})`,
        filter: "blur(40px)",
        mixBlendMode: "screen",
      }}
    />
  );
};

// Slow-rotating conic gradient, two thin bright arcs opposite each other --
// reads as a radar sweep / light-ray accent behind big centered typography
// (echoes the radiating-light-rays-off-a-coin shot in the Raymond Chin
// reference) without competing with the text on top of it.
const RadarRing: React.FC = () => {
  const frame = useCurrentFrame();
  const rotation = (frame / 240) * 360;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "46%",
        width: "130vmax",
        height: "130vmax",
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        borderRadius: "50%",
        background: `conic-gradient(from 0deg, transparent 0deg, ${BRAND.colors.amber}26 10deg, transparent 24deg, transparent 180deg, ${BRAND.colors.teal}20 190deg, transparent 208deg)`,
        mixBlendMode: "screen",
      }}
    />
  );
};

// Used behind statement/stat/title beats (b-roll already dimmed there, or
// no b-roll at all for title cards) -- adds ambient motion without ever
// appearing over a normal caption beat, where it would fight the b-roll.
export const MotionAccents: React.FC = () => {
  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      <RadarRing />
      <Blob color={`${BRAND.colors.amber}55`} size={520} baseX={80} baseY={20} driftX={6} driftY={5} periodFrames={220} phase={0} />
      <Blob color={`${BRAND.colors.teal}66`} size={620} baseX={14} baseY={80} driftX={7} driftY={6} periodFrames={260} phase={60} />
      <Blob color={`${BRAND.colors.amber}33`} size={360} baseX={50} baseY={48} driftX={10} driftY={8} periodFrames={300} phase={140} />
    </AbsoluteFill>
  );
};
