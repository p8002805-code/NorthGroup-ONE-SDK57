import {
  GRAPH_ROOT,
  graphCollection as sharedGraphCollection,
  graphRequest,
} from '../../services/sync/graphClient';

const TEAMS_JOB_HISTORY_DAYS = 28;

const clean = (value) => String(value || '').replace(/\r/g, '').trim();
const unique = (values) => [...new Set(values.filter(Boolean))];

const shortShiftDate = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane', year: '2-digit', month: '2-digit', day: '2-digit',
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  const { year, month, day } = parts;
  return `${year}${month}${day}`;
};

const oneLineInstructions = (values = []) => unique(
  (Array.isArray(values) ? values : [values])
    .flatMap((value) => String(value || '').split('\n'))
    .map(clean)
    .filter(Boolean),
).join('/').replace(/\s*\/+\s*/g, '/');

export const formatShiftBriefLine = (startDateTime, instructions = []) => {
  const details = oneLineInstructions(instructions);
  if (!details) return '';
  return [shortShiftDate(startDateTime), details].filter(Boolean).join(' ');
};

const mergeBriefLines = (...values) => unique(
  values.flatMap((value) => String(value || '').split('\n').map(clean).filter(Boolean)),
).sort((left, right) => {
  const leftDate = left.match(/^\d{6}\b/)?.[0] || '';
  const rightDate = right.match(/^\d{6}\b/)?.[0] || '';
  if (leftDate && rightDate) return leftDate.localeCompare(rightDate);
  if (leftDate !== rightDate) return leftDate ? -1 : 1;
  return 0;
}).join('\n');

const NON_JOB_PLACEHOLDER_PATTERNS = [
  /^n\s*\/?\s*a(?:$|[\s|+;,:/\\-])/i,
  /^(?:none|nil|not applicable|not available|unavailable)(?:$|[\s|+;,:/\\-])/i,
  /^(?:(?:annual|sick|personal|long service|carer's|parental|compassionate)\s+)?leave\b/i,
  /^(?:rdo|rostered day off|day off|rest day|off)\b/i,
  /\bpublic holiday\b/i,
  /^(?:qld|queensland)\b.*\b(?:holiday|labour day|show day|show holiday|ekka)\b/i,
  /^(?:the\s+)?(?:australia day|new year's day|new years day|good friday|easter saturday|easter sunday|easter monday|anzac day|labour day|royal queensland show|ekka|king's birthday|kings birthday|queen's birthday|queens birthday|christmas day|boxing day)\b/i,
  /^(?:holiday|no work|no shift)\b/i,
  /^other\b/i,
];

const isNonJobPlaceholder = (value) => {
  const normalised = clean(value)
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .trim();
  return Boolean(normalised) && NON_JOB_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalised));
};

const isJobNumber = (value) => {
  const token = clean(value).replace(/^#/, '');
  if (!token || /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(token)) return false;
  return /^(?:\d+|[A-Z]{1,8}-?\d+)(?:[-/]\d+)*$/i.test(token);
};

const normaliseJobNumber = (value) => clean(value).replace(/^#/, '').toUpperCase();

const stripLeadingJobLabel = (value) => {
  let header = clean(value).replace(/^#\s*/, '');
  const label = header.match(
    /^(?:(?:job|project)(?:\s+(?:number|no\.?)|\s*#)?|(?:job|project)\s+number)\s*(?:[:#-]\s*|\s+(?=[A-Z]{0,8}-?\d))/i,
  );
  if (label) header = header.slice(label[0].length).trim();
  return header;
};

const splitHeaderParts = (value) => {
  const header = clean(value);
  if (!header) return [];
  return header
    .split(/\s*\|\s*|\s*\+\s*|\s*;\s*|\s+[-–—]\s+|\s+\/\s+|\s*:\s*/)
    .map(clean)
    .filter(Boolean);
};

const teamsJobCutoff = () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TEAMS_JOB_HISTORY_DAYS);
  return cutoff.getTime();
};

const startsWithinImportWindow = (shift) => {
  const start = Date.parse(shift?.sharedShift?.startDateTime || '');
  return Number.isFinite(start) && start >= teamsJobCutoff();
};

const teamsSyncConfig = (operation) => ({
  feature: 'teamsShifts',
  operation,
});

const graphCollection = (url, accessToken) => sharedGraphCollection(
  url,
  accessToken,
  teamsSyncConfig('Load Teams Shifts'),
);

const graphItem = (url, accessToken) => graphRequest(
  url,
  accessToken,
  {},
  teamsSyncConfig('Load assigned employee'),
);

const shiftText = (sharedShift) => {
  const activityNames = (sharedShift?.activities || [])
    .map((activity) => clean(activity?.displayName))
    .filter(Boolean);
  return unique([
    clean(sharedShift?.displayName),
    clean(sharedShift?.notes),
    ...activityNames,
  ]).join('\n');
};

export const parseJobHeader = (value) => {
  const header = stripLeadingJobLabel(value);
  if (!header) return null;

  // Shifts often contain roster placeholders rather than a field assignment.
  // Do not create a workspace for entries such as Leave, N/A, RDO or Unavailable.
  const firstHeaderPart = splitHeaderParts(header)[0] || header;
  if (isNonJobPlaceholder(header) || isNonJobPlaceholder(firstHeaderPart)) return null;

  if (/^\d{1,2}:\d{2}(?:\s|$)/.test(header)) return null;

  let parts = splitHeaderParts(header);
  if (!parts.length) return null;

  const firstPart = parts[0] || '';

  // Do not turn a date or time-only shift title into a workspace.
  if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(firstPart) || /^\d{1,2}:\d{2}$/.test(firstPart)) {
    return null;
  }

  if (parts.length === 1) {
    const words = parts[0].split(/\s+/).map(clean).filter(Boolean);
    if (words.length > 1 && isJobNumber(words[0]) && !/[|+;:/]/.test(header)) {
      // Preserve the older free-text form: 205672 Bruce Highway Upgrade.
      const legacyText = words.slice(1).join(' ');
      parts = [words[0], legacyText, legacyText];
    } else if (words.length > 1) {
      // If the first segment is not numeric, move each word forward:
      // Broncos Suncorp -> Broncos / Suncorp / empty location.
      parts = words;
    }
  }

  // Every valid entry uses the first field as the visible job-number field,
  // whether it contains digits or ordinary text such as Event or RIEGL.
  const number = normaliseJobNumber(parts[0]);
  if (!number) return null;

  return {
    number,
    name: clean(parts[1]),
    location: clean(parts.slice(2).join(' ')),
  };
};

const parsePublishedShift = (shift, team) => {
  const shared = shift?.sharedShift;
  if (!shared || shift?.isStagedForDeletion) return null;
  const lines = shiftText(shared).split('\n').map(clean).filter(Boolean);
  const header = parseJobHeader(lines[0]);
  if (!header) return null;

  const instructions = unique(lines.slice(1));
  return {
    number: header.number,
    name: header.name,
    location: header.location,
    source: 'teams-shifts',
    microsoftShiftIds: [shift.id],
    microsoftTeamIds: [team.id],
    microsoftTeamNames: [clean(team.displayName)],
    scheduleStart: clean(shared.startDateTime),
    scheduleEnd: clean(shared.endDateTime),
    workType: instructions[0] || '',
    details: formatShiftBriefLine(shared.startDateTime, instructions),
    teamsLastSyncedAt: new Date().toISOString(),
  };
};

const mergeParsedShifts = (parsed) => {
  const jobs = new Map();
  parsed.filter(Boolean).forEach((shiftJob) => {
    const current = jobs.get(shiftJob.number);
    if (!current) {
      jobs.set(shiftJob.number, shiftJob);
      return;
    }
    jobs.set(shiftJob.number, {
      ...current,
      microsoftShiftIds: unique([...current.microsoftShiftIds, ...shiftJob.microsoftShiftIds]),
      microsoftTeamIds: unique([...current.microsoftTeamIds, ...shiftJob.microsoftTeamIds]),
      microsoftTeamNames: unique([...current.microsoftTeamNames, ...shiftJob.microsoftTeamNames]),
      scheduleStart: [current.scheduleStart, shiftJob.scheduleStart].filter(Boolean).sort()[0] || '',
      scheduleEnd: [current.scheduleEnd, shiftJob.scheduleEnd].filter(Boolean).sort().at(-1) || '',
      workType: current.workType || shiftJob.workType,
      details: mergeBriefLines(current.details, shiftJob.details),
      teamsLastSyncedAt: shiftJob.teamsLastSyncedAt,
    });
  });
  return [...jobs.values()];
};

const shiftJobNumber = (shift) => {
  const shared = shift?.sharedShift;
  if (!shared || shift?.isStagedForDeletion) return '';
  const firstLine = shiftText(shared).split('\n').map(clean).find(Boolean) || '';
  const header = parseJobHeader(firstLine);
  return header?.number || '';
};

export const loadAssignedTeamsJobs = async ({ accessToken, userId }) => {
  if (!accessToken || !userId) throw new Error('Microsoft account details are unavailable.');
  const teams = await graphCollection(`${GRAPH_ROOT}/me/joinedTeams`, accessToken);
  const results = await Promise.allSettled(
    teams.map(async (team) => {
      let shifts = [];
      try {
        shifts = await graphCollection(
          `${GRAPH_ROOT}/teams/${encodeURIComponent(team.id)}/schedule/shifts`,
          accessToken,
        );
      } catch (error) {
        // A normal Team does not necessarily have a Shifts schedule.
        if (error?.status !== 404) throw error;
      }
      return shifts
        .filter((shift) => clean(shift?.userId).toLowerCase() === clean(userId).toLowerCase())
        .filter(startsWithinImportWindow)
        .map((shift) => parsePublishedShift(shift, team));
    }),
  );

  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  if (!fulfilled.length && results.length) throw results[0].reason;
  return mergeParsedShifts(fulfilled.flatMap((result) => result.value));
};

export const loadJobShiftMembers = async ({ accessToken, job }) => {
  if (!accessToken) throw new Error('Your Microsoft session is unavailable.');

  const jobNumber = clean(job?.number).toUpperCase();
  const teamIds = unique(job?.microsoftTeamIds || []);
  if (!jobNumber || !teamIds.length) {
    throw new Error('Job Chat is available for jobs imported from published Teams Shifts.');
  }

  const results = await Promise.allSettled(
    teamIds.map(async (teamId) => {
      const shifts = await graphCollection(
        `${GRAPH_ROOT}/teams/${encodeURIComponent(teamId)}/schedule/shifts`,
        accessToken,
      );
      return shifts
        .filter(startsWithinImportWindow)
        .filter((shift) => shiftJobNumber(shift) === jobNumber)
        .map((shift) => clean(shift?.userId))
        .filter(Boolean);
    }),
  );

  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  if (!fulfilled.length && results.length) throw results[0].reason;
  const userIds = unique(fulfilled.flatMap((result) => result.value));
  const memberResults = await Promise.allSettled(userIds.map((userId) => graphItem(
    // User.ReadBasic.All deliberately exposes only Microsoft's basic profile
    // fields for other employees. Do not request jobTitle here: including a
    // full-profile-only field can make an otherwise valid basic lookup fail.
    `${GRAPH_ROOT}/users/${encodeURIComponent(userId)}?$select=id,displayName,mail,userPrincipalName`,
    accessToken,
  )));
  const directoryMembersResolved = memberResults.length === userIds.length
    && memberResults.every((result) => result.status === 'fulfilled' && result.value?.id);
  const directoryFailure = memberResults.find((result) => result.status === 'rejected')?.reason;
  const directoryError = directoryFailure?.status === 403
    ? 'Your current Microsoft sign-in is missing User.ReadBasic.All. Sign out of Microsoft, then sign in once more to receive the administrator-approved permission.'
    : directoryFailure?.status === 401
      ? 'Your Microsoft sign-in must be refreshed before assigned employee names can load.'
      : directoryFailure?.message || '';
  const membersById = new Map(
    memberResults
      .filter((result) => result.status === 'fulfilled' && result.value?.id)
      .map((result) => [clean(result.value.id).toLowerCase(), result.value]),
  );
  const members = userIds.map((userId, index) => {
    const user = membersById.get(clean(userId).toLowerCase());
    return {
      id: userId,
      displayName: clean(user?.displayName) || `Assigned employee ${index + 1}`,
      email: clean(user?.mail || user?.userPrincipalName),
      jobTitle: '',
      directoryResolved: Boolean(user?.id),
    };
  });

  return {
    jobNumber,
    teamIds,
    userIds,
    members,
    directoryMembersResolved,
    directoryError,
  };
};
