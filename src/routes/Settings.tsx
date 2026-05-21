import { Component } from 'solid-js';
import { settingsStore, updateSettings } from '../stores/settingsStore';
import CustomSelect from '../components/CustomSelect';

const Settings: Component = () => {
  return (
    <div class="h-full w-full p-8 overflow-auto animate-tree-enter">
      <div class="max-w-lg mx-auto">
        <h1 class="text-2xl font-bold mb-6">设置</h1>

        <div class="space-y-6">
          {/* Default diff view */}
          <div class="p-4 rounded-xl bg-white/5 border border-white/10">
            <label class="block text-sm font-medium mb-2">默认 Diff 视图</label>
            <CustomSelect
              value={settingsStore.defaultDiffView}
              onChange={(v) => updateSettings({ defaultDiffView: v as any })}
              options={[
                { value: 'unified', label: 'Unified（统一视图）' },
                { value: 'split', label: 'Split（分割视图）' },
                { value: 'fullFile', label: 'Full File（完整文件）' },
              ]}
            />
          </div>

          {/* Default remote name */}
          <div class="p-4 rounded-xl bg-white/5 border border-white/10">
            <label class="block text-sm font-medium mb-2">默认远程名称</label>
            <input
              class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
              placeholder="origin"
              value={settingsStore.defaultRemoteName}
              onInput={(e) => updateSettings({ defaultRemoteName: e.currentTarget.value })}
            />
            <p class="text-xs opacity-40 mt-1">用于 Fetch/Pull/Push 操作的默认远程仓库</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
