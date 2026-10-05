/**
 * Mohalla launch video (~48 s, with voiceover and music) - Remotion composition "MohallaLaunch".
 * Timing comes from src/launch.json, written by build_audio.py together with public/launch/mix.wav,
 * so every headline and sticker lands on the narrator's words.
 *   python build_audio.py      -> soundtrack + timings
 *   npm run studio             -> preview
 *   npm run render:launch      -> ../../Mohalla_Launch.mp4
 */
import React from 'react';
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';
import { loadFont as loadUnbounded } from '@remotion/google-fonts/Unbounded';
import { loadFont as loadDMSans } from '@remotion/google-fonts/DMSans';
import T from './launch.json';

const { fontFamily: DISPLAY } = loadUnbounded('normal', { weights: ['700', '900'], subsets: ['latin'] });
const { fontFamily: BODY } = loadDMSans('normal', { weights: ['700', '800'], subsets: ['latin'] });

export const LAUNCH_FPS = 30;
const C = {
  yellow: '#FFC567', pink: '#FB7DA8', red: '#FD5A46', purple: '#552CB7', green: '#00995E', blue: '#058CD7',
  ink: '#111111', white: '#FFFFFF',
};
const sec = (s) => Math.round(s * LAUNCH_FPS);
export const launchFrames = () => sec(T.total);

// ---------------------------------------------------------------- building blocks

const Grid = ({ color, line = 'rgba(17,17,17,0.08)' }) => (
  <AbsoluteFill style={{
    backgroundColor: color,
    backgroundImage: `linear-gradient(${line} 2px, transparent 2px), linear-gradient(90deg, ${line} 2px, transparent 2px)`,
    backgroundSize: '60px 60px',
  }} />
);

const usePop = (at, damping = 11) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - at, fps, config: { damping, stiffness: 170 } });
};

// Big headline, word by word
const Headline = ({ lines, at = 0, color = C.ink, size = 92, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  let i = 0;
  return (
    <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: size, lineHeight: 1.08, color, letterSpacing: -1, ...style }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: 'flex', flexWrap: 'wrap', gap: '0 0.28em' }}>
          {(Array.isArray(line) ? line : line.split(' ')).map((w) => {
            const delay = (typeof at === 'number' ? at : at[li]) + (i++) * 3;
            const s = spring({ frame: f - delay, fps, config: { damping: 13, stiffness: 160 } });
            return (
              <span key={w + i} style={{ display: 'inline-block', transform: `translateY(${(1 - s) * 60}px)`, opacity: Math.min(1, s * 1.4) }}>{w}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Sticker / chip that pops in with a little overshoot
const Sticker = ({ children, at, x, y, bg = C.white, color = C.ink, rotate = -4, size = 44, pad = '14px 28px', style }) => {
  const s = usePop(at, 9);
  if (s <= 0.001) return null;
  return (
    <div style={{
      position: 'absolute', left: x, top: y, transform: `scale(${s}) rotate(${rotate * s}deg)`, transformOrigin: 'center',
      background: bg, color, border: `6px solid ${C.ink}`, borderRadius: 999, boxShadow: `10px 10px 0 ${C.ink}`,
      fontFamily: DISPLAY, fontWeight: 900, fontSize: size, padding: pad, whiteSpace: 'nowrap', ...style,
    }}>{children}</div>
  );
};

const Sparkle = ({ x, y, size = 90, at = 0, color = C.white }) => {
  const f = useCurrentFrame();
  const s = usePop(at, 10);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', left: x, top: y, transform: `scale(${s}) rotate(${f * 1.2}deg)` }}>
      <path d="M12 1 C13 8 16 11 23 12 C16 13 13 16 12 23 C11 16 8 13 1 12 C8 11 11 8 12 1Z" fill={color} stroke={C.ink} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
};

// Screen recording inside a chunky browser window
const Browser = ({ clip, from, x = 760, y = 200, w = 1080, tilt = -2, zoom = 0.07, frames }) => {
  const f = useCurrentFrame();
  const s = usePop(4, 14);
  const h = (w * 9) / 16;
  const z = 1 + zoom * interpolate(f, [0, frames], [0, 1], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, transform: `translateY(${(1 - s) * 160}px) rotate(${tilt * s}deg) scale(${0.9 + 0.1 * s})`,
      background: C.white, border: `7px solid ${C.ink}`, borderRadius: 26, boxShadow: `16px 16px 0 ${C.ink}`, overflow: 'hidden',
    }}>
      <div style={{ height: 50, borderBottom: `6px solid ${C.ink}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', background: C.white }}>
        {[C.red, C.yellow, C.green].map((c) => <div key={c} style={{ width: 20, height: 20, borderRadius: 10, background: c, border: `3px solid ${C.ink}` }} />)}
        <div style={{ marginLeft: 18, fontFamily: BODY, fontWeight: 800, fontSize: 22, color: '#555' }}>mohalla.app</div>
      </div>
      <div style={{ width: w - 14, height: h, overflow: 'hidden' }}>
        <OffthreadVideo src={staticFile(`clips/${clip}.mp4`)} startFrom={sec(from)} muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z})`, transformOrigin: '50% 30%' }} />
      </div>
    </div>
  );
};

const Phone = ({ clip, from, x, y, w = 340 }) => {
  const s = usePop(6, 13);
  const h = (w * 1688) / 780;
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w + 28, padding: '46px 14px 26px', background: C.ink, borderRadius: 54,
      boxShadow: `16px 16px 0 rgba(17,17,17,0.35)`, transform: `translateY(${(1 - s) * 200}px) rotate(${3 * s}deg)`,
    }}>
      <div style={{ position: 'absolute', top: 16, left: '50%', width: 90, height: 14, marginLeft: -45, borderRadius: 7, background: '#333' }} />
      <div style={{ width: w, height: h, borderRadius: 26, overflow: 'hidden', background: C.white }}>
        <OffthreadVideo src={staticFile(`clips/${clip}.mp4`)} startFrom={sec(from)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
};

// Every scene slides in over the previous one
const SceneIn = ({ children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 18, stiffness: 140 } });
  return <AbsoluteFill style={{ transform: `translateX(${(1 - s) * 1920}px)` }}>{children}</AbsoluteFill>;
};

// cue (absolute seconds) -> frame inside a scene that starts at sceneStart seconds
const at = (cueSec, sceneStart) => sec(cueSec - sceneStart);

// ---------------------------------------------------------------- scenes

const Problem = ({ len }) => {
  const f = useCurrentFrame();
  const shake = f < sec(4) ? Math.sin(f * 1.7) * 2 : 0;
  const push = interpolate(f, [len - 14, len], [1, 1.35], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
  const fade = interpolate(f, [len - 10, len], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pains = [
    ['20 SPAM CALLS', C.red, C.white, 140, 130, -6],
    ['CLOSED?!', C.yellow, C.ink, 1300, 160, 5],
    ['WRONG NUMBER', C.pink, C.ink, 220, 800, 4],
    ['NOT LISTED', C.blue, C.white, 1180, 790, -5],
  ];
  return (
    <AbsoluteFill style={{ transform: `scale(${push}) translateX(${shake}px)`, opacity: fade }}>
      <Grid color={C.ink} line="rgba(255,255,255,0.06)" />
      {pains.map(([t, bg, color, x, y, r], i) => (
        <Sticker key={t} at={sec(0.25 + i * 0.32)} x={x} y={y} bg={bg} color={color} rotate={r} size={46}>{t}</Sticker>
      ))}
      <div style={{ position: 'absolute', left: 140, right: 140, top: 390, textAlign: 'center' }}>
        <Headline lines={['Finding good help nearby…']} at={at(T.cues.problem1, 0)} color={C.white} size={84}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} />
        <Headline lines={["shouldn't be this hard."]} at={at(T.cues.problem2, 0)} color={C.yellow} size={84}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 10 }} />
      </div>
    </AbsoluteFill>
  );
};

const Reveal = ({ start }) => {
  const f = useCurrentFrame();
  const logo = usePop(2, 8);
  const word = usePop(8, 12);
  const flash = interpolate(f, [0, 8], [1, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <Grid color={C.yellow} />
      <Sparkle x={330} y={210} at={10} size={110} />
      <Sparkle x={1480} y={700} at={14} size={90} />
      <Sparkle x={1500} y={190} at={18} size={60} />
      <div style={{ position: 'absolute', top: 250, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 40 }}>
        <Img src={staticFile('logo.svg')} style={{ width: 260, height: 260, transform: `scale(${logo}) rotate(${(1 - logo) * -40}deg)` }} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 200, color: C.ink, letterSpacing: -4, transform: `translateX(${(1 - word) * 120}px)`, opacity: word }}>
          Mohalla<span style={{ color: C.red }}>.</span>
        </div>
      </div>
      <Sticker at={at(T.vo[1] + 1.36, start)} x={560} y={640} bg={C.white} rotate={-2} size={50}>Your neighbourhood, one tap away</Sticker>
      <AbsoluteFill style={{ background: C.white, opacity: flash }} />
    </AbsoluteFill>
  );
};

const Feature = ({ color, headline, headColor = C.white, headAt = 6, clip, from, len, children, browser }) => (
  <SceneIn>
    <Grid color={color} line={headColor === C.white ? 'rgba(255,255,255,0.10)' : 'rgba(17,17,17,0.08)'} />
    <div style={{ position: 'absolute', left: 100, top: 200, width: 620 }}>
      <Headline lines={headline} at={headAt} color={headColor} size={84} />
    </div>
    <Browser clip={clip} from={from} frames={len} {...browser} />
    {children}
  </SceneIn>
);

const SmartAsk = ({ start, len }) => (
  <Feature color={C.pink} headColor={C.ink} headline={['Just say', 'what you', 'need.']} clip="02_smartask" from={1.0} len={len}>
    <Sticker at={at(T.cues.chipAC, start)} x={90} y={640} rotate={-3} size={38}>“My AC is not cooling!”</Sticker>
    <Sticker at={at(T.vo[2] + 5.22, start)} x={1040} y={120} bg={C.purple} color={C.white} rotate={4} size={40}>AC Repair</Sticker>
    <Sticker at={at(T.cues.chipOpen, start)} x={140} y={820} bg={C.green} color={C.white} rotate={-5} size={44}>Open now</Sticker>
    <Sticker at={at(T.cues.chipNear, start)} x={520} y={880} bg={C.blue} color={C.white} rotate={3} size={44}>Nearest first</Sticker>
  </Feature>
);

const Places = ({ start, len }) => (
  <Feature color={C.blue} headline={['Real places.', 'Live from', 'the map.']} clip="05_college" from={10.4} len={len}>
    <Sticker at={at(T.vo[3] + 3.08, start)} x={130} y={760} bg={C.yellow} rotate={-4} size={44}>Even your college!</Sticker>
  </Feature>
);

const Privacy = ({ start, len }) => (
  <Feature color={C.purple} headline={['Your number.', 'Hidden.']} clip="06_privacy" from={19.0} len={len}>
    <Sticker at={at(T.cues.noSpam, start)} x={110} y={600} bg={C.red} color={C.white} rotate={-5} size={50}>No spam calls.</Sticker>
    <Sticker at={at(T.cues.ever, start)} x={380} y={790} bg={C.yellow} rotate={6} size={80} pad="10px 40px">EVER.</Sticker>
  </Feature>
);

const LiveStatus = ({ start, len }) => (
  <Feature color={C.green} headline={['Open? Busy?', 'Know right', 'now.']} clip="07_owner" from={3.6} len={len}>
    <Sticker at={at(T.vo[5] + 0.9, start)} x={110} y={660} bg={C.white} rotate={-3} size={40}>
      <span style={{ color: C.green }}>●</span> Available now
    </Sticker>
    <Sticker at={at(T.cues.rightNow, start)} x={200} y={840} bg={C.yellow} rotate={4} size={40}>Updated live</Sticker>
  </Feature>
);

const Emergency = ({ start, len }) => (
  <Feature color={C.red} headline={['Help,', 'one tap', 'away.']} clip="09_emergency" from={0.3} len={len}>
    {['112', '108', '100', '101'].map((n, i) => (
      <Sticker key={n} at={at(T.vo[6] + 1.5 + i * 0.25, start)} x={100 + i * 165} y={720} bg={C.white} color={C.red} rotate={i % 2 ? 4 : -4} size={42} pad="12px 22px">{n}</Sticker>
    ))}
  </Feature>
);

const Platforms = ({ start, len }) => (
  <SceneIn>
    <Grid color={C.yellow} />
    <Browser clip="01_home" from={6.5} frames={len} x={110} y={190} w={1040} tilt={-2} zoom={0.04} />
    <Phone clip="10_mobile" from={11.0} x={1360} y={110} w={330} />
    <Sticker at={at(T.cues.web, start)} x={420} y={840} bg={C.white} rotate={-4} size={64}>WEB</Sticker>
    <Sticker at={at(T.cues.android, start)} x={1330} y={880} bg={C.green} color={C.white} rotate={4} size={64}>ANDROID</Sticker>
    <Sparkle x={1250} y={130} at={8} size={80} />
  </SceneIn>
);

const EndCard = ({ start, len }) => {
  const f = useCurrentFrame();
  const logo = usePop(2, 8);
  const word = usePop(6, 12);
  const out = interpolate(f, [len - 18, len], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <SceneIn>
      <Grid color={C.yellow} />
      <Sparkle x={300} y={180} at={8} size={110} />
      <Sparkle x={1540} y={680} at={12} size={100} />
      <Sparkle x={1580} y={200} at={16} size={60} />
      <Sparkle x={260} y={760} at={20} size={70} />
      <div style={{ position: 'absolute', top: 230, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 36 }}>
        <Img src={staticFile('logo.svg')} style={{ width: 230, height: 230, transform: `scale(${logo})` }} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 180, color: C.ink, letterSpacing: -4, opacity: word, transform: `translateY(${(1 - word) * 40}px)` }}>
          Mohalla<span style={{ color: C.red }}>.</span>
        </div>
      </div>
      <Sticker at={at(T.cues.tagline, start)} x={580} y={590} rotate={-2} size={48}>Your neighbourhood, one tap away</Sticker>
      <div style={{ position: 'absolute', bottom: 90, left: 0, right: 0, textAlign: 'center', fontFamily: BODY, fontWeight: 800, fontSize: 34, color: C.ink, opacity: interpolate(f, [40, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        Web · Android · Free to use
      </div>
      <AbsoluteFill style={{ background: C.ink, opacity: out }} />
    </SceneIn>
  );
};

// ---------------------------------------------------------------- composition

const SCENES = [Problem, Reveal, SmartAsk, Places, Privacy, LiveStatus, Emergency, Platforms, EndCard];

export const Launch = () => {
  const starts = T.scene;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {SCENES.map((Scene, i) => {
        const from = sec(starts[i]);
        const end = i + 1 < starts.length ? sec(starts[i + 1]) + 10 : sec(T.total);
        const len = end - from;
        return (
          <Sequence key={i} from={from} durationInFrames={len}>
            <Scene start={starts[i]} len={len} />
          </Sequence>
        );
      })}
      <Audio src={staticFile('launch/mix.wav')} />
    </AbsoluteFill>
  );
};
