// 只替换网络地址；音频模块仍用原来的资源名识别曲目、和弦和播放器。
const urls = __ASSET_URLS;
export const assetURL = name => urls[name] || name;
