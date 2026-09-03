/** LTI launch support is not enabled in this project. */
export function useLtiSession() {
  return {
    isLtiLaunch: false,
    scorePosted: false,
    posting: false,
    postScore: async (_score: number, _max?: number, _resourceId?: string) => {},
  };
}
