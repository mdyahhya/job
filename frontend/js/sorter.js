/**
 * Dominal Technology Jobs - Rule-Based Sorter & Categorization Engine
 * Deterministic title-first keyword matching with strict role separation.
 * Supports dedicated filters for:
 * 1. Category (IT, Non-IT, Electrical, Sales, Other)
 * 2. Platform (LinkedIn Only, Indeed Only, All Platforms)
 * 3. Job Type (Full-time Jobs vs Internships & Trainee)
 * Strictly zero emojis.
 */

const JobSorter = (() => {

  /**
   * Internship Detection Helper (Whole-word regex to avoid false positives like 'international')
   */
  function isInternship(job) {
    if (!job) return false;
    const title = (job.title || '').toLowerCase();
    const type = (job.job_type || '').toLowerCase();
    const internPattern = /\b(intern|internship|trainee|apprentice)\b/i;
    return internPattern.test(title) || internPattern.test(type);
  }

  /**
   * Platform Detection Helpers
   */
  function isLinkedInJob(job) {
    if (!job) return false;
    const link = (job.job_link || '').toLowerCase();
    const platform = (job.platform || '').toLowerCase();
    return platform === 'linkedin' || link.includes('linkedin.com');
  }

  function isIndeedJob(job) {
    if (!job) return false;
    const link = (job.job_link || '').toLowerCase();
    const platform = (job.platform || '').toLowerCase();
    return platform === 'indeed' || link.includes('indeed.com');
  }

  /**
   * Title-First Strict Categorization
   * Sales & Marketing are strictly isolated from IT/Software Development.
   */
  function categorizeJob(job) {
    if (!job) {
      return {
        primaryCategory: 'Other',
        subCategory: 'General',
        subCategoryId: 'other',
        iconId: 'icon-briefcase',
        isInternship: false
      };
    }

    const titleLower = (job.title || '').toLowerCase();
    const descLower = (job.description || '').toLowerCase();
    const internshipStatus = isInternship(job);

    // RULE 1: Sales, B2B & Business Development (ALWAYS Non-IT, even if title contains 'IT' or 'Software')
    // E.g., 'IT Sales Executive' or 'Software Sales' is a Sales role, NOT a developer role.
    const isSales = /\b(sales|business development|b2b|account executive|inside sales|tele-sales|field sales|lead generation|sdr|bdr|commercial|retail|selling|counter sales)\b/i.test(titleLower);
    if (isSales) {
      return {
        primaryCategory: 'Non-IT',
        subCategory: 'Sales & Business Dev',
        subCategoryId: 'sales',
        iconId: 'icon-chart',
        isInternship: internshipStatus
      };
    }

    // RULE 2: Electrical, Hardware, VLSI & Power Systems (ALWAYS Non-IT)
    const isElectrical = /\b(electrical|electrician|power systems|substation|switchgear|embedded|hardware|vlsi|pcb|electronics|circuit design|maintenance engineer)\b/i.test(titleLower);
    if (isElectrical) {
      return {
        primaryCategory: 'Non-IT',
        subCategory: 'Electrical & Hardware',
        subCategoryId: 'electrical',
        iconId: 'icon-lightning',
        isInternship: internshipStatus
      };
    }

    // RULE 3: Mechanical, CAD, Automotive, Civil & Manufacturing (Non-IT)
    const isMechanical = /\b(mechanical|cad|solidworks|catia|automotive|plant engineer|tooling|machinist|piping|production engineer|manufacturing)\b/i.test(titleLower);
    if (isMechanical) {
      return {
        primaryCategory: 'Non-IT',
        subCategory: 'Mechanical & CAD',
        subCategoryId: 'mechanical',
        iconId: 'icon-wrench',
        isInternship: internshipStatus
      };
    }

    // RULE 4: HR, Recruitment, Finance, Accounting & Operations (Non-IT)
    const isHrFinanceOps = /\b(hr|human resources|talent acquisition|recruiter|finance|accountant|fp&a|payroll|accounts|operations|supply chain|logistics|warehouse|civil|interior|site engineer|procurement|executive assistant|bpo)\b/i.test(titleLower);
    if (isHrFinanceOps) {
      return {
        primaryCategory: 'Non-IT',
        subCategory: 'HR, Finance & Operations',
        subCategoryId: 'hr_finance',
        iconId: 'icon-briefcase',
        isInternship: internshipStatus
      };
    }

    // RULE 5: Software Engineering, AI, Cloud & Tech Roles (IT)
    const isSoftware = /\b(software|developer|engineer|full stack|fullstack|backend|frontend|python|java|react|angular|node|ai|machine learning|data scientist|data engineer|qa|tester|devops|cloud|aws|azure|golang|c\+\+|\.net|flutter|android|ios|web|programmer|coder|architect)\b/i.test(titleLower);
    if (isSoftware) {
      let sub = 'Software Engineering';
      let subId = 'software';
      let icon = 'icon-code';

      if (/\b(ai|machine learning|deep learning|nlp|llm|data scientist|data engineer|generative ai)\b/i.test(titleLower)) {
        sub = 'AI & Data Science';
        subId = 'ai_data';
        icon = 'icon-cpu';
      } else if (/\b(devops|cloud|qa|tester|testing|kubernetes|docker|terraform|infrastructure)\b/i.test(titleLower)) {
        sub = 'DevOps & QA';
        subId = 'devops_qa';
        icon = 'icon-server';
      }

      return {
        primaryCategory: 'IT',
        subCategory: sub,
        subCategoryId: subId,
        iconId: icon,
        isInternship: internshipStatus
      };
    }

    // Fallback: If title is generic (e.g. 'Project Lead', 'Consultant'), check description for strong signals
    if (/\b(python|react|java|spring boot|django|fastapi|golang|kubernetes|docker|fullstack|backend developer)\b/i.test(descLower) && !/\b(sales|b2b|cold call)\b/i.test(descLower)) {
      return {
        primaryCategory: 'IT',
        subCategory: 'Software Engineering',
        subCategoryId: 'software',
        iconId: 'icon-code',
        isInternship: internshipStatus
      };
    }

    return {
      primaryCategory: 'Other',
      subCategory: 'General',
      subCategoryId: 'other',
      iconId: 'icon-briefcase',
      isInternship: internshipStatus
    };
  }

  /**
   * Filter job list by search query, category, platform, and job type.
   */
  function filterJobs(jobs, {
    query = '',
    category = 'all',
    platform = 'all',
    jobType = 'all'
  } = {}) {
    if (!Array.isArray(jobs)) return [];

    const cleanQuery = query.trim().toLowerCase();
    const queryWords = cleanQuery.split(/[\s,+/]+/).filter(w => w.length > 1);

    // List of software-specific technology keywords
    const TECH_STACK_TERMS = [
      'python', 'java', 'react', 'node', 'django', 'fastapi', 'angular', 'vue',
      'golang', 'c++', 'c#', '.net', 'aws', 'docker', 'devops', 'backend',
      'frontend', 'fullstack', 'full stack', 'developer', 'development', 'software',
      'programmer', 'coding', 'web developer'
    ];

    return jobs.filter(job => {
      const catInfo = categorizeJob(job);

      // 1. Platform Filter
      if (platform === 'linkedin' && !isLinkedInJob(job)) return false;
      if (platform === 'indeed' && !isIndeedJob(job)) return false;

      // 2. Job Type Filter (Jobs vs Internships)
      const intern = isInternship(job);
      if (jobType === 'internship' && !intern) return false;
      if (jobType === 'job' && intern) return false;

      // 3. Category Filter
      if (category && category !== 'all') {
        if (category === 'it' && catInfo.primaryCategory !== 'IT') return false;
        if (category === 'non-it' && catInfo.primaryCategory !== 'Non-IT') return false;
        if (category === 'electrical' && catInfo.subCategoryId !== 'electrical') return false;
        if (category === 'sales' && catInfo.subCategoryId !== 'sales') return false;
        if (category === 'other' && catInfo.primaryCategory !== 'Other') return false;
      }

      // 4. Strict Keyword Matching
      if (queryWords.length > 0) {
        const title = (job.title || '').toLowerCase();
        const company = (job.company || '').toLowerCase();
        const location = (job.location || '').toLowerCase();
        const desc = (job.description || '').toLowerCase();

        // Check if query is looking for a software technology (e.g. Python, React, Development)
        const isTechQuery = queryWords.some(w => TECH_STACK_TERMS.includes(w));
        if (isTechQuery && catInfo.primaryCategory !== 'IT') {
          // Never match a non-IT job (like Sales, HR, Civil) for a tech stack search
          return false;
        }

        // Specifically block Sales & Business Development roles when searching for "developer" or "development"
        const isDevQuery = queryWords.some(w => ['developer', 'development', 'dev', 'software', 'programmer'].includes(w));
        const isExplicitSalesQuery = queryWords.some(w => ['sales', 'b2b', 'business', 'bdm', 'sdr'].includes(w));
        if (isDevQuery && !isExplicitSalesQuery && catInfo.subCategoryId === 'sales') {
          return false;
        }

        // Each query word must match in title, company, location, or strictly in description
        const allWordsMatch = queryWords.every(word => {
          // Normalize developer <-> development
          if (word === 'development' || word === 'developer') {
            if (title.includes('develop') || desc.includes('developer') || desc.includes('development')) {
              return true;
            }
          }

          if (title.includes(word) || company.includes(word) || location.includes(word)) {
            return true;
          }
          // Whole-word match in description to prevent substring collisions
          const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          return wordRegex.test(desc);
        });

        if (!allWordsMatch) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Calculate aggregated category statistics.
   */
  function getCategoryStats(jobs, { platform = 'all', jobType = 'all' } = {}) {
    const stats = {
      total: 0,
      it: 0,
      nonIt: 0,
      electrical: 0,
      sales: 0,
      other: 0,
      internships: 0,
      linkedin: 0
    };

    if (!Array.isArray(jobs)) return stats;

    jobs.forEach(job => {
      // Platform filter consideration
      if (platform === 'linkedin' && !isLinkedInJob(job)) return;
      if (platform === 'indeed' && !isIndeedJob(job)) return;

      // Job type filter consideration
      const intern = isInternship(job);
      if (jobType === 'internship' && !intern) return;
      if (jobType === 'job' && intern) return;

      stats.total++;
      if (intern) stats.internships++;
      if (isLinkedInJob(job)) stats.linkedin++;

      const cat = categorizeJob(job);
      if (cat.primaryCategory === 'IT') stats.it++;
      else if (cat.primaryCategory === 'Non-IT') stats.nonIt++;
      else stats.other++;

      if (cat.subCategoryId === 'electrical') stats.electrical++;
      if (cat.subCategoryId === 'sales') stats.sales++;
    });

    return stats;
  }

  return {
    categorizeJob,
    filterJobs,
    getCategoryStats,
    isInternship,
    isLinkedInJob,
    isIndeedJob
  };
})();

if (typeof window !== 'undefined') {
  window.JobSorter = JobSorter;
}
if (typeof module !== 'undefined') {
  module.exports = JobSorter;
}

