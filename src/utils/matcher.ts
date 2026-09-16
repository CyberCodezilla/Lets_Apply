import type { UserProfile } from '../types';

export interface CardJobData {
  jobId: string;
  title: string;
  company: string;
  location: string;
  stipend: string;
  duration: string;
  url: string;
  skills: string[];
}

export interface CardMatchResult {
  score: number;
  rationale: string[];
  breakdown: {
    roleScore: number;
    skillsScore: number;
    stipendScore: number;
    locationScore: number;
  };
}

/**
 * Fast, deterministic client-side evaluation of an internship card against candidate profile.
 * Runs in < 1ms per card with high accuracy and zero network latency.
 */
export function evaluateJobMatch(profile: UserProfile, job: CardJobData): CardMatchResult {
  const rationale: string[] = [];
  const normalizedTitle = job.title.toLowerCase();

  // 1. Role & Title Alignment (0 - 35 pts)
  let roleScore = 0;
  const targetRoles = (profile.preferences.targetRoles || []).map((r) => r.toLowerCase().trim()).filter(Boolean);
  const candidateProjects = profile.projects || [];

  let matchedRoleName = '';
  for (const role of targetRoles) {
    const roleTokens = role.split(/\s+/);
    if (normalizedTitle.includes(role) || role.includes(normalizedTitle)) {
      roleScore = 35;
      matchedRoleName = role;
      break;
    }
    const matchingTokens = roleTokens.filter((t) => t.length > 2 && normalizedTitle.includes(t));
    if (matchingTokens.length >= 2) {
      roleScore = Math.max(roleScore, 30);
      matchedRoleName = role;
    } else if (matchingTokens.length === 1) {
      roleScore = Math.max(roleScore, 20);
      matchedRoleName = role;
    }
  }

  // Check project titles / descriptions if target role didn't give full points
  const STOPWORDS = new Set(['internship', 'intern', 'trainee', 'developer', 'engineer', 'associate', 'hiring', 'role', 'jobs', 'level', 'part', 'time', 'full']);
  if (roleScore < 30 && candidateProjects.length > 0) {
    for (const proj of candidateProjects) {
      const projTitle = proj.title.toLowerCase();
      const projDesc = proj.description.toLowerCase();
      const titleWords = normalizedTitle
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w));
      const matchesProj = titleWords.length > 0 && titleWords.some((w) => projTitle.includes(w) || projDesc.includes(w));
      if (matchesProj) {
        roleScore = Math.max(roleScore, 25);
        if (!matchedRoleName) matchedRoleName = proj.title;
        break;
      }
    }
  }

  if (targetRoles.length === 0 && roleScore === 0) {
    // If no target roles specified, award neutral 20 pts
    roleScore = 20;
  }

  if (matchedRoleName && roleScore >= 25) {
    rationale.push(`Strong role alignment with your target '${matchedRoleName}'`);
  }

  // 2. Technical & Domain Skills Match (0 - 40 pts)
  let skillsScore = 0;
  const candidateSkills = new Set(
    (profile.skills || []).map((s) => s.toLowerCase().trim()).filter(Boolean)
  );

  // Also gather tech stacks from candidate projects
  for (const proj of candidateProjects) {
    for (const t of proj.techStack || []) {
      if (t.trim()) candidateSkills.add(t.toLowerCase().trim());
    }
  }

  const jobSkillTerms: string[] = [];
  // Add explicit job skills
  for (const s of job.skills || []) {
    jobSkillTerms.push(s.toLowerCase().trim());
  }

  // Also check if candidate skills are mentioned in title or company
  const matchedSkills: string[] = [];
  for (const skill of candidateSkills) {
    const isExplicit = jobSkillTerms.some((js) => js.includes(skill) || skill.includes(js));
    const isInTitle = normalizedTitle.includes(skill);
    if (isExplicit || isInTitle) {
      matchedSkills.push(skill);
    }
  }

  if (matchedSkills.length >= 4) {
    skillsScore = 40;
  } else if (matchedSkills.length === 3) {
    skillsScore = 35;
  } else if (matchedSkills.length === 2) {
    skillsScore = 28;
  } else if (matchedSkills.length === 1) {
    skillsScore = 18;
  } else if (candidateSkills.size > 0 && jobSkillTerms.length === 0) {
    // If job didn't specify skills explicitly on card
    skillsScore = 15;
  }

  if (matchedSkills.length > 0) {
    const displaySkills = matchedSkills.slice(0, 3).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    rationale.push(`Matches ${matchedSkills.length} of your verified skills: ${displaySkills.join(', ')}`);
  }

  // 3. Stipend Requirement (0 - 15 pts)
  let stipendScore = 0;
  const minStipend = profile.preferences.minStipend || 0;

  // Extract digits from stipend string
  const stipendNumbers = (job.stipend.match(/[\d,]+/g) || [])
    .map((n) => parseInt(n.replace(/,/g, ''), 10))
    .filter((n) => n > 500); // filter out small numbers like 1, 2 months

  const maxStipendOffer = stipendNumbers.length > 0 ? Math.max(...stipendNumbers) : 0;
  const isUnpaid = /unpaid/i.test(job.stipend);

  if (minStipend === 0) {
    stipendScore = 15;
  } else if (maxStipendOffer >= minStipend) {
    stipendScore = 15;
    rationale.push(`Stipend (${job.stipend}) meets your minimum (₹${minStipend}/mo)`);
  } else if (maxStipendOffer >= minStipend * 0.75) {
    stipendScore = 10;
  } else if (isUnpaid) {
    stipendScore = 0;
  } else {
    stipendScore = 5;
  }

  // 4. Work Mode & Location (0 - 10 pts)
  let locationScore = 0;
  const preferredMode = profile.preferences.workMode || 'Any';
  const jobLoc = job.location.toLowerCase();
  const candidateLoc = (profile.personal.location || '').toLowerCase();
  const isRemoteJob = jobLoc.includes('work from home') || jobLoc.includes('remote');

  if (preferredMode === 'Any') {
    locationScore = 10;
  } else if (preferredMode === 'Remote' && isRemoteJob) {
    locationScore = 10;
    rationale.push('Matches your preference for Remote work');
  } else if (preferredMode === 'In-Office' && !isRemoteJob) {
    locationScore = 10;
  } else if (candidateLoc && jobLoc.includes(candidateLoc)) {
    locationScore = 10;
    rationale.push(`Matches your location (${profile.personal.location})`);
  } else {
    locationScore = 5;
  }

  const totalScore = Math.min(100, Math.max(0, roleScore + skillsScore + stipendScore + locationScore));

  if (rationale.length === 0) {
    rationale.push('General alignment with your profile and technical background.');
  }

  return {
    score: totalScore,
    rationale,
    breakdown: {
      roleScore,
      skillsScore,
      stipendScore,
      locationScore,
    },
  };
}
