import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ProfileAvatar from './ProfileAvatar';

const NAVY = '#0A2744';
const NAVY_DEEP = '#061A2D';
const GOLD = '#D6A84F';
const WHITE = '#FFFFFF';
const GREEN = '#54D98C';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const initialsFor = (name) => clean(name || 'NorthGroup')
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase() || 'NG';

export default function AssignedTeamModal({
  visible,
  job,
  members,
  assignedCount,
  loading = false,
  resolved = false,
  error = '',
  bottomInset = 0,
  onClose,
  onRefresh,
}) {
  const assignedMembers = Array.isArray(members) ? members : [];
  const suppliedCount = Number(assignedCount);
  const total = Number.isFinite(suppliedCount)
    ? Math.max(0, suppliedCount)
    : assignedMembers.length;
  const jobLabel = [clean(job?.number), clean(job?.name || job?.jobName)]
    .filter(Boolean)
    .join(' · ');
  const showLoading = loading && !assignedMembers.length;
  const showEmpty = !loading && !assignedMembers.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.shade}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close assigned team"
        />

        <View
          style={[
            styles.card,
            { marginBottom: Math.max(18, bottomInset) },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>MICROSOFT TEAMS</Text>
              <Text style={styles.title}>Assigned team · {total}</Text>
              <Text style={styles.jobLabel} numberOfLines={1}>
                {jobLabel || 'Active job'}
              </Text>
            </View>
            <View style={styles.teamIcon}>
              {loading ? (
                <ActivityIndicator size="small" color={GOLD} />
              ) : (
                <Ionicons name="people" size={22} color={GOLD} />
              )}
            </View>
          </View>

          {error ? (
            <View style={styles.notice}>
              <Ionicons name="warning-outline" size={16} color="#F4C96D" />
              <Text style={styles.noticeText}>{error}</Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.memberScroll}
            contentContainerStyle={styles.memberContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {showLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={GOLD} />
                <Text style={styles.emptyTitle}>Loading assigned team…</Text>
                <Text style={styles.emptyText}>
                  Checking the published Teams Shifts allocation.
                </Text>
              </View>
            ) : null}

            {showEmpty ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={30} color={GOLD} />
                <Text style={styles.emptyTitle}>
                  {total ? 'Employee names are still loading' : 'No assigned employees found'}
                </Text>
                <Text style={styles.emptyText}>
                  {total
                    ? `${total} employees are assigned to this job in Teams Shifts.`
                    : 'Refresh after the published Shifts allocation has been updated.'}
                </Text>
              </View>
            ) : null}

            {assignedMembers.map((member, index) => {
              const displayName = clean(member?.displayName)
                || `Assigned employee ${index + 1}`;
              const detail = clean(member?.jobTitle || member?.email);
              const memberResolved = Boolean(
                member?.directoryResolved
                && !/^Assigned employee \d+$/i.test(displayName),
              );

              return (
                <View
                  key={clean(member?.id || member?.userId) || `${displayName}-${index}`}
                  style={styles.memberRow}
                >
                  <ProfileAvatar
                    initials={initialsFor(displayName)}
                    size={42}
                    backgroundColor="rgba(214,168,79,0.13)"
                    textColor={GOLD}
                    borderColor="rgba(214,168,79,0.42)"
                    borderWidth={1}
                  />
                  <View style={styles.memberCopy}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    {detail ? (
                      <Text style={styles.memberDetail} numberOfLines={1}>
                        {detail}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={memberResolved ? 'checkmark-circle' : 'time-outline'}
                    size={19}
                    color={memberResolved ? GREEN : GOLD}
                  />
                </View>
              );
            })}
          </ScrollView>

          {typeof onRefresh === 'function' ? (
            <Pressable
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={onRefresh}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Refresh assigned team"
            >
              {loading ? (
                <ActivityIndicator size="small" color={GOLD} />
              ) : (
                <Ionicons name="refresh" size={17} color={GOLD} />
              )}
              <Text style={styles.refreshText}>
                {loading ? 'REFRESHING…' : 'REFRESH TEAM'}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.doneButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Done viewing assigned team"
          >
            <Text style={styles.doneText}>DONE</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shade: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(2, 12, 22, 0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    overflow: 'hidden',
    padding: 17,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.58)',
    backgroundColor: NAVY,
    shadowColor: '#000000',
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: GOLD,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 1.25,
  },
  title: {
    color: WHITE,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    marginTop: 1,
  },
  jobLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  teamIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.36)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 8,
    padding: 10,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(214,168,79,0.10)',
  },
  noticeText: {
    flex: 1,
    color: '#F4D89B',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
  },
  memberScroll: { flexShrink: 1 },
  memberContent: { paddingBottom: 4 },
  memberRow: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.11)',
  },
  memberCopy: { flex: 1, minWidth: 0 },
  memberName: {
    color: WHITE,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  memberDetail: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyState: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: WHITE,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 10,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  refreshButton: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 7,
    marginTop: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.5)',
    backgroundColor: NAVY_DEEP,
  },
  refreshText: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  doneButton: {
    minHeight: 49,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 11,
    borderRadius: 15,
    backgroundColor: GOLD,
  },
  doneText: {
    color: NAVY_DEEP,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  buttonPressed: { opacity: 0.66 },
});
