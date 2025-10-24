// Type declarations for @testing-library/jest-dom
// This file ensures TypeScript can find the jest-dom types during build

declare module '@testing-library/jest-dom' {
  const matchers: any;
  export = matchers;
}
