import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const isDark = tone === 'dark';
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
        !workflow && isDark && styles.collapseTitleDark,
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
          !workflow && isDark && styles.collapseHeaderDark,
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

        {!workflow && isDark ? <View style={styles.collapseDarkAccent} /> : null}

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
                !workflow && isDark && styles.collapseSubtitleDark,
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

        {!workflow && isDark ? (
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={22}
            color="#D6A84F"
            style={styles.collapseChevronDark}
          />
        ) : (
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
        )}
      </TouchableOpacity>

      {open ? (
        <View
          style={[
            styles.collapseContent,
            !workflow && isDark && styles.collapseContentDark,
          ]}
        >
          {children}

          <TouchableOpacity
            style={[
              styles.collapseCloseButton,
              !workflow && isStart && styles.collapseCloseButtonStart,
              !workflow && isEnd && styles.collapseCloseButtonEnd,
              !workflow && isDark && styles.collapseCloseButtonDark,
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
                !workflow && isDark && styles.collapseCloseButtonTextDark,
                workflow && styles.collapseCloseButtonTextWorkflow,
              ]}
            >
              {workflow ? `Collapse ${title}` : `Close ${title}`}
            </Text>

            {!workflow && isDark ? (
              <Ionicons name="chevron-up" size={20} color="#D6A84F" />
            ) : (
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
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
