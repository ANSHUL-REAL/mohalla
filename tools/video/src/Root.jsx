import React from 'react';
import { Composition } from 'remotion';
import { Demo, FPS, timeline } from './Demo';
import { Launch, LAUNCH_FPS, launchFrames } from './Launch';

export const RemotionRoot = () => (
  <>
    <Composition id="MohallaDemo" component={Demo} durationInFrames={timeline().total} fps={FPS} width={1920} height={1080} />
    <Composition id="MohallaLaunch" component={Launch} durationInFrames={launchFrames()} fps={LAUNCH_FPS} width={1920} height={1080} />
  </>
);
