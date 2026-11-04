/**
 * Dominal Technology Jobs - LinkedIn Post & Caption Engine
 * Generates pre-formed text posts for LinkedIn with professional emojis,
 * clean line spacing, customizable heading from settings, dynamic field omission,
 * automatic clipboard copy, and activity tracking.
 */

const LinkedInManager = (() => {
  const STORAGE_KEYS = {
    HEADING: 'dominal_li_heading',
    TEMPLATE: 'dominal_li_template',
    HASHTAGS: 'dominal_li_hashtags',
    SIGNATURE: 'dominal_li_signature',
    POSTED_LOG: 'dominal_li_posted_log'
  };

  const DEFAULT_CONFIG = {
    heading: '🚨 JOB POST ALERT 🚨',
    signature: 'Follow for daily verified job updates & career opportunities.',
    hashtags: '#JobAlert #Hiring #CareerOpportunity #Jobs #NowHiring #TechJobs',
    template: `{heading}

💼 Role: {job_title}
🏢 Company: {company}
📍 Location: {location}
💻 Workplace: {workplace}
🎓 Qualification: {experience}
💰 Compensation: {salary}
🏷️ Category: {category}

🔗 Apply Here:
👉 {job_link}

{hashtags}
{signature}`
  };

  function safeGet(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch (e) {}
    return null;
  }

  function safeSet(key, val) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
      }
    } catch (e) {}
  }

  function safeRemove(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (e) {}
  }

  /**
   * Get configured heading.
   */
  function getHeading() {
    const saved = safeGet(STORAGE_KEYS.HEADING);
    return saved !== null && saved !== undefined && saved.trim() !== ''
      ? saved.trim()
      : DEFAULT_CONFIG.heading;
  }

  /**
   * Set configured heading.
   */
  function setHeading(heading) {
    if (typeof heading === 'string') {
      safeSet(STORAGE_KEYS.HEADING, heading.trim());
    }
  }

  /**
   * Get hashtags.
   */
  function getHashtags() {
    const saved = safeGet(STORAGE_KEYS.HASHTAGS);
    return saved !== null && saved !== undefined ? saved : DEFAULT_CONFIG.hashtags;
  }

  /**
   * Set hashtags.
   */
  function setHashtags(hashtags) {
    if (typeof hashtags === 'string') {
      safeSet(STORAGE_KEYS.HASHTAGS, hashtags.trim());
    }
  }

  /**
   * Get signature.
   */
  function getSignature() {
    const saved = safeGet(STORAGE_KEYS.SIGNATURE);
    return saved !== null && saved !== undefined ? saved : DEFAULT_CONFIG.signature;
  }

  /**
   * Set signature.
   */
  function setSignature(signature) {
    if (typeof signature === 'string') {
      safeSet(STORAGE_KEYS.SIGNATURE, signature.trim());
    }
  }

  /**
   * Get template string.
   */
  function getTemplate() {
    const saved = safeGet(STORAGE_KEYS.TEMPLATE);
    return saved ? saved : DEFAULT_CONFIG.template;
  }

  /**
   * Set template string.
   */
  function setTemplate(template) {
    if (typeof template === 'string') {
      safeSet(STORAGE_KEYS.TEMPLATE, template);
    }
  }

  /**
   * Reset all LinkedIn settings to defaults.
   */
  function resetDefaults() {
    safeRemove(STORAGE_KEYS.HEADING);
    safeRemove(STORAGE_KEYS.TEMPLATE);
    safeRemove(STORAGE_KEYS.HASHTAGS);
    safeRemove(STORAGE_KEYS.SIGNATURE);
  }

  /**
   * Format pre-formed LinkedIn post caption from job data.
   * If a field is empty, falsey, undefined, or missing (e.g. salary when not mentioned),
   * that entire line is omitted cleanly without leaving blank placeholder lines.
   * Includes professional emojis and spacing between sections.
   */
  function formatPost(job, customTemplate = null, customHeading = null, customSignature = null, customHashtags = null) {
    if (!job) return '';

    const template = customTemplate !== null ? customTemplate : getTemplate();
    const heading = customHeading !== null ? customHeading : getHeading();
    const signature = customSignature !== null ? customSignature : getSignature();
    const hashtags = customHashtags !== null ? customHashtags : getHashtags();

    const workplaceVal = (job.workplace_type || (typeof JobSorter !== 'undefined' ? JobSorter.getWorkplaceType(job) : '') || '').trim();
    const categoryVal = (job.subCategory || job.primaryCategory || job.job_type || '').trim();
    const experienceVal = (job.qualification || job.experience || '').trim();

    // Check if salary is actually mentioned and not empty/placeholder
    let salaryVal = (job.salary || '').trim();
    if (salaryVal.toLowerCase() === 'unspecified' || salaryVal.toLowerCase() === 'n/a') {
      salaryVal = '';
    }

    // Mapping of placeholders to actual values
    const fieldMap = {
      '{heading}': heading.trim(),
      '{job_title}': (job.title || '').trim(),
      '{company}': (job.company || '').trim(),
      '{location}': (job.location || '').trim(),
      '{workplace}': workplaceVal,
      '{experience}': experienceVal,
      '{qualification}': experienceVal,
      '{salary}': salaryVal,
      '{category}': categoryVal,
      '{job_link}': (job.job_link || '').trim(),
      '{hashtags}': hashtags.trim(),
      '{signature}': signature.trim(),
      '{description}': (job.description ? job.description.substring(0, 200).trim() + (job.description.length > 200 ? '...' : '') : '')
    };

    // Split template into lines and process line by line
    const lines = template.split('\n');
    const parsedLines = [];

    for (const line of lines) {
      let currentLine = line;
      let lineShouldBeDropped = false;

      // Check each placeholder in this line
      for (const [placeholder, value] of Object.entries(fieldMap)) {
        if (currentLine.includes(placeholder)) {
          if (!value) {
            // Missing field: entire line containing this placeholder must be omitted
            lineShouldBeDropped = true;
            break;
          } else {
            currentLine = currentLine.split(placeholder).join(value);
          }
        }
      }

      if (!lineShouldBeDropped) {
        parsedLines.push(currentLine);
      }
    }

    // Clean up consecutive blank lines (max 1 blank line between blocks) and trim
    const cleaned = parsedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return cleaned;
  }

  /**
   * Copy text to system clipboard with fallback support for all browser environments
   */
  async function copyToClipboard(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn('Clipboard API error, attempting fallback:', err);
    }

    // Fallback using textarea execCommand
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    } catch (err) {
      console.error('Fallback clipboard copy failed:', err);
      return false;
    }
  }

  /**
   * Get LinkedIn Posted Activity Log from localStorage.
   */
  function getPostedLog() {
    try {
      const data = safeGet(STORAGE_KEYS.POSTED_LOG);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading LinkedIn posted log:', e);
      return [];
    }
  }

  /**
   * Check if a job ID has been posted to LinkedIn / caption generated.
   */
  function isJobPosted(jobId) {
    if (!jobId) return false;
    const log = getPostedLog();
    return log.some(item => item.jobId === jobId);
  }

  /**
   * Record a job into the LinkedIn posted activity log.
   */
  function recordPostedJob(job, postText) {
    if (!job || !job.id) return null;
    const log = getPostedLog();
    const existingIndex = log.findIndex(item => item.jobId === job.id);

    const logEntry = {
      jobId: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      job_link: job.job_link,
      salary: job.salary,
      experience: job.experience,
      workplace_type: job.workplace_type,
      timestamp: new Date().toISOString(),
      formattedDate: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(new Date()),
      captionSnippet: (postText || '').substring(0, 140) + ((postText || '').length > 140 ? '...' : '')
    };

    if (existingIndex >= 0) {
      log.splice(existingIndex, 1);
    }
    log.unshift(logEntry);

    // Keep up to 250 most recent items
    const trimmed = log.slice(0, 250);
    safeSet(STORAGE_KEYS.POSTED_LOG, JSON.stringify(trimmed));

    // Dispatch custom event for UI reactivity across all components
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('dominal:job-linkedin-posted', { detail: logEntry }));
    }
    return logEntry;
  }

  /**
   * Remove a single entry from LinkedIn posted log.
   */
  function removePostedLogEntry(jobId) {
    const log = getPostedLog().filter(item => item.jobId !== jobId);
    safeSet(STORAGE_KEYS.POSTED_LOG, JSON.stringify(log));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('dominal:job-linkedin-updated'));
    }
  }

  /**
   * Clear the entire LinkedIn posted log.
   */
  function clearPostedLog() {
    safeRemove(STORAGE_KEYS.POSTED_LOG);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('dominal:job-linkedin-updated'));
    }
  }

  return {
    getHeading,
    setHeading,
    getHashtags,
    setHashtags,
    getSignature,
    setSignature,
    getTemplate,
    setTemplate,
    resetDefaults,
    formatPost,
    copyToClipboard,
    getPostedLog,
    isJobPosted,
    recordPostedJob,
    removePostedLogEntry,
    clearPostedLog,
    DEFAULT_CONFIG
  };
})();

if (typeof window !== 'undefined') {
  window.LinkedInManager = LinkedInManager;
}
if (typeof module !== 'undefined') {
  module.exports = LinkedInManager;
}
