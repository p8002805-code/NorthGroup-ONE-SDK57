import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import styles from '../styles/styles';

export default function CollapseSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
  tone = 'default',
  compact = false,
  workflow = false,
  complete = false,
  current = false,
  headerStyle,
  titleStyle,
  subtitleStyle,
}) {
  const isStart = tone === 'start';
  const isEnd = tone === 'end';
  const isCurrent = workflow && Boolean(current);
  const isComplete = workflow && Boolean(complete);
  const workflowStatus = isCurrent
    ? 'CURRENT'
    : isComplete
      ? '✓ COMPLETE'
      : 'UP NEXT';

  const titleElement = (
    <Text
      style={[
        styles.collapseTitle,
        !workflow && isStart && styles.collapseTitleStart,
        !workflow && isEnd && styles.collapseTitleEnd,
        !workflow && compact && styles.collapseTitleCompact,
        workflow && styles.collapseTitleWorkflow,
        isCurrent && styles.collapseTitleWorkflowCurrent,
        titleStyle,
      ]}
    >
      {title}
    </Text>
  );

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.collapseHeader,
          !workflow && isStart && styles.collapseHeaderStart,
          !workflow && isEnd && styles.collapseHeaderEnd,
          !workflow && compact && styles.collapseHeaderCompact,
          workflow && styles.collapseHeaderWorkflow,
          isCurrent && styles.collapseHeaderWorkflowCurrent,
          isComplete && !isCurrent && styles.collapseHeaderWorkflowComplete,
          headerStyle,
        ]}
        onPress={onToggle}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        {workflow ? (
          <View
            style={[
              styles.collapseWorkflowAccent,
              isCurrent && styles.collapseWorkflowAccentCurrent,
              isComplete && !isCurrent && styles.collapseWorkflowAccentComplete,
            ]}
          />
        ) : null}

        <View style={styles.collapseCopy}>
          {workflow ? (
            <View style={styles.collapseWorkflowTitleRow}>
              {titleElement}
              <View
                style={[
                  styles.collapseWorkflowStatus,
                  isCurrent && styles.collapseWorkflowStatusCurrent,
                  isComplete && !isCurrent && styles.collapseWorkflowStatusComplete,
                ]}
              >
                <Text
                  style={[
                    styles.collapseWorkflowStatusText,
                    isCurrent && styles.collapseWorkflowStatusTextCurrent,
                    isComplete && !isCurrent && styles.collapseWorkflowStatusTextComplete,
                  ]}
                >
                  {workflowStatus}
                </Text>
              </View>
            </View>
          ) : titleElement}

          {subtitle ? (
            <Text
              style={[
                styles.collapseSubtitle,
                !workflow && isStart && styles.collapseSubtitleStart,
                !workflow && isEnd && styles.collapseSubtitleEnd,
                !workflow && compact && styles.collapseSubtitleCompact,
                workflow && styles.collapseSubtitleWorkflow,
                isCurrent && styles.collapseSubtitleWorkflowCurrent,
                subtitleStyle,
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        <Text
          style={[
            styles.collapseArrow,
            !workflow && isStart && styles.collapseArrowStart,
            !workflow && isEnd && styles.collapseArrowEnd,
            workflow && styles.collapseArrowWorkflow,
            isCurrent && styles.collapseArrowWorkflowCurrent,
          ]}
        >
          {open ? '⌃' : '⌄'}
        </Text>
      </TouchableOpacity>

      {open ? (
        <View style={styles.collapseContent}>
          {children}

          <TouchableOpacity
            style={[
              styles.collapseCloseButton,
              !workflow && isStart && styles.collapseCloseButtonStart,
              !workflow && isEnd && styles.collapseCloseButtonEnd,
              workflow && styles.collapseCloseButtonWorkflow,
            ]}
            onPress={onToggle}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.collapseCloseButtonText,
                !workflow && isStart && styles.collapseCloseButtonTextStart,
                !workflow && isEnd && styles.collapseCloseButtonTextEnd,
                workflow && styles.collapseCloseButtonTextWorkflow,
              ]}
            >
              {workflow ? `Collapse ${title}` : `Close ${title}`}
            </Text>

            <Text
              style={[
                styles.collapseCloseArrow,
                !workflow && isStart && styles.collapseCloseArrowStart,
                !workflow && isEnd && styles.collapseCloseArrowEnd,
                workflow && styles.collapseCloseArrowWorkflow,
              ]}
            >
              ⌃
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
