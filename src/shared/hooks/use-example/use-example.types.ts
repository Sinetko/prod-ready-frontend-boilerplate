export interface UseExampleOptions {
  initialEnabled?: boolean;
}

export interface UseExampleResult {
  enabled: boolean;
  toggle: () => void;
  reset: () => void;
}
