import { Component } from 'solid-js';
import PlatformPRs from './PlatformPRs';
import { giteeStore } from '../stores/giteeStore';

const GiteePRs: Component = () => (
  <PlatformPRs kind="gitee" authenticated={giteeStore.authenticated} />
);

export default GiteePRs;
