declare global {
  namespace jest {
    export interface Matchers<R> {
      toBeUuidV4: () => R;
    }
    export interface Expect {
      toBeUuidV4: () => string;
    }
  }
}

export {};
