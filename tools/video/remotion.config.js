// Remotion config (used by `npm run studio` / `npm run render`)
const { Config } = require('@remotion/cli/config');

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
