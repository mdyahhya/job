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

  function isRemotePlatformJob(job) {
    if (!job) return false;
    const p = (job.platform || '').toLowerCase();
    return p.includes('remote') || p.includes('arbeitnow') || p.includes('weworkremotely');
  }

  /**
   * Workplace Mode Detection Helpers (Remote vs On-site vs Hybrid)
   */
  function isRemoteJob(job) {
    if (!job) return false;
    if (job.workplace_type && job.workplace_type.toLowerCase() === 'remote') return true;
    if (job.is_remote === true || job.is_remote === 'true') return true;
    const text = ((job.title || '') + ' ' + (job.location || '') + ' ' + (job.description || '')).toLowerCase();
    return /\b(remote|work from home|wfh|telecommute|virtual|anywhere)\b/i.test(text);
  }

  function isOnsiteJob(job) {
    if (!job) return true;
    if (job.workplace_type && (job.workplace_type.toLowerCase() === 'on-site' || job.workplace_type.toLowerCase() === 'onsite')) return true;
    if (isRemoteJob(job)) return false;
    return true;
  }

  function getWorkplaceType(job) {
    if (!job) return 'On-site';
    if (job.workplace_type) {
      const wp = job.workplace_type.toLowerCase();
      if (wp.includes('remote')) return 'Remote';
      if (wp.includes('hybrid')) return 'Hybrid';
      return 'On-site';
    }
    if (isRemoteJob(job)) return 'Remote';
    const text = ((job.title || '') + ' ' + (job.location || '') + ' ' + (job.description || '')).toLowerCase();
    if (/\bhybrid\b/i.test(text)) return 'Hybrid';
    return 'On-site';
  }

  /**
   * Defined Subcategories for all Engineering & IT Disciplines
   */
  const SUBCATEGORY_RULES = [
    { id: 'software', name: 'Software & Full Stack', icon: 'icon-code', primary: 'IT' },
    { id: 'data', name: 'Data Science & Analytics', icon: 'icon-database', primary: 'IT' },
    { id: 'devops', name: 'DevOps & Cloud', icon: 'icon-server', primary: 'IT' },
    { id: 'cyber', name: 'Cybersecurity & InfoSec', icon: 'icon-shield', primary: 'IT' },
    { id: 'civil', name: 'Civil Engineering', icon: 'icon-building', primary: 'Non-IT' },
    { id: 'mechanical', name: 'Mechanical & CAD', icon: 'icon-wrench', primary: 'Non-IT' },
    { id: 'entc', name: 'ENTC & Telecom', icon: 'icon-radio', primary: 'Non-IT' },
    { id: 'electrical', name: 'Electrical & Power', icon: 'icon-lightning', primary: 'Non-IT' },
    { id: 'sales', name: 'Sales & Business Dev', icon: 'icon-chart', primary: 'Non-IT' },
    { id: 'hr_finance', name: 'HR, Finance & Operations', icon: 'icon-briefcase', primary: 'Non-IT' }
  ];

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

    // RULE 1: Sales, B2B & Business Development (ALWAYS Non-IT)
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

    // RULE 2: Civil Engineering & Construction (Non-IT)
    const isCivil = /\b(civil|structural|surveying|revit|site engineer|construction engineer|autocad civil|bim engineer|geotechnical|highway engineer|bridge engineer)\b/i.test(titleLower);
    if (isCivil) {
      return {
        primaryCategory: 'Non-IT',
        subCategory: 'Civil Engineering',
        subCategoryId: 'civil',
        iconId: 'icon-building',
        isInternship: internshipStatus
      };
    }

    // RULE 3: ENTC & Telecommunications / Embedded (Non-IT / Core)
    const isEntc = /\b(entc|telecom|telecommunication|embedded|vlsi|pcb|rf engineer|signal processing|firmware|hardware engineer|microcontroller|dsp|semiconductor|fpga|electronics engineer)\b/i.test(titleLower);
    if (isEntc) {
      return {
        primaryCategory: 'Non-IT',
        subCategory: 'ENTC & Telecom',
        subCategoryId: 'entc',
        iconId: 'icon-radio',
        isInternship: internshipStatus
      };
    }

    // RULE 4: Mechanical, CAD & Mechanics (Non-IT)
    const isMechanical = /\b(mechanical|cad|solidworks|catia|automotive|plant engineer|tooling|machinist|piping|production engineer|manufacturing|hvac|thermal|ansys|cnc|draftsman)\b/i.test(titleLower);
    if (isMechanical) {
      return {
        primaryCategory: 'Non-IT',
        subCategory: 'Mechanical & CAD',
        subCategoryId: 'mechanical',
        iconId: 'icon-wrench',
        isInternship: internshipStatus
      };
    }

    // RULE 5: Electrical, Power Systems & Instrumentation (Non-IT)
    const isElectrical = /\b(electrical|electrician|power systems|substation|switchgear|plc|scada|instrumentation|maintenance engineer|high voltage|transformer)\b/i.test(titleLower);
    if (isElectrical) {
      return {
        primaryCategory: 'Non-IT',
        subCategory: 'Electrical & Power',
        subCategoryId: 'electrical',
        iconId: 'icon-lightning',
        isInternship: internshipStatus
      };
    }

    // RULE 6: Cybersecurity & InfoSec (IT)
    const isCyber = /\b(cyber|cybersecurity|infosec|security engineer|security analyst|ethical hacking|penetration testing|soc analyst|vulnerability|network security|ciso|threat intelligence|incident response)\b/i.test(titleLower);
    if (isCyber) {
      return {
        primaryCategory: 'IT',
        subCategory: 'Cybersecurity & InfoSec',
        subCategoryId: 'cyber',
        iconId: 'icon-shield',
        isInternship: internshipStatus
      };
    }

    // RULE 7: Data Science & Analytics (IT)
    const isData = /\b(data analyst|data analytics|power bi|tableau|data scientist|machine learning|deep learning|data engineer|sql developer|big data|analytics|business intelligence|bi developer)\b/i.test(titleLower);
    if (isData) {
      return {
        primaryCategory: 'IT',
        subCategory: 'Data Science & Analytics',
        subCategoryId: 'data',
        iconId: 'icon-database',
        isInternship: internshipStatus
      };
    }

    // RULE 8: DevOps, Cloud & QA (IT)
    const isDevOps = /\b(devops|cloud|aws|azure|gcp|kubernetes|docker|terraform|sre|site reliability|ci\/cd|infrastructure|jenkins|linux administrator|qa engineer|tester|testing)\b/i.test(titleLower);
    if (isDevOps) {
      return {
        primaryCategory: 'IT',
        subCategory: 'DevOps & Cloud',
        subCategoryId: 'devops',
        iconId: 'icon-server',
        isInternship: internshipStatus
      };
    }

    // RULE 9: HR, Recruitment, Finance & Operations (Non-IT)
    const isHrFinanceOps = /\b(hr|human resources|talent acquisition|recruiter|finance|accountant|fp&a|payroll|accounts|operations|supply chain|logistics|warehouse|procurement|executive assistant|bpo)\b/i.test(titleLower);
    if (isHrFinanceOps) {
      return {
        primaryCategory: 'Non-IT',
        subCategory: 'HR, Finance & Operations',
        subCategoryId: 'hr_finance',
        iconId: 'icon-briefcase',
        isInternship: internshipStatus
      };
    }

    // RULE 10: Software Engineering, Web & Full Stack (IT)
    const isSoftware = /\b(software|developer|engineer|full stack|fullstack|backend|frontend|python|java|react|angular|node|golang|c\+\+|\.net|flutter|android|ios|web|programmer|coder|architect)\b/i.test(titleLower);
    if (isSoftware) {
      return {
        primaryCategory: 'IT',
        subCategory: 'Software & Full Stack',
        subCategoryId: 'software',
        iconId: 'icon-code',
        isInternship: internshipStatus
      };
    }

    // Fallback: Check description for software technologies
    if (/\b(python|react|java|spring boot|django|fastapi|golang|kubernetes|docker|fullstack|backend developer)\b/i.test(descLower) && !/\b(sales|b2b|cold call)\b/i.test(descLower)) {
      return {
        primaryCategory: 'IT',
        subCategory: 'Software & Full Stack',
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
    jobType = 'all',
    workplace = 'all'
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
      if (platform === 'remote' && !isRemotePlatformJob(job)) return false;

      // 2. Job Type Filter (Jobs vs Internships)
      const intern = isInternship(job);
      if (jobType === 'internship' && !intern) return false;
      if (jobType === 'job' && intern) return false;

      // 2b. Workplace Filter (Remote vs On-site)
      if (workplace && workplace !== 'all') {
        const wp = getWorkplaceType(job).toLowerCase();
        if (workplace === 'remote' && wp !== 'remote') return false;
        if (workplace === 'onsite' && wp !== 'on-site' && wp !== 'hybrid') return false;
      }

      // 3. Category Filter
      if (category && category !== 'all') {
        if (category === 'it' && catInfo.primaryCategory !== 'IT') return false;
        if (category === 'non-it' && catInfo.primaryCategory !== 'Non-IT') return false;
        if (category === 'electrical' && catInfo.subCategoryId !== 'electrical') return false;
        if (category === 'sales' && catInfo.subCategoryId !== 'sales') return false;
        if (category === 'civil' && catInfo.subCategoryId !== 'civil') return false;
        if (category === 'mechanical' && catInfo.subCategoryId !== 'mechanical') return false;
        if (category === 'entc' && catInfo.subCategoryId !== 'entc') return false;
        if (category === 'cyber' && catInfo.subCategoryId !== 'cyber') return false;
        if (category === 'data' && catInfo.subCategoryId !== 'data') return false;
        if (category === 'devops' && catInfo.subCategoryId !== 'devops') return false;
        if (category === 'other' && catInfo.primaryCategory !== 'Other') return false;
      }

      // 4. Strict Keyword Matching
      if (queryWords.length > 0) {
        const title = (job.title || '').toLowerCase();
        const company = (job.company || '').toLowerCase();
        const location = (job.location || '').toLowerCase();
        const desc = (job.description || '').toLowerCase();
        const cat = (catInfo.subCategory || '').toLowerCase();

        // Check if query is looking for a software technology (e.g. Python, React, Development)
        const isTechQuery = queryWords.some(w => TECH_STACK_TERMS.includes(w));
        if (isTechQuery && catInfo.primaryCategory !== 'IT') {
          return false;
        }

        // Specifically block Sales & Business Development roles when searching for "developer" or "development"
        const isDevQuery = queryWords.some(w => ['developer', 'development', 'dev', 'software', 'programmer'].includes(w));
        const isExplicitSalesQuery = queryWords.some(w => ['sales', 'b2b', 'business', 'bdm', 'sdr'].includes(w));
        if (isDevQuery && !isExplicitSalesQuery && catInfo.subCategoryId === 'sales') {
          return false;
        }

        // Check if all query words or their engineering aliases match
        const allWordsMatch = queryWords.every(word => {
          // Normalize developer <-> development
          if (word === 'development' || word === 'developer') {
            if (title.includes('develop') || desc.includes('developer') || desc.includes('development')) {
              return true;
            }
          }

          // Engineering aliases
          if (word === 'civil' && (title.includes('civil') || cat.includes('civil'))) return true;
          if ((word === 'entc' || word === 'telecom') && (title.includes('telecom') || title.includes('electronics') || title.includes('embedded') || title.includes('vlsi') || cat.includes('entc'))) return true;
          if ((word === 'mechanics' || word === 'mechanical') && (title.includes('mechanic') || title.includes('cad') || cat.includes('mechanical'))) return true;
          if ((word === 'cyber' || word === 'cybersecurity') && (title.includes('cyber') || title.includes('security') || cat.includes('cyber'))) return true;
          if (word === 'devops' && (title.includes('devops') || title.includes('cloud') || cat.includes('devops'))) return true;
          if (word === 'data' && (title.includes('data') || cat.includes('data'))) return true;
          if ((word === 'analysis' || word === 'analyst' || word === 'analytics') && (title.includes('analy') || cat.includes('data'))) return true;

          if (title.includes(word) || company.includes(word) || location.includes(word) || cat.includes(word)) {
            return true;
          }
          // Whole-word match in description
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
      civil: 0,
      mechanical: 0,
      entc: 0,
      cyber: 0,
      data: 0,
      devops: 0,
      other: 0,
      internships: 0,
      linkedin: 0
    };

    if (!Array.isArray(jobs)) return stats;

    jobs.forEach(job => {
      if (platform === 'linkedin' && !isLinkedInJob(job)) return;
      if (platform === 'indeed' && !isIndeedJob(job)) return;

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

      if (stats[cat.subCategoryId] !== undefined) {
        stats[cat.subCategoryId]++;
      }
    });

    return stats;
  }

  return {
    SUBCATEGORY_RULES,
    categorizeJob,
    filterJobs,
    getCategoryStats,
    isInternship,
    isLinkedInJob,
    isIndeedJob,
    isRemotePlatformJob,
    isRemoteJob,
    isOnsiteJob,
    getWorkplaceType
  };
})();

if (typeof window !== 'undefined') {
  window.JobSorter = JobSorter;
}
if (typeof module !== 'undefined') {
  module.exports = JobSorter;
}

