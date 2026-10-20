// Only used by local createTestHarness(). NOT imported by app-home.
// Synthetic D1 binding only, no routes, R2, authentication or deployment.
export default {
  async fetch() {
    return new Response('phase15_local_test_only', {status:404});
  },
};
