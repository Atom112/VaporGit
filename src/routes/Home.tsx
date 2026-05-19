import { Component } from 'solid-js';

const Home: Component = () => {
  return (
    <div class="h-full w-full p-8 flex flex-col">
      <h1 class="text-4xl font-extrabold mb-4 drop-shadow-md">VaporGit 主页</h1>
      <p class="text-lg opacity-80">欢迎使用 VaporGit！这里是你的跨平台极简 Git 管理中心。</p>
      
      <div class="mt-8 grid grid-cols-2 gap-6">
        <div class="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm">
          <h2 class="text-xl font-bold mb-2">打开仓库</h2>
          <p class="opacity-70 text-sm">浏览本地文件夹并打开一个现有的 Git 仓库</p>
        </div>
        <div class="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm">
          <h2 class="text-xl font-bold mb-2">克隆仓库</h2>
          <p class="opacity-70 text-sm">从远程 URL 下载一个新的 Git 仓库到本地</p>
        </div>
      </div>
    </div>
  );
};

export default Home;