import { createStore } from 'solid-js/store';

interface UpdateInfo {
  available: boolean;
  tagName: string;
  htmlUrl: string;
}

const [updateStore, setUpdateStore] = createStore<UpdateInfo>({
  available: false,
  tagName: '',
  htmlUrl: '',
});

export function showUpdate(tagName: string, htmlUrl: string) {
  setUpdateStore({ available: true, tagName, htmlUrl });
}

export function dismissUpdate() {
  setUpdateStore({ available: false, tagName: '', htmlUrl: '' });
}

export { updateStore };
