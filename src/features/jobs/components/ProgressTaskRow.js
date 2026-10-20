import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';
import {
  progressTaskComplete,
  progressTaskRatio,
} from '../jobProgressService';

const formatAmount = (value) => Number(value || 0).toLocaleString('en-AU', {
  maximumFractionDigits: 2,
});

export default function ProgressTaskRow({
  task,
  disabled,
  celebration,
  onChangeAmount,
  onEdit,
  onToggleComplete,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const complete = progressTaskComplete(task);
  const ratio = progressTaskRatio(task);
  const celebrating = Boolean(
    celebration?.taskId && celebration.taskId === task.id && complete,
  );
  const animatedRatio = useRef(new Animated.Value(ratio)).current;
  const count = `${formatAmount(task.completed)}/${formatAmount(task.target)}`;
  const countWithUnit = task.unit ? `${count} ${task.unit}` : count;

  useEffect(() => {
    animatedRatio.stopAnimation();
    if (celebrating) {
      const fromRatio = Math.min(0.96, Math.max(0, Number(celebration?.fromRatio) || 0));
      animatedRatio.setValue(fromRatio);
    }
    Animated.timing(animatedRatio, {
      toValue: ratio,
      duration: celebrating ? 1050 : 320,
      easing: celebrating ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [animatedRatio, celebration?.requestId, celebrating, ratio]);

  const animatedWidth = animatedRatio.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[
      styles.taskRow,
      complete && styles.taskRowComplete,
      celebrating && styles.taskRowCelebrating,
    ]}>
      <Pressable
        style={({ pressed }) => [styles.taskCheck, pressed && styles.pressed]}
        onPress={() => onToggleComplete(task)}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: complete, disabled }}
        accessibilityLabel={`${complete ? 'Mark incomplete' : 'Mark complete'}: ${task.name}`}
      >
        <Ionicons
          name={complete ? 'checkmark-circle' : 'ellipse-outline'}
          size={25}
          color={complete ? colors.success : colors.borderStrong}
        />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.taskCopy, pressed && styles.pressed]}
        onPress={() => onEdit(task)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${task.name}`}
      >
        <View style={styles.taskTitleRow}>
          <Text style={[styles.taskName, complete && styles.taskNameComplete]} numberOfLines={2}>
            {task.name}
          </Text>
          {celebrating ? (
            <View style={styles.justCompletedPill}>
              <Ionicons name="sparkles" size={10} color={colors.statusSuccessText} />
              <Text style={styles.justCompletedText}>JUST COMPLETED</Text>
            </View>
          ) : (
            <Ionicons name="create-outline" size={14} color={colors.supportingText} />
          )}
        </View>
        <Text style={[styles.taskCount, complete && styles.taskCountComplete]}>
          {countWithUnit}
        </Text>
        {task.kmlLayerName ? (
          <View style={styles.taskLayerLink}>
            <Ionicons
              name={complete ? 'eye-off-outline' : 'layers-outline'}
              size={12}
              color={complete ? colors.success : colors.supportingText}
            />
            <Text style={[styles.taskLayerText, complete && styles.taskLayerTextComplete]} numberOfLines={1}>
              {complete ? 'Hidden on KML · ' : 'KML layer · '}{task.kmlLayerName}
            </Text>
          </View>
        ) : null}
        <View style={styles.taskTrack}>
          <Animated.View
            style={[
              styles.taskFill,
              complete && styles.taskFillComplete,
              { width: animatedWidth },
            ]}
          />
        </View>
      </Pressable>

      <View style={styles.stepper}>
        <Pressable
          style={({ pressed }) => [
            styles.stepperButton,
            Number(task.completed) <= 0 && styles.stepperButtonDisabled,
            pressed && styles.pressed,
          ]}
          onPress={() => onChangeAmount(task, -1)}
          disabled={disabled || Number(task.completed) <= 0}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${task.name} progress by one`}
        >
          <Ionicons name="remove" size={18} color={colors.bodyText} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.stepperButton,
            complete && styles.stepperButtonDisabled,
            pressed && styles.pressed,
          ]}
          onPress={() => onChangeAmount(task, 1)}
          disabled={disabled || complete}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${task.name} progress by one`}
        >
          <Ionicons name="add" size={18} color={colors.bodyText} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  taskRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.raisedSurface,
  },
  taskRowComplete: {
    borderColor: colors.success,
    backgroundColor: colors.successBackground,
  },
  taskRowCelebrating: {
    borderWidth: 2,
    shadowColor: colors.success,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  taskCheck: {
    width: 36,
    minHeight: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  taskCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: SPACING.sm,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
  },
  justCompletedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.successBackground,
  },
  justCompletedText: {
    color: colors.statusSuccessText,
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  taskName: {
    flex: 1,
    color: colors.bodyText,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  taskNameComplete: {
    color: colors.statusSuccessText,
  },
  taskCount: {
    color: colors.supportingText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    marginTop: 3,
  },
  taskCountComplete: {
    color: colors.statusSuccessText,
  },
  taskLayerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    marginTop: 3,
  },
  taskLayerText: {
    flex: 1,
    color: colors.supportingText,
    fontSize: 8.5,
    lineHeight: 12,
    fontWeight: '700',
  },
  taskLayerTextComplete: {
    color: colors.statusSuccessText,
  },
  taskTrack: {
    height: 3,
    marginTop: 7,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  taskFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  taskFillComplete: {
    backgroundColor: colors.success,
  },
  stepper: {
    flexDirection: 'row',
    columnGap: 5,
  },
  stepperButton: {
    width: 34,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  stepperButtonDisabled: {
    opacity: 0.34,
  },
  pressed: {
    opacity: 0.68,
  },
});
