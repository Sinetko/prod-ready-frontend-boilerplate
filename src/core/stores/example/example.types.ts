export interface ExampleStore {
  state: {
    count: number;
  };
  actions: {
    increment: () => void;
    reset: () => void;
  };
}
