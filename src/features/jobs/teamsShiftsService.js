const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const PIPE_JOB_LINE = /^(\d{6}(?:-\d{3})?)\s*\|\s*([^|\s]+)\s*\|\s*(.+)$/;
const LEGACY_JOB_LINE = /^(\d{6}(?:-\d{3})?)\s+(.+)$/;
const TEAMS_JOB_HISTORY_DAYS = 28;

const clean = (value) => String(value || '').replace(/\r/g, '').trim();
const unique = (values) => [...new Set(values.filter(Boolean))];

const teamsJobCutoff = () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TEAMS_JOB_HISTORY_DAYS);
  return cutoff.getTime();
};

const startsWithinImportWindow = (shift) => {
  const start = Date.parse(shift?.sharedShift?.startDateTime || '');
  return Number.isFinite(start) && start >= teamsJobCutoff();
};

const graphCollection = async (url, accessToken) => {
  const values = [];
  let nextUrl = url;
  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body?.error?.message || `Microsoft Graph request failed (${response.status}).`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    const page = await response.json();
    values.push(...(Array.isArray(page?.value) ? page.value : []));
    nextUrl = page?.['@odata.nextLink'] || '';
  }
  return values;
};

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

const parseJobHeader = (value) => {
  const header = clean(value);
  const pipeMatch = header.match(PIPE_JOB_LINE);
  if (pipeMatch) {
    return {
      number: pipeMatch[1].toUpperCase(),
      name: clean(pipeMatch[2]),
      location: clean(pipeMatch[3]),
    };
  }

  // Keep existing published shifts working while the team moves to:
  // Job Number | OneWordJobName | Job Location
  const legacyMatch = header.match(LEGACY_JOB_LINE);
  if (!legacyMatch || !clean(legacyMatch[2])) return null;
  const legacyLocation = clean(legacyMatch[2]);
  return {
    number: legacyMatch[1].toUpperCase(),
    name: legacyLocation,
    location: legacyLocation,
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
    details: instructions.join('\n'),
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
      details: unique([current.details, shiftJob.details]).join('\n'),
      teamsLastSyncedAt: shiftJob.teamsLastSyncedAt,
    });
  });
  return [...jobs.values()];
};

const shiftJobNumber = (shift) => {
  const shared = shift?.sharedShift;
  if (!shared || shift?.isStagedForDeletion) return '';
  const firstLine = shiftText(shared).split('\n').map(clean).find(Boolean) || '';
  return parseJobHeader(firstLine)?.number || '';
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

  return {
    jobNumber,
    teamIds,
    userIds: unique(fulfilled.flatMap((result) => result.value)),
  };
};
