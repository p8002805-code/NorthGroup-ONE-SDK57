export const JOB_SHELL_HORIZONTAL_PADDING = 20;
export const JOB_SHELL_TOP_OFFSET = 14;

export const dashboardHeroHeightForWindow = (windowHeight) => (
  Math.min(390, Math.max(328, Number(windowHeight || 0) * 0.4))
);

export const workspaceHeroHeightForWindow = (windowHeight) => (
  Math.min(244, Math.max(224, Number(windowHeight || 0) * 0.27))
);
