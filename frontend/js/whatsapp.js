/**
 * Dominal Technology Jobs - WhatsApp Sharing & Templating Engine
 * Handles message templating, missing field omissions, clean plain-text output (NO EMOJIS),
 * wa.me link generation, and local sent history logging.
 */

const WhatsAppManager = (() => {
  const STORAGE_KEYS = {
    PHONE_NUMBER: 'dominal_wa_number',
    SHARE_MODE: 'dominal_wa_share_mode',
    TEMPLATE: 'dominal_wa_template',
    SIGNATURE: 'dominal_wa_signature',
    SENT_LOG: 'dominal_sent_log'
  };

  const DEFAULT_CONFIG = {
    phoneNumber: '918766882442',
    shareMode: 'choose_recipient', // 'choose_recipient' (default, opens WhatsApp chat list) or 'specific_number'
    signature: 'Dominal Technology Jobs',
    template: `*Job Opening Update*

Company: {company}
Role: {job_title}
Category: {job_type}
Workplace: {workplace}
Location: {location}
Link: {job_link}

Shared via {signature}`
  };

  /**
   * Get configured WhatsApp phone number.
   */
  function getPhoneNumber() {
    const saved = localStorage.getItem(STORAGE_KEYS.PHONE_NUMBER);
    return (saved && saved.trim()) ? saved.trim().replace(/[^0-9]/g, '') : DEFAULT_CONFIG.phoneNumber;
  }

  /**
   * Set WhatsApp phone number.
   */
  function setPhoneNumber(number) {
    const cleaned = (number || '').trim().replace(/[^0-9]/g, '');
    if (cleaned) {
      localStorage.setItem(STORAGE_KEYS.PHONE_NUMBER, cleaned);
    }
  }

  /**
   * Get WhatsApp share mode ('choose_recipient' or 'specific_number')
   * Default: 'choose_recipient' (one-step direct sharing to group/chat list)
   */
  function getShareMode() {
    const saved = localStorage.getItem(STORAGE_KEYS.SHARE_MODE);
    if (saved === 'specific_number' || saved === 'choose_recipient') {
      return saved;
    }
    return DEFAULT_CONFIG.shareMode;
  }

  /**
   * Set WhatsApp share mode
   */
  function setShareMode(mode) {
    if (mode === 'specific_number' || mode === 'choose_recipient') {
      localStorage.setItem(STORAGE_KEYS.SHARE_MODE, mode);
    }
  }

  /**
   * Get template string.
   */
  function getTemplate() {
    const saved = localStorage.getItem(STORAGE_KEYS.TEMPLATE);
    return saved ? saved : DEFAULT_CONFIG.template;
  }

  /**
   * Set template string.
   */
  function setTemplate(template) {
    if (typeof template === 'string') {
      localStorage.setItem(STORAGE_KEYS.TEMPLATE, template);
    }
  }

  /**
   * Get signature.
   */
  function getSignature() {
    const saved = localStorage.getItem(STORAGE_KEYS.SIGNATURE);
    return saved ? saved : DEFAULT_CONFIG.signature;
  }

  /**
   * Set signature.
   */
  function setSignature(signature) {
    if (typeof signature === 'string') {
      localStorage.setItem(STORAGE_KEYS.SIGNATURE, signature);
    }
  }

  /**
   * Reset settings to defaults.
   */
  function resetDefaults() {
    localStorage.removeItem(STORAGE_KEYS.PHONE_NUMBER);
    localStorage.removeItem(STORAGE_KEYS.SHARE_MODE);
    localStorage.removeItem(STORAGE_KEYS.TEMPLATE);
    localStorage.removeItem(STORAGE_KEYS.SIGNATURE);
  }

  /**
   * Format message from template and job data.
   * If a field is empty, falsey or undefined, that entire line is omitted.
   * Strictly no emojis are injected.
   */
  function formatMessage(job, customTemplate = null, customSignature = null) {
    const template = customTemplate !== null ? customTemplate : getTemplate();
    const signature = customSignature !== null ? customSignature : getSignature();

    const workplaceVal = (job.workplace_type || (typeof JobSorter !== 'undefined' ? JobSorter.getWorkplaceType(job) : '') || '').trim();

    // Mapping of placeholders to actual values
    const fieldMap = {
      '{company}': (job.company || '').trim(),
      '{job_title}': (job.title || '').trim(),
      '{location}': (job.location || '').trim(),
      '{job_type}': (job.job_type || job.subCategory || job.primaryCategory || '').trim(),
      '{workplace}': workplaceVal,
      '{job_link}': (job.job_link || '').trim(),
      '{experience}': (job.experience || '').trim(),
      '{salary}': (job.salary || '').trim(),
      '{signature}': signature.trim()
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

    // Clean up consecutive blank lines (max 1 blank line)
    const cleaned = parsedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return cleaned;
  }

  /**
   * Build wa.me sharing URL.
   * Mode 1: "choose_recipient" (default) -> https://wa.me/?text=<encoded>
   * Mode 2: "specific_number" -> https://wa.me/<number>?text=<encoded>
   */
  function buildShareUrl(job, customTemplate = null) {
    const mode = getShareMode();
    const message = formatMessage(job, customTemplate);
    const encoded = encodeURIComponent(message);
    if (mode === 'specific_number') {
      const phone = getPhoneNumber();
      return `https://wa.me/${phone}?text=${encoded}`;
    } else {
      // Direct recipient selection in WhatsApp (no specific number pre-filled)
      return `https://wa.me/?text=${encoded}`;
    }
  }

  /**
   * Get Sent Activity Log array from localStorage.
   */
  function getSentLog() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SENT_LOG);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading sent log:', e);
      return [];
    }
  }

  /**
   * Check if a job ID has been shared.
   */
  function isJobSent(jobId) {
    if (!jobId) return false;
    const log = getSentLog();
    return log.some(item => item.jobId === jobId);
  }

  /**
   * Record a shared job into activity log.
   */
  function recordSentJob(job, messageText) {
    const log = getSentLog();
    const existingIndex = log.findIndex(item => item.jobId === job.id);

    const logEntry = {
      jobId: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      timestamp: new Date().toISOString(),
      formattedDate: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(new Date()),
      phoneNumber: getPhoneNumber(),
      messageSnippet: messageText.substring(0, 120) + (messageText.length > 120 ? '...' : '')
    };

    if (existingIndex >= 0) {
      log.splice(existingIndex, 1);
    }
    log.unshift(logEntry);

    // Keep up to 200 most recent items
    const trimmed = log.slice(0, 200);
    localStorage.setItem(STORAGE_KEYS.SENT_LOG, JSON.stringify(trimmed));

    // Dispatch event for UI reactivity
    window.dispatchEvent(new CustomEvent('dominal:job-shared', { detail: logEntry }));
    return logEntry;
  }

  /**
   * Remove a single entry from sent log.
   */
  function removeSentLogEntry(jobId) {
    const log = getSentLog().filter(item => item.jobId !== jobId);
    localStorage.setItem(STORAGE_KEYS.SENT_LOG, JSON.stringify(log));
    window.dispatchEvent(new CustomEvent('dominal:job-shared-updated'));
  }

  /**
   * Clear the entire sent log.
   */
  function clearSentLog() {
    localStorage.removeItem(STORAGE_KEYS.SENT_LOG);
    window.dispatchEvent(new CustomEvent('dominal:job-shared-updated'));
  }

  /**
   * Execute share action:
   * 1. Generates wa.me URL
   * 2. Records in sent log
   * 3. Opens WhatsApp window
   */
  function shareJob(job) {
    const message = formatMessage(job);
    const url = buildShareUrl(job);
    recordSentJob(job, message);

    // Open WhatsApp
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return {
    getPhoneNumber,
    setPhoneNumber,
    getShareMode,
    setShareMode,
    getTemplate,
    setTemplate,
    getSignature,
    setSignature,
    resetDefaults,
    formatMessage,
    buildShareUrl,
    shareJob,
    getSentLog,
    isJobSent,
    recordSentJob,
    removeSentLogEntry,
    clearSentLog,
    DEFAULT_CONFIG
  };
})();

if (typeof window !== 'undefined') {
  window.WhatsAppManager = WhatsAppManager;
}
if (typeof module !== 'undefined') {
  module.exports = WhatsAppManager;
}
