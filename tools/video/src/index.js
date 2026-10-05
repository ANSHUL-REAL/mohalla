// Remotion entry. Pipeline: npm run record (Playwright clips) -> npm run encode (frames -> public/clips) -> npm run studio / npm run render (-> ../../Mohalla_Demo.mp4)
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
