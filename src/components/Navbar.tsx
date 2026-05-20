import { Component } from 'solid-js';
import { A } from '@solidjs/router';

const Navbar: Component = () => {
  return (
    <nav class="flex items-center pl-4 pr-4 pb-1 pt-1 border-b border-white/10 bg-white/5">
      <ul class="flex space-x-6" data-tauri-no-drag>
        <li>
          <A class="text-gray-300 hover:text-white transition-colors" activeClass="text-cyan-400 font-semibold" href="/" end>主页</A>
        </li>
        <li>
          <A class="text-gray-300 hover:text-white transition-colors" activeClass="text-cyan-400 font-semibold" href="/repository">仓库</A>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;