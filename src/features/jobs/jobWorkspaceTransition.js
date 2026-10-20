const interpolate = (progress, inputRange, outputRange) => progress.interpolate({
  inputRange,
  outputRange,
  extrapolate: 'clamp',
});

export const workspaceHeroTransitionStyles = ({
  progress,
  expandedHeight,
  height,
}) => {
  if (!progress) {
    return {
      heroHeightStyle: { minHeight: height },
      heroRevealStyle: null,
      controlRevealStyle: null,
    };
  }

  return {
    heroHeightStyle: {
      height: interpolate(progress, [0, 1], [expandedHeight, height]),
    },
    heroRevealStyle: {
      opacity: interpolate(progress, [0, 0.22, 1], [0, 0.35, 1]),
      transform: [{ translateY: interpolate(progress, [0, 1], [8, 0]) }],
    },
    controlRevealStyle: {
      opacity: interpolate(progress, [0, 0.36, 1], [0, 0, 1]),
      transform: [{ translateX: interpolate(progress, [0, 1], [6, 0]) }],
    },
  };
};

export const workspaceContentTransitionStyles = (progress) => {
  if (!progress) {
    return {
      contentTransitionStyle: null,
      dockTransitionStyle: null,
    };
  }

  return {
    contentTransitionStyle: {
      opacity: interpolate(progress, [0, 0.18, 1], [0, 0.2, 1]),
      transform: [{ translateY: interpolate(progress, [0, 1], [10, 0]) }],
    },
    dockTransitionStyle: {
      opacity: interpolate(progress, [0, 0.3, 1], [0, 0, 1]),
      transform: [{ translateY: interpolate(progress, [0, 1], [10, 0]) }],
    },
  };
};
