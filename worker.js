// Cloudflare Worker：静态文件照常由 assets 提供；en.hugloom.art 的首页换成英文版 Starli（en/index.html）。
// 只有 wrangler.jsonc 里 run_worker_first 列出的路径会先经过这里，其余请求直接走静态文件。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname.startsWith('en.') && (url.pathname === '/' || url.pathname === '/index.html')) {
      url.pathname = '/en/';
      return env.ASSETS.fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  }
};
