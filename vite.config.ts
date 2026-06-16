import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ mode }) => {
  const plugins = [react()];
  // Cloudflare 插件仅在非 dev/客户端模式时启用，避免本地网络问题
  if (mode !== "client") {
    plugins.push(cloudflare());
  }
  return { plugins };
});
