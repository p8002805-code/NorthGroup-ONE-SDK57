const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const memberByUserId = (members) => new Map(
  (Array.isArray(members) ? members : [])
    .filter((member) => member?.userId)
    .map((member) => [clean(member.userId).toLowerCase(), member]),
);

export const mergeAssignedMemberProfiles = (directoryMembers, chatMembers) => {
  const chatByUserId = memberByUserId(chatMembers);
  return (Array.isArray(directoryMembers) ? directoryMembers : []).map((member) => {
    const chatMember = chatByUserId.get(clean(member?.id).toLowerCase());
    const chatDisplayName = clean(chatMember?.displayName);
    return {
      ...member,
      displayName: member?.directoryResolved
        ? clean(member.displayName)
        : chatDisplayName || clean(member?.displayName),
      email: clean(member?.email || chatMember?.email),
      directoryResolved: Boolean(member?.directoryResolved || chatDisplayName),
      identitySource: member?.directoryResolved
        ? 'directory'
        : chatDisplayName
          ? 'teams-chat'
          : 'placeholder',
    };
  });
};

export const assignedMemberProfilesResolved = (members, expectedCount) => (
  Number(expectedCount || 0) === (Array.isArray(members) ? members.length : 0)
  && (Array.isArray(members) ? members : []).every((member) => (
    member?.directoryResolved
    && clean(member?.displayName)
    && !/^Assigned employee \d+$/i.test(clean(member.displayName))
  ))
);
