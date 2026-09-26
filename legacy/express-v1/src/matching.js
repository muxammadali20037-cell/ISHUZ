'use strict';

const { educationRank } = require('./constants');

/**
 * Rezyume va vakansiya qanchalik mos kelishini 0..100 oralig'ida baholaydi.
 * Kategoriya bir xil bo'lmasa — 0.
 */
function matchScore(resume, vacancy) {
  if (!resume || !vacancy || resume.category !== vacancy.category) return 0;

  let score = 30; // kategoriya mos
  const spec = String(resume.specialization || '').toLowerCase();
  const pos = String(vacancy.position || '').toLowerCase();
  if (spec && pos && (spec === pos || spec.includes(pos) || pos.includes(spec))) score += 15;

  if (resume.region === vacancy.region || vacancy.employment_type === 'remote') score += 15;

  if (resume.experience_years >= vacancy.experience_min) score += 15;
  else if (resume.experience_years + 1 >= vacancy.experience_min) score += 5;

  if (resume.employment_type === vacancy.employment_type) score += 10;

  if (resume.official === 'any' || vacancy.official === 'any' || resume.official === vacancy.official) score += 5;

  if (educationRank(resume.education) >= educationRank(vacancy.education_min)) score += 5;

  const maxPay = vacancy.salary_to || vacancy.salary_from;
  if (!resume.salary_min || !maxPay || resume.salary_min <= maxPay) score += 5;

  return Math.min(score, 100);
}

module.exports = { matchScore };
