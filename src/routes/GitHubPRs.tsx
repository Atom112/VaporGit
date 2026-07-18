import { Component } from 'solid-js';
import PlatformPRs from './PlatformPRs';
import { githubStore } from '../stores/githubStore';

const GitHubPRs: Component = () => (
  <PlatformPRs kind="github" authenticated={githubStore.authenticated} />
);

export default GitHubPRs;
