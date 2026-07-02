import { AbsoluteFill, Img } from "remotion";
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadMono } from "@remotion/google-fonts/SpaceMono";
import { BRAND } from "./brand";
import { resolveSrc } from "./resolveSrc";

const { fontFamily: jakarta } = loadJakarta();
const { fontFamily: mono } = loadMono();

export type ThumbnailProps = {
  headline: string;
  karyaFrame: string | null;
  width: number;
  height: number;
};

export const Thumbnail: React.FC<ThumbnailProps> = ({ headline, karyaFrame }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.colors.tealDeep }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 28% 22%, ${BRAND.colors.teal} 0%, ${BRAND.colors.tealDeep} 68%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "6%",
          left: "6%",
          fontFamily: mono,
          fontSize: "2.4vw",
          letterSpacing: 2,
          color: BRAND.colors.amber,
          textTransform: "uppercase",
        }}
      >
        Pustaka Sukses · Karyawan AI
      </div>
      <div
        style={{
          position: "absolute",
          left: "7%",
          right: "7%",
          top: "20%",
          fontFamily: jakarta,
          fontWeight: 800,
          fontSize: "10.5vw",
          lineHeight: 1.05,
          color: BRAND.colors.cream,
          textShadow: `0 4px 0 ${BRAND.colors.ink}`,
        }}
      >
        {headline}
      </div>
      {karyaFrame ? (
        <div style={{ position: "absolute", bottom: "3%", right: "3%", width: "50%" }}>
          <Img src={resolveSrc(karyaFrame)} style={{ width: "100%" }} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
