/**
 * Mohalla demo video - Remotion composition.
 * Raw screen clips come from record.mjs (Playwright) -> encode.py -> public/clips/*.mp4,
 * their lengths from src/clips.json. Everything else (title card, chapter wipes, lower-thirds,
 * phone frame, closing card) is drawn here in the app's retro flat style.
 *   npm run studio   -> preview / tweak in Remotion Studio
 *   npm run render   -> ../../Mohalla_Demo.mp4
 */
import React from 'react';
import {
  AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';
import { loadFont as loadUnbounded } from '@remotion/google-fonts/Unbounded';
import { loadFont as loadDMSans } from '@remotion/google-fonts/DMSans';
import clips from './clips.json';

const { fontFamily: DISPLAY } = loadUnbounded('normal', { weights: ['700', '900'], subsets: ['latin'] });
const { fontFamily: BODY } = loadDMSans('normal', { weights: ['500', '700', '800'], subsets: ['latin'] });

export const FPS = 30;
const C = {
  yellow: '#FFC567', pink: '#FB7DA8', red: '#FD5A46', purple: '#552CB7', green: '#00995E', blue: '#058CD7',
  ink: '#111111', cream: '#FFF6E5', white: '#FFFFFF',
};

// ---- scene list (order of the video) ----
export const SCENES = [
  { clip: '01_home', n: 1, title: 'Your mohalla at a glance', sub: 'Real nearby places, loaded live from OpenStreetMap', color: C.yellow },
  { clip: '02_smartask', n: 2, title: 'Smart Ask', sub: 'Type a problem in plain words, get the right pros', color: C.pink },
  { clip: '03_results', trimEnd: 1.6, n: 3, title: 'Filters & trust badges', sub: 'Top Rated, Verified, Trending, Show Number', color: C.blue },
  { clip: '04_detail', n: 4, title: 'Business page', sub: 'Photos, timings, map, reviews, Call / WhatsApp / Enquiry', color: C.green },
  { clip: '05_college', n: 5, title: 'Real places, even my college', sub: 'FSB Degree College, Kukatpally, Hyderabad', color: C.purple },
  { clip: '06_privacy', n: 6, title: 'Privacy Mode', sub: 'Send an enquiry without sharing your number', color: C.red },
  { clip: '07_owner', n: 7, title: 'Owner dashboard', sub: 'Live status + in-app chat, customer number stays masked', color: C.yellow },
  { clip: '08_admin', n: 8, title: 'Admin panel', sub: 'Stats, approve & verify listings, manage users', color: C.blue },
  { clip: '09_emergency', n: 9, title: 'Emergency mode', sub: 'Nearest hospitals, pharmacies and ATMs in one tap', color: C.red },
  { clip: '10_mobile', n: 10, title: 'Mobile app', sub: 'The same app ships as an Android APK', color: C.green, mobile: true },
];

const TITLE = 135; // 4.5 s
const CLOSE = 165; // 5.5 s
const WIPE = 26; // chapter panel frames before the clip is fully revealed
const OVERLAP = 10; // panel slides in over the previous clip's last frames

export function timeline() {
  let t = TITLE - OVERLAP;
  const items = SCENES.map((s) => {
    const clipFrames = Math.round(((clips[s.clip] || 5) - (s.trimEnd || 0)) * FPS);
    const item = { ...s, from: t, clipFrames, dur: clipFrames + OVERLAP };
    t += item.dur - OVERLAP;
    return item;
  });
  return { items, closeFrom: t, total: t + CLOSE };
}

const inkText = (c) => (c === C.yellow || c === C.pink ? C.ink : C.white);

// subtle grid like the app hero background
const Grid = ({ color = C.yellow, line = 'rgba(17,17,17,0.07)' }) => (
  <AbsoluteFill style={{
    backgroundColor: color,
    backgroundImage: `linear-gradient(${line} 2px, transparent 2px), linear-gradient(90deg, ${line} 2px, transparent 2px)`,
    backgroundSize: '48px 48px',
  }} />
);

const Sparkle = ({ x, y, size = 80, delay = 0 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 12 } });
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', left: x, top: y, transform: `scale(${s}) rotate(${f * 0.6}deg)` }}>
      <path d="M12 1 C13 8 16 11 23 12 C16 13 13 16 12 23 C11 16 8 13 1 12 C8 11 11 8 12 1Z" fill={C.white} stroke={C.ink} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
};

const Box = ({ children, bg = C.white, style }) => (
  <div style={{ background: bg, border: `5px solid ${C.ink}`, borderRadius: 22, boxShadow: `10px 10px 0 ${C.ink}`, ...style }}>{children}</div>
);

// ---------------- title card ----------------
const TitleCard = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: f - 4, fps, config: { damping: 9, mass: 0.9 } });
  const word = spring({ frame: f - 14, fps, config: { damping: 14 } });
  const tag = spring({ frame: f - 30, fps, config: { damping: 14 } });
  const sub = spring({ frame: f - 46, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill>
      <Grid color={C.yellow} />
      <Sparkle x={150} y={140} size={110} delay={20} />
      <Sparkle x={1640} y={760} size={130} delay={28} />
      <Sparkle x={1580} y={170} size={60} delay={36} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <Img src={staticFile('logo.svg')} style={{ width: 210, height: 210, transform: `scale(${logo}) rotate(${(1 - logo) * -40}deg)` }} />
          <div style={{
            fontFamily: DISPLAY, fontWeight: 900, fontSize: 190, color: C.ink, letterSpacing: -6,
            opacity: word, transform: `translateX(${(1 - word) * 80}px)`,
          }}>
            Mohalla<span style={{ color: C.red }}>.</span>
          </div>
        </div>
        <Box style={{ marginTop: 40, padding: '22px 46px', transform: `translateY(${(1 - tag) * 60}px)`, opacity: tag }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 56, color: C.ink }}>Your neighbourhood, one tap away</div>
        </Box>
        <div style={{
          marginTop: 44, fontFamily: BODY, fontWeight: 800, fontSize: 40, color: C.white, background: C.purple,
          border: `4px solid ${C.ink}`, borderRadius: 999, padding: '12px 36px', boxShadow: `6px 6px 0 ${C.ink}`,
          opacity: sub, transform: `scale(${0.8 + 0.2 * sub})`,
        }}>
          A local business discovery app — college project
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------- chapter wipe panel ----------------
const ChapterPanel = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // slide in from right (0..OVERLAP), hold, slide out to the left (WIPE-12..WIPE+4)
  const inX = interpolate(f, [0, OVERLAP], [1920, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const outX = interpolate(f, [WIPE - 10, WIPE + 6], [0, -1960], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
  const pop = spring({ frame: f - 4, fps, config: { damping: 12 } });
  if (f > WIPE + 6) return null;
  const ink = inkText(scene.color);
  return (
    <AbsoluteFill style={{ transform: `translateX(${inX + outX}px)` }}>
      <AbsoluteFill style={{ background: scene.color, borderLeft: `10px solid ${C.ink}`, borderRight: `10px solid ${C.ink}` }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 26 }}>
        <div style={{
          fontFamily: DISPLAY, fontWeight: 900, fontSize: 64, color: C.ink, background: C.white, width: 130, height: 130,
          borderRadius: 999, border: `6px solid ${C.ink}`, boxShadow: `8px 8px 0 ${C.ink}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${pop})`,
        }}>{scene.n}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 96, color: ink, letterSpacing: -2, textAlign: 'center' }}>{scene.title}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------- lower third ----------------
const LowerThird = ({ scene, mobile }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const HOLD = 150;
  const enter = spring({ frame: f, fps, config: { damping: 15 } });
  const exit = interpolate(f, [HOLD, HOLD + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
  if (f > HOLD + 16) return null;
  const x = (1 - enter) * -900 + exit * -1100;
  return (
    <div style={{ position: 'absolute', left: 48, ...(mobile ? { top: 56 } : { bottom: 48 }), transform: `translateX(${x}px)`, display: 'flex', alignItems: 'stretch' }}>
      <div style={{
        background: scene.color, color: inkText(scene.color), fontFamily: DISPLAY, fontWeight: 900, fontSize: 46,
        border: `5px solid ${C.ink}`, borderRight: 'none', borderRadius: '20px 0 0 20px', padding: '0 26px',
        display: 'flex', alignItems: 'center',
      }}>{scene.n}</div>
      <div style={{
        background: C.white, border: `5px solid ${C.ink}`, borderRadius: '0 20px 20px 0', boxShadow: `10px 10px 0 ${C.ink}`,
        padding: '16px 30px 18px',
      }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 46, color: C.ink, lineHeight: 1.15 }}>{scene.title}</div>
        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 34, color: '#333', marginTop: 4 }}>{scene.sub}</div>
      </div>
    </div>
  );
};

// ---------------- mobile segment: phone frame on brand background ----------------
const PhoneScene = ({ scene, clipFrames }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame: f, fps, config: { damping: 16 } });
  const H = 930, W = Math.round(H * 780 / 1688);
  const points = ['Built with Capacitor', 'Bottom tab bar', 'Location-aware search', 'Same server & data'];
  const colors = [C.pink, C.blue, C.green, C.purple];
  return (
    <AbsoluteFill>
      <Grid color={C.yellow} />
      <Sparkle x={1640} y={110} size={90} delay={10} />
      <Sparkle x={140} y={820} size={70} delay={18} />
      <div style={{ position: 'absolute', left: 130, top: 250, width: 560 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 84, color: C.ink, lineHeight: 1.05, letterSpacing: -2 }}>
          Same app,<br />in your <span style={{ color: C.red }}>pocket</span>
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 36, color: C.ink, marginTop: 24 }}>
          Ships as an Android APK — Mohalla.apk
        </div>
      </div>
      <div style={{ position: 'absolute', right: 120, top: 300, display: 'flex', flexDirection: 'column', gap: 30, alignItems: 'flex-start' }}>
        {points.map((p, i) => {
          const s = spring({ frame: f - 20 - i * 10, fps, config: { damping: 14 } });
          return (
            <div key={p} style={{
              fontFamily: BODY, fontWeight: 800, fontSize: 38, background: colors[i], color: inkText(colors[i]),
              border: `4px solid ${C.ink}`, borderRadius: 999, padding: '12px 32px', boxShadow: `6px 6px 0 ${C.ink}`,
              transform: `translateX(${(1 - s) * 500}px)`, opacity: s,
            }}>{p}</div>
          );
        })}
      </div>
      <div style={{
        position: 'absolute', left: (1920 - W) / 2 - 16, top: (1080 - H) / 2 - 16 + (1 - rise) * 400,
        width: W + 32, height: H + 32, background: C.ink, borderRadius: 64, boxShadow: `18px 18px 0 rgba(17,17,17,0.9)`,
        padding: 16,
      }}>
        <div style={{ width: W, height: H, borderRadius: 50, overflow: 'hidden', background: C.white, position: 'relative' }}>
          <OffthreadVideo src={staticFile(`clips/${scene.clip}.mp4`)} muted style={{ width: W, height: H }} />
        </div>
        <div style={{ position: 'absolute', top: 26, left: '50%', marginLeft: -18, width: 36, height: 12, borderRadius: 8, background: C.ink, opacity: 0.85 }} />
      </div>
    </AbsoluteFill>
  );
};

// ---------------- closing card ----------------
const ClosingCard = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(f, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const head = spring({ frame: f - 4, fps, config: { damping: 12 } });
  const stack = [
    ['React + Vite', C.blue], ['Node.js + Express', C.green], ['SQLite', C.purple],
    ['OpenStreetMap', C.pink], ['Capacitor Android', C.red],
  ];
  const thanks = spring({ frame: f - 60, fps, config: { damping: 10 } });
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Grid color={C.cream} line="rgba(17,17,17,0.06)" />
      <Sparkle x={170} y={150} size={90} delay={50} />
      <Sparkle x={1650} y={820} size={110} delay={56} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, transform: `scale(${head})` }}>
          <Img src={staticFile('logo.svg')} style={{ width: 110, height: 110 }} />
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 96, color: C.ink, letterSpacing: -3 }}>
            Mohalla<span style={{ color: C.red }}>.</span>
          </div>
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 40, color: C.ink, marginTop: 34, marginBottom: 26 }}>Built with</div>
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1600 }}>
          {stack.map(([label, color], i) => {
            const s = spring({ frame: f - 14 - i * 6, fps, config: { damping: 12 } });
            return (
              <div key={label} style={{
                fontFamily: DISPLAY, fontWeight: 700, fontSize: 40, background: color, color: inkText(color),
                border: `5px solid ${C.ink}`, borderRadius: 18, padding: '16px 30px', boxShadow: `8px 8px 0 ${C.ink}`,
                transform: `translateY(${(1 - s) * 80}px)`, opacity: s,
              }}>{label}</div>
            );
          })}
        </div>
        <Box bg={C.yellow} style={{ marginTop: 70, padding: '18px 60px', transform: `scale(${thanks}) rotate(${(1 - thanks) * 8 - 2}deg)` }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 92, color: C.ink }}>Thank you!</div>
        </Box>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------- one feature scene ----------------
const FeatureScene = ({ scene }) => {
  return (
    <AbsoluteFill>
      <Sequence from={OVERLAP} layout="none">
        {scene.mobile
          ? <PhoneScene scene={scene} clipFrames={scene.clipFrames} />
          : (
            <AbsoluteFill style={{ background: C.cream }}>
              <OffthreadVideo src={staticFile(`clips/${scene.clip}.mp4`)} muted style={{ width: 1920, height: 1080 }} />
            </AbsoluteFill>
          )}
      </Sequence>
      {/* the phone scene has its own headline, so no lower-third over the phone */}
      {!scene.mobile && (
        <Sequence from={WIPE + 4} layout="none">
          <LowerThird scene={scene} />
        </Sequence>
      )}
      <ChapterPanel scene={scene} />
    </AbsoluteFill>
  );
};

export const Demo = () => {
  const { items, closeFrom } = timeline();
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <Sequence from={0} durationInFrames={TITLE}><TitleCard /></Sequence>
      {items.map((s) => (
        <Sequence key={s.clip} from={s.from} durationInFrames={s.dur}>
          <FeatureScene scene={s} />
        </Sequence>
      ))}
      <Sequence from={closeFrom}><ClosingCard /></Sequence>
    </AbsoluteFill>
  );
};
