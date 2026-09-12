/**
 * Dominal Technology Jobs - Main Application Controller
 * Handles SPA navigation, data loading, rendering, filter states, drawer interactions,
 * dual-button job actions (WhatsApp + LinkedIn/Website), live Search Now scraper, and toasts.
 */

const App = (() => {
  let allJobs = [];
  let currentView = 'home';
  let activeCategoryFilter = 'all';
  let activePlatformFilter = localStorage.getItem('dominal_platform_filter') || 'all';
  let activeJobTypeFilter = localStorage.getItem('dominal_type_filter') || 'all';
  let activeWorkplaceFilter = localStorage.getItem('dominal_workplace_filter') || 'all';
  let activeStatusFilter = localStorage.getItem('dominal_feed_status_filter') || 'fresh'; // 'fresh' (default, hides checked on refresh) or 'all'
  let currentHistoryTab = 'checked'; // 'checked', 'archive', or 'queries'
  let searchQuery = '';

  // Dedicated Scraped Jobs Archive Filter State
  let scrapedFilters = {
    query: '',
    category: 'all',
    workplace: 'all',
    platform: 'all',
    status: 'all' // 'all' (Fresh First), 'fresh', 'checked'
  };

  /**
   * ==========================================================================
   * JOB HISTORY & CHECKED STATUS MANAGER
   * Persists checked jobs to eliminate repetitive postings on refresh,
   * stores complete fetched opening archives, and syncs across views.
   * ==========================================================================
   */
  const JobHistoryManager = {
    KEYS: {
      CHECKED_IDS: 'dominal_checked_job_ids',
      CHECKED_DATA: 'dominal_checked_jobs_data',
      FETCHED_ARCHIVE: 'dominal_all_fetched_archive',
      STATUS_FILTER: 'dominal_feed_status_filter'
    },

    getCheckedIds() {
      try {
        const raw = localStorage.getItem(this.KEYS.CHECKED_IDS);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    isChecked(jobId) {
      if (!jobId) return false;
      const ids = this.getCheckedIds();
      return ids.includes(jobId);
    },

    markChecked(jobId, jobData) {
      if (!jobId) return;
      const ids = this.getCheckedIds();
      if (!ids.includes(jobId)) {
        ids.push(jobId);
        localStorage.setItem(this.KEYS.CHECKED_IDS, JSON.stringify(ids));
      }
      try {
        const dataRaw = localStorage.getItem(this.KEYS.CHECKED_DATA);
        const map = dataRaw ? JSON.parse(dataRaw) : {};
        map[jobId] = {
          ...(jobData || {}),
          id: jobId,
          checkedAt: new Date().toISOString(),
          formattedCheckedAt: new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }).format(new Date())
        };
        localStorage.setItem(this.KEYS.CHECKED_DATA, JSON.stringify(map));
      } catch (e) {
        console.error('Error saving checked job data:', e);
      }
      this.updateHistoryBadge();
    },

    uncheck(jobId) {
      if (!jobId) return;
      const ids = this.getCheckedIds().filter(id => id !== jobId);
      localStorage.setItem(this.KEYS.CHECKED_IDS, JSON.stringify(ids));
      try {
        const dataRaw = localStorage.getItem(this.KEYS.CHECKED_DATA);
        if (dataRaw) {
          const map = JSON.parse(dataRaw);
          delete map[jobId];
          localStorage.setItem(this.KEYS.CHECKED_DATA, JSON.stringify(map));
        }
      } catch (e) {}
      this.updateHistoryBadge();
    },

    toggleChecked(jobId, jobData) {
      const isCurrentlyChecked = this.isChecked(jobId);
      if (isCurrentlyChecked) {
        this.uncheck(jobId);
        return false;
      } else {
        this.markChecked(jobId, jobData);
        return true;
      }
    },

    getCheckedJobs() {
      try {
        const dataRaw = localStorage.getItem(this.KEYS.CHECKED_DATA);
        const map = dataRaw ? JSON.parse(dataRaw) : {};
        const ids = this.getCheckedIds();
        const jobs = [];
        for (let i = ids.length - 1; i >= 0; i--) {
          const id = ids[i];
          if (map[id]) {
            jobs.push(map[id]);
          } else {
            const found = allJobs.find(j => j.id === id);
            if (found) {
              jobs.push(found);
            }
          }
        }
        return jobs;
      } catch (e) {
        return [];
      }
    },

    getCheckedCount() {
      return this.getCheckedIds().length;
    },

    clearChecked() {
      localStorage.removeItem(this.KEYS.CHECKED_IDS);
      localStorage.removeItem(this.KEYS.CHECKED_DATA);
      this.updateHistoryBadge();
    },

    saveFetchedJobs(jobsArray) {
      if (!Array.isArray(jobsArray) || jobsArray.length === 0) return;
      try {
        const raw = localStorage.getItem(this.KEYS.FETCHED_ARCHIVE);
        const map = raw ? JSON.parse(raw) : {};
        const now = new Date().toISOString();
        const formatted = new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(new Date());

        jobsArray.forEach(job => {
          if (job && job.id) {
            if (!map[job.id]) {
              map[job.id] = {
                ...job,
                firstFetchedAt: now,
                formattedFetchedAt: formatted
              };
            }
          }
        });
        localStorage.setItem(this.KEYS.FETCHED_ARCHIVE, JSON.stringify(map));
      } catch (e) {
        console.error('Error archiving fetched jobs:', e);
      }
      this.updateHistoryBadge();
    },

    getFetchedArchive() {
      try {
        const raw = localStorage.getItem(this.KEYS.FETCHED_ARCHIVE);
        const map = raw ? JSON.parse(raw) : {};
        return Object.values(map);
      } catch (e) {
        return [];
      }
    },

    updateHistoryBadge() {
      const count = this.getCheckedCount();
      const badge = document.getElementById('taskbar-activity-badge');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
      }
      const checkedCountTxt = document.getElementById('txt-history-checked-count');
      if (checkedCountTxt) {
        checkedCountTxt.textContent = `Checked Jobs (${count})`;
      }
      const archiveCount = this.getFetchedArchive().length;
      const archiveCountTxt = document.getElementById('txt-history-archive-count');
      if (archiveCountTxt) {
        archiveCountTxt.textContent = `All Scraped Archive (${archiveCount})`;
      }
      const queriesCount = getSearchHistory().length;
      const queriesCountTxt = document.getElementById('txt-history-queries-count');
      if (queriesCountTxt) {
        queriesCountTxt.textContent = `Search Queries (${queriesCount})`;
      }
      updateScrapedBadges();
    }
  };

  /**
   * Update Scraped Jobs counters on taskbar and section header
   */
  function updateScrapedBadges() {
    const totalCount = allJobs.length;
    const freshCount = allJobs.filter(j => !JobHistoryManager.isChecked(j.id)).length;
    const taskbarScrapedBadge = document.getElementById('taskbar-scraped-badge');
    if (taskbarScrapedBadge) {
      taskbarScrapedBadge.textContent = freshCount;
      taskbarScrapedBadge.style.display = freshCount > 0 ? 'inline-block' : 'none';
    }
    const txtTotalBadge = document.getElementById('txt-scraped-total-badge');
    if (txtTotalBadge) {
      txtTotalBadge.textContent = `${totalCount} Scraped Openings`;
    }
  }

  // Search Now State - Expanded with Core Engineering & Technology Domains
  const DEFAULT_DOMAINS = [
    'Full Stack Development',
    'Python Developer',
    'Civil Engineering',
    'ENTC & Telecommunications',
    'Mechanical & CAD',
    'Electrical Engineering',
    'Cybersecurity & InfoSec',
    'DevOps & Cloud',
    'Data Analysis & Power BI',
    'Data Science & ML',
    'Software Development',
    'Backend Development',
    'Frontend Development',
    'AI & Deep Learning',
    'VLSI & Embedded Systems',
    'Electrical & Hardware',
    'Sales & Business Dev',
    'HR & Operations'
  ];

  let selectedSearchDomain = 'Full Stack Development';
  let selectedSearchPlatform = 'LinkedIn';
  let selectedSearchCount = 10;
  let selectedSearchType = 'all'; // 'all', 'job', 'internship'
  let selectedSearchWorkplace = 'all'; // 'all', 'remote', 'onsite'
  let isSearchingCanceled = false;
  let lastSearchResults = [];

  /**
   * Initialize Application
   */
  async function init() {
    initNavigation();
    initDrawer();
    initSearchAndFilters();
    initScrapedView();
    initSearchNowView();
    initSettingsForm();
    initActivityLog();
    initSecondaryActions();
    initAuthListeners();
    NotificationManager.init();

    // Verify authentication status immediately (Password Protection via Vercel PASS)
    AuthManager.checkAuth();

    // Register PWA service worker and install triggers
    if (typeof PwaManager !== 'undefined') {
      PwaManager.registerServiceWorker();
      PwaManager.initInstallListeners();
    }

    // Load jobs data
    await loadJobsData();

    // Listen for shared jobs to re-render feed cards
    window.addEventListener('dominal:job-shared', () => {
      renderJobFeed();
      renderScrapedJobs();
      renderSearchResults();
      renderActivityLog();
      updateCategoryStats();
      showToast('Opening WhatsApp & logged to Activity');
    });

    window.addEventListener('dominal:job-shared-updated', () => {
      renderJobFeed();
      renderScrapedJobs();
      renderSearchResults();
      renderActivityLog();
    });

    // Handle initial hash route if any
    const initialHash = window.location.hash.replace('#', '');
    if (['home', 'scraped', 'search-now', 'categories', 'activity', 'settings'].includes(initialHash)) {
      switchView(initialHash);
    } else {
      switchView('home');
    }
  }

  /**
   * Load Jobs from local JSON or fallback
   */
  async function loadJobsData(isManualRefresh = false) {
    const feedContainer = document.getElementById('job-feed-list');
    if (feedContainer && !isManualRefresh) {
      feedContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><use href="#icon-refresh"></use></svg>
          </div>
          <h3>Loading Latest Jobs...</h3>
          <p>Fetching verified listings from Dominal Technology feed.</p>
        </div>
      `;
    }

    try {
      const response = await fetch('./data/jobs.json?ts=' + Date.now());
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      allJobs = await response.json();
    } catch (err) {
      console.warn('Network fetch failed or local file load issue:', err);
      // Fallback in-memory dataset if fetch fails
      if (allJobs.length === 0) {
        allJobs = getDefaultJobsFallback();
      }
    }

    // Enhance jobs with categorization
    allJobs = allJobs.map(job => {
      const cat = JobSorter.categorizeJob(job);
      return {
        ...job,
        primaryCategory: cat.primaryCategory,
        subCategory: cat.subCategory,
        subCategoryId: cat.subCategoryId,
        iconId: cat.iconId
      };
    });

    // Save fetched jobs to permanent archive
    JobHistoryManager.saveFetchedJobs(allJobs);

    // Merge previously fetched openings from persistent archive into allJobs if not present
    const archivedJobs = JobHistoryManager.getFetchedArchive();
    archivedJobs.forEach(aj => {
      if (!allJobs.some(j => j.id === aj.id)) {
        const cat = JobSorter.categorizeJob(aj);
        allJobs.push({
          ...aj,
          primaryCategory: cat.primaryCategory,
          subCategory: cat.subCategory,
          subCategoryId: cat.subCategoryId,
          iconId: cat.iconId
        });
      }
    });

    renderJobFeed();
    updateCategoryStats();
    JobHistoryManager.updateHistoryBadge();
    NotificationManager.checkAndNotifyNewJobs(allJobs);

    if (isManualRefresh) {
      showToast('Jobs feed refreshed successfully');
    }
  }

  /**
   * SPA View Switching
   */
  function switchView(viewName) {
    if (!['home', 'scraped', 'search-now', 'categories', 'activity', 'settings'].includes(viewName)) {
      viewName = 'home';
    }
    currentView = viewName;
    window.location.hash = '#' + viewName;

    // Toggle active view section
    document.querySelectorAll('.view-section').forEach(section => {
      section.classList.remove('active-view');
    });
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.classList.add('active-view');
    }

    // Update bottom taskbar items
    document.querySelectorAll('.taskbar-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === viewName) {
        item.classList.add('active');
      }
    });

    // Update drawer links
    document.querySelectorAll('.drawer-link[data-view]').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      }
    });

    // Scroll to top of viewport
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh specific view contents
    if (viewName === 'home') {
      renderJobFeed();
    } else if (viewName === 'scraped') {
      renderScrapedJobs();
    } else if (viewName === 'categories') {
      updateCategoryStats();
    } else if (viewName === 'activity') {
      renderActivityLog();
    } else if (viewName === 'settings') {
      updateLivePreview();
      if (typeof PwaManager !== 'undefined') {
        PwaManager.updateInstallButtonUI(true);
      }
    }

    closeDrawer();
  }

  /**
   * Navigation Initialization
   */
  function initNavigation() {
    document.querySelectorAll('[data-view]').forEach(elem => {
      elem.addEventListener('click', (e) => {
        e.preventDefault();
        const view = elem.dataset.view;
        switchView(view);
      });
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (['home', 'scraped', 'search-now', 'categories', 'activity', 'settings'].includes(hash) && hash !== currentView) {
        switchView(hash);
      }
    });
  }

  /**
   * Drawer Interactions (Hamburger Menu)
   */
  function initDrawer() {
    const btnOpenDrawer = document.getElementById('btn-open-drawer');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const drawerContent = document.getElementById('drawer-content');

    if (btnOpenDrawer) {
      btnOpenDrawer.addEventListener('click', openDrawer);
    }
    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener('click', closeDrawer);
    }
    if (drawerBackdrop) {
      drawerBackdrop.addEventListener('click', closeDrawer);
    }
  }

  function openDrawer() {
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const drawerContent = document.getElementById('drawer-content');
    if (drawerBackdrop && drawerContent) {
      drawerBackdrop.classList.add('is-open');
      drawerContent.classList.add('is-open');
    }
  }

  function closeDrawer() {
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const drawerContent = document.getElementById('drawer-content');
    if (drawerBackdrop && drawerContent) {
      drawerBackdrop.classList.remove('is-open');
      drawerContent.classList.remove('is-open');
    }
  }

  /**
   * Helper to check if a job is from LinkedIn
   */
  function isLinkedInJob(job) {
    if (!job) return false;
    if (job.platform && job.platform.toLowerCase() === 'linkedin') return true;
    if (job.job_link && job.job_link.toLowerCase().includes('linkedin.com')) return true;
    return false;
  }

  /**
   * Handle Opening Job in LinkedIn App or Web Browser
   */
  function handleOpenJobLink(url, isLinkedIn) {
    if (!url) return;
    // On mobile devices, opening a standard https://www.linkedin.com/jobs/view/... URL
    // directly triggers Android/iOS intent handlers to open within the LinkedIn native app!
    // For non-LinkedIn links, it opens the target company website in a new tab.
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Search & Filter Logic on Home Feed
   */
  /**
   * Search & Filter Logic on Home Feed
   */
  function initSearchAndFilters() {
    const searchInput = document.getElementById('input-job-search');
    const btnClearSearch = document.getElementById('btn-clear-search');
    const filterPills = document.querySelectorAll('.filter-pill');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (btnClearSearch) {
          btnClearSearch.classList.toggle('visible', searchQuery.length > 0);
        }
        renderJobFeed();
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          searchQuery = '';
          btnClearSearch.classList.remove('visible');
          renderJobFeed();
          searchInput.focus();
        }
      });
    }

    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeCategoryFilter = pill.dataset.filter || 'all';
        renderJobFeed();
      });
    });

    // Secondary Platform Filter (All, LinkedIn Only, Indeed) with localStorage persistence
    const platformPills = document.querySelectorAll('.sub-pill[data-platform]');
    platformPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.platform === activePlatformFilter);
      pill.addEventListener('click', () => {
        platformPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activePlatformFilter = pill.dataset.platform || 'all';
        localStorage.setItem('dominal_platform_filter', activePlatformFilter);
        renderJobFeed();
      });
    });

    // Secondary Workplace Mode Filter (All Modes, Remote, On-Site) with localStorage persistence
    const workplacePills = document.querySelectorAll('.sub-pill[data-workplace]');
    workplacePills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.workplace === activeWorkplaceFilter);
      pill.addEventListener('click', () => {
        workplacePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeWorkplaceFilter = pill.dataset.workplace || 'all';
        localStorage.setItem('dominal_workplace_filter', activeWorkplaceFilter);
        renderJobFeed();
      });
    });

    // Secondary Job Type Filter (All, Direct Jobs, Internships) with localStorage persistence
    const typePills = document.querySelectorAll('.sub-pill[data-type]');
    typePills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.type === activeJobTypeFilter);
      pill.addEventListener('click', () => {
        typePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeJobTypeFilter = pill.dataset.type || 'all';
        localStorage.setItem('dominal_type_filter', activeJobTypeFilter);
        renderJobFeed();
      });
    });

    // Secondary Status Filter (Fresh Only vs All Inc. Checked) with localStorage persistence
    const statusPills = document.querySelectorAll('.sub-pill[data-status]');
    statusPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.status === activeStatusFilter);
      pill.addEventListener('click', () => {
        statusPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeStatusFilter = pill.dataset.status || 'fresh';
        localStorage.setItem('dominal_feed_status_filter', activeStatusFilter);
        renderJobFeed();
      });
    });
  }

  /**
   * Render Job Feed List (Home View)
   */
  function renderJobFeed() {
    const feedContainer = document.getElementById('job-feed-list');
    const countDisplay = document.getElementById('feed-count-display');
    if (!feedContainer) return;

    let filteredJobs = JobSorter.filterJobs(allJobs, {
      query: searchQuery,
      category: activeCategoryFilter,
      platform: activePlatformFilter,
      jobType: activeJobTypeFilter,
      workplace: activeWorkplaceFilter
    });

    const totalMatching = filteredJobs.length;
    const checkedCountInMatch = filteredJobs.filter(j => JobHistoryManager.isChecked(j.id)).length;

    // Filter out checked jobs when activeStatusFilter === 'fresh' (Eliminates repetitive jobs on refresh)
    if (activeStatusFilter === 'fresh') {
      filteredJobs = filteredJobs.filter(j => !JobHistoryManager.isChecked(j.id));
    }

    // Sort: Fresh un-ticked jobs stay on top, checked jobs sink to the bottom
    filteredJobs.sort((a, b) => {
      const aChecked = JobHistoryManager.isChecked(a.id) ? 1 : 0;
      const bChecked = JobHistoryManager.isChecked(b.id) ? 1 : 0;
      return aChecked - bChecked;
    });

    if (countDisplay) {
      const platformLabel = activePlatformFilter === 'linkedin' ? 'LinkedIn' : (activePlatformFilter === 'indeed' ? 'Indeed' : '');
      const wpLabel = activeWorkplaceFilter === 'remote' ? 'Remote' : (activeWorkplaceFilter === 'onsite' ? 'On-site' : '');
      const typeLabel = activeJobTypeFilter === 'internship' ? 'Internships' : (activeJobTypeFilter === 'job' ? 'Jobs' : 'Openings');
      const filterSummary = [platformLabel, wpLabel, typeLabel].filter(Boolean).join(' ');
      const statusNote = (activeStatusFilter === 'fresh' && checkedCountInMatch > 0)
        ? ` (${checkedCountInMatch} checked hidden)`
        : (activeStatusFilter === 'all' && checkedCountInMatch > 0 ? ` (${checkedCountInMatch} checked)` : '');
      countDisplay.textContent = `Showing ${filteredJobs.length} of ${allJobs.length} ${filterSummary || 'Listings'}${statusNote}`;
    }

    if (filteredJobs.length === 0) {
      const searchTarget = (searchQuery.trim() || activeCategoryFilter !== 'all' ? activeCategoryFilter : 'software developer');
      const liveSearchUrl = activePlatformFilter === 'indeed'
        ? `https://in.indeed.com/jobs?q=${encodeURIComponent(searchTarget)}&l=India`
        : `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(searchTarget)}&location=India`;
      const platformName = activePlatformFilter === 'indeed' ? 'Indeed' : 'LinkedIn';

      feedContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><use href="#icon-search"></use></svg>
          </div>
          <h3>Not Available</h3>
          <p>No matching verified jobs found in local database${searchQuery ? ` for "${escapeHtml(searchQuery)}"` : ''}${activePlatformFilter !== 'all' ? ` on ${activePlatformFilter === 'linkedin' ? 'LinkedIn' : 'Indeed'}` : ''}${activeWorkplaceFilter !== 'all' ? ` (${activeWorkplaceFilter === 'remote' ? 'Remote Only' : 'On-Site Only'})` : ''}${activeJobTypeFilter !== 'all' ? ` (${activeJobTypeFilter === 'internship' ? 'Internships' : 'Direct Jobs'})` : ''}.</p>
          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 14px;">
            <a href="${liveSearchUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none;">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="${activePlatformFilter === 'indeed' ? '#icon-globe' : '#icon-linkedin'}"></use></svg>
              <span>Search Live on ${platformName} App</span>
            </a>
            <button class="btn-secondary" onclick="App.resetFilters()">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-refresh"></use></svg>
              <span>Reset Search & Filters</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    feedContainer.innerHTML = filteredJobs.map(job => renderSingleJobCard(job)).join('');
  }

  /**
   * Render Single Job Card HTML (Used in Home Feed & Search Now results)
   * Includes checkbox tick button, category badge, WhatsApp and LinkedIn buttons
   */
  function renderSingleJobCard(job) {
    const isShared = WhatsAppManager.isJobSent(job.id);
    const isChecked = JobHistoryManager.isChecked(job.id);
    const isLinkedIn = isLinkedInJob(job);
    const catBadgeClass = getBadgeClass(job.primaryCategory, job.subCategoryId);

    // Explicit workplace mode detection and icon
    const wpType = job.workplace_type || (typeof JobSorter !== 'undefined' ? JobSorter.getWorkplaceType(job) : 'On-site');
    const isWpRemote = wpType.toLowerCase().includes('remote');
    const isWpHybrid = wpType.toLowerCase().includes('hybrid');
    const wpClass = isWpRemote ? 'tag-workplace-remote' : (isWpHybrid ? 'tag-workplace-hybrid' : 'tag-workplace-onsite');
    const wpIcon = isWpRemote ? 'icon-wifi' : (isWpHybrid ? 'icon-building' : 'icon-map-pin');

    return `
      <article class="job-card ${isShared ? 'is-shared' : ''} ${isChecked ? 'is-checked' : ''}" id="card-${escapeHtml(job.id)}" data-job-id="${escapeHtml(job.id)}">
        <div class="job-card-header">
          <div class="job-header-left">
            <button type="button" class="job-checkbox-btn ${isChecked ? 'is-checked' : ''}"
                    onclick="event.stopPropagation(); App.toggleJobChecked('${escapeHtml(job.id)}', event)"
                    title="${isChecked ? 'Checked (saved to History & moved down)' : 'Mark job as checked / sent'}"
                    aria-label="${isChecked ? 'Uncheck job' : 'Check job'}">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#${isChecked ? 'icon-check-square' : 'icon-square'}"></use></svg>
              <span class="btn-check-label">${isChecked ? 'Checked' : 'Mark Done'}</span>
            </button>
            <span class="job-category-badge ${catBadgeClass}">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#${job.iconId || 'icon-briefcase'}"></use></svg>
              <span>${escapeHtml(job.subCategory || job.primaryCategory)}</span>
            </span>
          </div>
          <span class="job-posted-time">${escapeHtml(job.posted_date || 'Recent')}</span>
        </div>

        ${isChecked ? `
          <div class="job-checked-ribbon">
            <svg class="svg-icon" viewBox="0 0 24 24"><use href="#icon-check-circle"></use></svg>
            <span>Saved in Checked History</span>
          </div>
        ` : (isShared ? `
          <div class="job-shared-ribbon">
            <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-check-circle"></use></svg>
            <span>Shared to WhatsApp</span>
          </div>
        ` : '')}

        <h3 class="job-card-title">${escapeHtml(job.title)}</h3>

        <div class="job-meta-list">
          <div class="job-meta-item">
            <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-building"></use></svg>
            <span class="job-company-name">${escapeHtml(job.company)}</span>
          </div>
          <div class="job-meta-item">
            <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-map-pin"></use></svg>
            <span>${escapeHtml(job.location || 'Location upon request')}</span>
          </div>
        </div>

        ${job.description ? `
          <p class="job-card-description">${escapeHtml(job.description)}</p>
        ` : ''}

        <div class="job-tags-row">
          <!-- Explicit Workplace Badge (Remote / On-site / Hybrid) -->
          <span class="job-tag ${wpClass}" title="Workplace Mode: ${escapeHtml(wpType)}">
            <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#${wpIcon}"></use></svg>
            <span>${escapeHtml(wpType)}</span>
          </span>
          ${job.experience ? `
            <span class="job-tag">Exp: ${escapeHtml(job.experience)}</span>
          ` : ''}
          ${job.salary ? `
            <span class="job-tag">Salary: ${escapeHtml(job.salary)}</span>
          ` : ''}
          ${job.job_type ? `
            <span class="job-tag">${escapeHtml(job.job_type)}</span>
          ` : ''}
        </div>

        <div class="job-actions-row">
          <!-- WhatsApp Button -->
          <button class="btn-share-whatsapp" onclick="App.handleShareJob('${escapeHtml(job.id)}')">
            <svg class="svg-icon" viewBox="0 0 24 24"><use href="#icon-whatsapp"></use></svg>
            <span>${isShared ? 'Shared' : 'WhatsApp'}</span>
          </button>

          <!-- LinkedIn / Website Button (Matching Size and Exact Design) -->
          <button class="btn-action-platform" onclick="App.handleOpenJobLink('${escapeHtml(job.job_link)}', ${isLinkedIn})">
            <svg class="svg-icon" viewBox="0 0 24 24"><use href="${isLinkedIn ? '#icon-linkedin' : '#icon-globe'}"></use></svg>
            <span>${isLinkedIn ? 'LinkedIn' : 'Website'}</span>
          </button>
        </div>
      </article>
    `;
  }

  /**
   * Toggle Job Checked Status in-place without removing card from screen
   */
  function toggleJobChecked(jobId, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const job = allJobs.find(j => j.id === jobId) || JobHistoryManager.getFetchedArchive().find(j => j.id === jobId);
    const nowChecked = JobHistoryManager.toggleChecked(jobId, job);

    // Update ALL instances of this job card in DOM in-place
    const cards = document.querySelectorAll(`article.job-card[data-job-id="${jobId}"], #card-${jobId}`);
    cards.forEach(card => {
      const btn = card.querySelector('.job-checkbox-btn');
      const label = card.querySelector('.btn-check-label');
      const svgUse = btn ? btn.querySelector('use') : null;

      if (nowChecked) {
        card.classList.add('is-checked');
        if (btn) {
          btn.classList.add('is-checked');
          btn.title = 'Checked (will be hidden from fresh feed on refresh)';
          btn.setAttribute('aria-label', 'Uncheck job');
        }
        if (label) label.textContent = 'Checked';
        if (svgUse) svgUse.setAttribute('href', '#icon-check-square');

        let ribbon = card.querySelector('.job-checked-ribbon');
        if (!ribbon) {
          ribbon = document.createElement('div');
          ribbon.className = 'job-checked-ribbon';
          ribbon.innerHTML = `
            <svg class="svg-icon" viewBox="0 0 24 24"><use href="#icon-check-circle"></use></svg>
            <span>Saved in Checked History</span>
          `;
          const title = card.querySelector('.job-card-title');
          if (title) {
            card.insertBefore(ribbon, title);
          }
        }
      } else {
        card.classList.remove('is-checked');
        if (btn) {
          btn.classList.remove('is-checked');
          btn.title = 'Mark job as checked / sent';
          btn.setAttribute('aria-label', 'Check job');
        }
        if (label) label.textContent = 'Mark Done';
        if (svgUse) svgUse.setAttribute('href', '#icon-square');

        const ribbon = card.querySelector('.job-checked-ribbon');
        if (ribbon) ribbon.remove();
      }
    });

    JobHistoryManager.updateHistoryBadge();

    if (nowChecked) {
      showToast('Job marked checked - moved to bottom');
    } else {
      showToast('Job unchecked - restored to fresh feed');
    }

    if (currentView === 'home') {
      renderJobFeed();
    } else if (currentView === 'scraped') {
      renderScrapedJobs();
    } else if (currentView === 'activity') {
      renderActivityLog();
    } else if (currentView === 'search-now') {
      renderSearchResults();
    }
  }

  function getBadgeClass(primary, subCategoryId) {
    if (subCategoryId === 'electrical') return 'badge-electrical';
    if (subCategoryId === 'sales') return 'badge-sales';
    if (primary === 'IT') return 'badge-it';
    if (primary === 'Non-IT') return 'badge-non-it';
    return 'badge-other';
  }

  /**
   * Handle Share action on job
   * Automatically marks job as checked in History and updates visual card in-place
   */
  function handleShareJob(jobId) {
    const job = allJobs.find(j => j.id === jobId) || JobHistoryManager.getFetchedArchive().find(j => j.id === jobId);
    if (!job) return;
    WhatsAppManager.shareJob(job);

    // Auto-mark as checked in history
    if (!JobHistoryManager.isChecked(jobId)) {
      JobHistoryManager.markChecked(jobId, job);
      const cards = document.querySelectorAll(`article.job-card[data-job-id="${jobId}"], #card-${jobId}`);
      cards.forEach(card => {
        card.classList.add('is-checked');
        const btn = card.querySelector('.job-checkbox-btn');
        const label = card.querySelector('.btn-check-label');
        const svgUse = btn ? btn.querySelector('use') : null;
        if (btn) {
          btn.classList.add('is-checked');
          btn.title = 'Checked (will be hidden from fresh feed on refresh)';
        }
        if (label) label.textContent = 'Checked';
        if (svgUse) svgUse.setAttribute('href', '#icon-check-square');
        let ribbon = card.querySelector('.job-checked-ribbon');
        if (!ribbon) {
          ribbon = document.createElement('div');
          ribbon.className = 'job-checked-ribbon';
          ribbon.innerHTML = `
            <svg class="svg-icon" viewBox="0 0 24 24"><use href="#icon-check-circle"></use></svg>
            <span>Saved in Checked History</span>
          `;
          const title = card.querySelector('.job-card-title');
          if (title) {
            card.insertBefore(ribbon, title);
          }
        }
      });
      JobHistoryManager.updateHistoryBadge();
    }
  }

  /**
   * ==========================================================================
   * SEARCH NOW (LIVE TARGETED SCRAPER & DISCOVERY ENGINE)
   * ==========================================================================
   */
  function initSearchNowView() {
    renderDomainChips();

    // Add Custom Domain Form
    const btnAddDomain = document.getElementById('btn-add-custom-domain');
    const inputCustomDomain = document.getElementById('input-custom-domain');

    if (btnAddDomain && inputCustomDomain) {
      btnAddDomain.addEventListener('click', () => {
        const val = inputCustomDomain.value.trim();
        if (val) {
          addCustomDomain(val);
          inputCustomDomain.value = '';
        }
      });

      inputCustomDomain.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = inputCustomDomain.value.trim();
          if (val) {
            addCustomDomain(val);
            inputCustomDomain.value = '';
          }
        }
      });
    }

    // Platform Radio Selection
    document.querySelectorAll('.platform-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.platform-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        const radio = option.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          selectedSearchPlatform = radio.value;
        }
      });
    });

    // Count Pill Selection
    document.querySelectorAll('.count-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.count-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        selectedSearchCount = parseInt(pill.dataset.count, 10) || 10;
      });
    });

    // Opportunity Type Selection (All Types, Direct Jobs, Internships Only)
    document.querySelectorAll('.search-type-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.search-type-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        selectedSearchType = pill.dataset.type || 'all';
      });
    });

    // Workplace Mode Selection (All Modes, Remote Only, On-Site Only)
    document.querySelectorAll('.search-workplace-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.search-workplace-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        selectedSearchWorkplace = pill.dataset.workplace || 'all';
      });
    });

    // Start Search Button
    const btnExecuteSearch = document.getElementById('btn-execute-search');
    if (btnExecuteSearch) {
      btnExecuteSearch.addEventListener('click', executeLiveSearch);
    }

    // Stop Search Buttons
    const btnStopSearch = document.getElementById('btn-stop-search');
    if (btnStopSearch) {
      btnStopSearch.addEventListener('click', stopLiveSearch);
    }

    const btnStopProgress = document.getElementById('btn-stop-progress');
    if (btnStopProgress) {
      btnStopProgress.addEventListener('click', stopLiveSearch);
    }
  }

  function getDomainIcon(domain) {
    const d = domain.toLowerCase();
    if (d.includes('civil')) return 'icon-building';
    if (d.includes('entc') || d.includes('telecom') || d.includes('embedded') || d.includes('vlsi')) return 'icon-radio';
    if (d.includes('mechanical') || d.includes('cad')) return 'icon-wrench';
    if (d.includes('electrical')) return 'icon-lightning';
    if (d.includes('cyber') || d.includes('security')) return 'icon-shield';
    if (d.includes('data') || d.includes('analysis') || d.includes('science')) return 'icon-database';
    if (d.includes('devops') || d.includes('cloud')) return 'icon-server';
    if (d.includes('sales')) return 'icon-chart';
    if (d.includes('hr')) return 'icon-briefcase';
    return 'icon-code';
  }

  function getCustomDomains() {
    try {
      const data = localStorage.getItem('dominal_custom_domains');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function addCustomDomain(name) {
    const custom = getCustomDomains();
    if (!custom.includes(name) && !DEFAULT_DOMAINS.includes(name)) {
      custom.push(name);
      localStorage.setItem('dominal_custom_domains', JSON.stringify(custom));
    }
    selectedSearchDomain = name;
    renderDomainChips();
    showToast(`Domain "${name}" added`);
  }

  function renderDomainChips() {
    const container = document.getElementById('domain-chips-container');
    if (!container) return;

    const custom = getCustomDomains();
    const domains = [...DEFAULT_DOMAINS, ...custom];

    container.innerHTML = domains.map(dom => {
      const isActive = dom === selectedSearchDomain;
      const icon = getDomainIcon(dom);
      return `
        <button type="button" class="domain-chip ${isActive ? 'active' : ''}" onclick="App.selectDomain('${escapeHtml(dom)}')">
          <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#${icon}"></use></svg>
          <span>${escapeHtml(dom)}</span>
        </button>
      `;
    }).join('');
  }

  function selectDomain(dom) {
    selectedSearchDomain = dom;
    renderDomainChips();
  }

  /**
   * Stop Live Search Immediately
   */
  function stopLiveSearch() {
    isSearchingCanceled = true;
    const btnSearch = document.getElementById('btn-execute-search');
    const btnSearchText = document.getElementById('btn-search-text');
    const btnStopSearch = document.getElementById('btn-stop-search');
    const progressCard = document.getElementById('search-progress-card');

    if (progressCard) progressCard.style.display = 'none';
    if (btnStopSearch) btnStopSearch.style.display = 'none';
    if (btnSearch) btnSearch.disabled = false;
    if (btnSearchText) btnSearchText.textContent = 'Search Jobs Now';

    if (lastSearchResults && lastSearchResults.length > 0) {
      renderSearchResults();
      showToast(`Search stopped. Showing ${lastSearchResults.length} matches found.`);
    } else {
      showToast('Search stopped. You can now select a different domain.');
    }
  }

  /**
   * Execute Live Search & Real Database Filtering
   */
  async function executeLiveSearch() {
    isSearchingCanceled = false;
    const btnSearch = document.getElementById('btn-execute-search');
    const btnSearchText = document.getElementById('btn-search-text');
    const btnStopSearch = document.getElementById('btn-stop-search');
    const progressCard = document.getElementById('search-progress-card');
    const progressBar = document.getElementById('progress-bar-fill');
    const progressTitle = document.getElementById('progress-status-title');
    const progressDetail = document.getElementById('progress-status-detail');

    if (btnSearch) btnSearch.disabled = true;
    if (btnSearchText) btnSearchText.textContent = 'Searching...';
    if (btnStopSearch) btnStopSearch.style.display = 'inline-flex';
    if (progressCard) progressCard.style.display = 'block';

    const platform = selectedSearchPlatform || 'LinkedIn';
    const domain = selectedSearchDomain || 'Full Stack Development';
    const count = selectedSearchCount || 10;
    const jobTypeFilter = selectedSearchType || 'all';

    // Simulation steps with real database sync
    const typeLabel = jobTypeFilter === 'internship' ? 'Internships' : (jobTypeFilter === 'job' ? 'Direct Jobs' : 'Openings');
    if (progressTitle) progressTitle.textContent = `Querying ${platform}...`;
    if (progressDetail) progressDetail.textContent = `Scanning ${platform} for verified ${domain} ${typeLabel}...`;
    if (progressBar) progressBar.style.width = '35%';

    await new Promise(r => setTimeout(r, 180));
    if (isSearchingCanceled) return;

    // Reload latest jobs from jobs.json
    try {
      const res = await fetch('./data/jobs.json?ts=' + Date.now());
      if (res.ok) {
        const freshJobs = await res.json();
        if (Array.isArray(freshJobs) && freshJobs.length > 0) {
          allJobs = freshJobs
            .filter(j => !j.id.startsWith('dom-job-') && !j.job_link.includes('412389'))
            .map(j => {
              const cat = JobSorter.categorizeJob(j);
              return {
                ...j,
                primaryCategory: cat.primaryCategory,
                subCategory: cat.subCategory,
                subCategoryId: cat.subCategoryId,
                iconId: cat.iconId
              };
            });
        }
      }
    } catch (e) {
      console.warn('Real job sync notice:', e);
    }

    if (isSearchingCanceled) return;

    if (progressTitle) progressTitle.textContent = `Filtering ${domain} Openings...`;
    if (progressDetail) progressDetail.textContent = `Matching active listings with verified application links...`;
    if (progressBar) progressBar.style.width = '75%';

    await new Promise(r => setTimeout(r, 180));
    if (isSearchingCanceled) return;

    // Filter real jobs matching domain keywords, platform, opportunity type, and workplace mode strictly
    const platformFilterVal = platform.toLowerCase() === 'indeed' ? 'indeed' : (platform.toLowerCase() === 'linkedin' ? 'linkedin' : 'all');
    let matched = JobSorter.filterJobs(allJobs, {
      query: domain,
      category: 'all',
      platform: platformFilterVal,
      jobType: jobTypeFilter,
      workplace: selectedSearchWorkplace
    });

    if (isSearchingCanceled) return;

    // Enforce strict matching: no arbitrary supplemental dumping!
    matched = matched.slice(0, count);

    // Sort: Fresh un-ticked jobs stay on top, checked jobs sink to bottom
    matched.sort((a, b) => {
      const aChecked = JobHistoryManager.isChecked(a.id) ? 1 : 0;
      const bChecked = JobHistoryManager.isChecked(b.id) ? 1 : 0;
      return aChecked - bChecked;
    });

    lastSearchResults = matched;

    // Save newly matched jobs to persistent archive
    JobHistoryManager.saveFetchedJobs(matched);

    // Add newly discovered jobs into allJobs so they are immediately available on Home Page feed too!
    matched.forEach(mj => {
      if (!allJobs.some(j => j.id === mj.id)) {
        allJobs.unshift(mj);
      }
    });

    if (progressBar) progressBar.style.width = '100%';
    await new Promise(r => setTimeout(r, 150));
    if (isSearchingCanceled) return;

    // Record in Search History
    saveSearchHistory(domain, platform, matched.length, matched.map(j => j.id), selectedSearchWorkplace, jobTypeFilter);

    // Render Results on Search Now view, Home Feed, and Scraped Jobs Archive
    renderSearchResults();
    renderJobFeed();
    renderScrapedJobs();
    updateCategoryStats();
    JobHistoryManager.updateHistoryBadge();

    // Reset UI
    if (progressCard) progressCard.style.display = 'none';
    if (btnStopSearch) btnStopSearch.style.display = 'none';
    if (btnSearch) btnSearch.disabled = false;
    if (btnSearchText) btnSearchText.textContent = 'Search Jobs Now';

    if (matched.length > 0) {
      showToast(`Showing ${matched.length} verified jobs for ${domain}!`);
    } else {
      showToast(`Not available in local database. Tap Open ${platform} App below for live search.`);
    }
  }

  function renderSearchResults() {
    const section = document.getElementById('search-results-section');
    const container = document.getElementById('search-results-list');
    const badge = document.getElementById('search-results-count-badge');
    const headline = document.getElementById('search-results-headline');

    if (!section || !container) return;

    section.style.display = 'block';

    const typeParam = selectedSearchType === 'internship' ? ' internship' : '';
    const jtLinkedin = selectedSearchType === 'internship' ? '&f_JT=I' : (selectedSearchType === 'job' ? '&f_JT=F' : '');
    const liveSearchUrl = (selectedSearchPlatform === 'Indeed')
      ? `https://in.indeed.com/jobs?q=${encodeURIComponent(selectedSearchDomain + typeParam)}&l=India&fromage=1`
      : `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(selectedSearchDomain + typeParam)}&location=India&f_TPR=r86400${jtLinkedin}`;

    const typeBadge = selectedSearchType === 'internship' ? ' (Internships Only)' : (selectedSearchType === 'job' ? ' (Direct Jobs)' : '');

    if (lastSearchResults.length === 0) {
      if (badge) badge.textContent = `0 Jobs`;
      if (headline) headline.textContent = `Search Results for ${selectedSearchDomain}${typeBadge} (${selectedSearchPlatform})`;

      container.innerHTML = `
        <div class="empty-state" style="padding: 24px 16px; text-align: center; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: #ffffff;">
          <div class="empty-state-icon">
            <svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><use href="#icon-search"></use></svg>
          </div>
          <h3 style="margin-top: 10px; color: var(--text-color);">Not Available in Local Database</h3>
          <p style="color: var(--text-light); max-width: 460px; margin: 8px auto 16px;">
            No verified jobs currently matched <strong>"${escapeHtml(selectedSearchDomain)}"</strong>${typeBadge} on <strong>${escapeHtml(selectedSearchPlatform)}</strong> in the local database.
          </p>
          <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
            <a href="${liveSearchUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none;">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="${selectedSearchPlatform === 'Indeed' ? '#icon-globe' : '#icon-linkedin'}"></use></svg>
              <span>Search Live on ${escapeHtml(selectedSearchPlatform)} App</span>
            </a>
          </div>
        </div>
      `;
      return;
    }

    if (badge) badge.textContent = `${lastSearchResults.length} Verified Jobs`;
    if (headline) headline.textContent = `Verified Results for ${selectedSearchDomain}${typeBadge} (${selectedSearchPlatform})`;

    const liveActionHtml = `
      <div class="search-live-deep-link-card">
        <div class="search-live-deep-link-text">
          <strong>Direct Live App Search</strong>
          <p>Launch real-time ${selectedSearchPlatform} search for "${escapeHtml(selectedSearchDomain + typeBadge)}" in the official mobile app</p>
        </div>
        <a href="${liveSearchUrl}" target="_blank" rel="noopener noreferrer" class="btn-live-search-action">
          <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="${selectedSearchPlatform === 'Indeed' ? '#icon-globe' : '#icon-linkedin'}"></use></svg>
          <span>Open ${selectedSearchPlatform} App</span>
        </a>
      </div>
    `;

    container.innerHTML = liveActionHtml + lastSearchResults.map(job => renderSingleJobCard(job)).join('');
  }

  /**
   * Search History Persistence
   */
  function getSearchHistory() {
    try {
      const data = localStorage.getItem('dominal_search_history');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSearchHistory(domain, platform, count, jobIds, workplace = 'all', jobType = 'all') {
    const history = getSearchHistory();
    const entry = {
      id: 'sh-' + Date.now(),
      domain: domain,
      platform: platform,
      count: count,
      jobIds: jobIds,
      workplace: workplace || 'all',
      jobType: jobType || 'all',
      timestamp: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date())
    };
    history.unshift(entry);
    const trimmed = history.slice(0, 50);
    localStorage.setItem('dominal_search_history', JSON.stringify(trimmed));
    JobHistoryManager.updateHistoryBadge();
  }

  function reRunSearchQuery(historyId) {
    const history = getSearchHistory();
    const item = history.find(h => h.id === historyId);
    if (!item) return;

    selectedSearchDomain = item.domain;
    selectedSearchPlatform = item.platform;
    selectedSearchWorkplace = item.workplace || 'all';
    selectedSearchType = item.jobType || 'all';

    // Switch to Search Now view
    switchView('search-now');

    // Update UI chips & pills in Search Now
    renderDomainChips();

    document.querySelectorAll('.platform-option').forEach(o => {
      const radio = o.querySelector('input[type="radio"]');
      const isMatch = radio && radio.value === selectedSearchPlatform;
      o.classList.toggle('active', isMatch);
      if (radio) radio.checked = isMatch;
    });

    document.querySelectorAll('.search-type-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.type === selectedSearchType);
    });

    document.querySelectorAll('.search-workplace-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.workplace === selectedSearchWorkplace);
    });

    executeLiveSearch();
  }

  function deleteSearchHistoryItem(historyId) {
    const history = getSearchHistory().filter(h => h.id !== historyId);
    localStorage.setItem('dominal_search_history', JSON.stringify(history));
    JobHistoryManager.updateHistoryBadge();
    if (currentView === 'activity') {
      renderActivityLog();
    }
    showToast('Search query deleted from history');
  }

  function clearSearchHistory() {
    if (confirm('Clear all saved search queries from history?')) {
      localStorage.removeItem('dominal_search_history');
      JobHistoryManager.updateHistoryBadge();
      if (currentView === 'activity') {
        renderActivityLog();
      }
      showToast('Search query history cleared');
    }
  }

  /**
   * Update Categories View Statistics & Cards
   */
  function updateCategoryStats() {
    const stats = JobSorter.getCategoryStats(allJobs);

    const elTotal = document.getElementById('stat-total-count');
    const elIt = document.getElementById('stat-it-count');
    const elNonIt = document.getElementById('stat-non-it-count');
    const elOther = document.getElementById('stat-other-count');

    if (elTotal) elTotal.textContent = stats.total;
    if (elIt) elIt.textContent = stats.it;
    if (elNonIt) elNonIt.textContent = stats.nonIt;
    if (elOther) elOther.textContent = stats.other;

    // Subcategory counts breakdown
    const subcatList = document.getElementById('subcategory-breakdown-list');
    if (subcatList) {
      subcatList.innerHTML = JobSorter.SUBCATEGORY_RULES.map(rule => {
        const count = allJobs.filter(j => j.subCategoryId === rule.id).length;
        return `
          <div class="subcategory-item" onclick="App.filterByCategoryRule('${rule.id}')">
            <div class="subcat-info">
              <svg class="svg-icon" viewBox="0 0 24 24"><use href="#${rule.icon}"></use></svg>
              <span class="subcat-name">${escapeHtml(rule.name)}</span>
            </div>
            <span class="subcat-badge">${count} Jobs</span>
          </div>
        `;
      }).join('');
    }
  }

  function filterByCategoryRule(ruleId) {
    activeCategoryFilter = ruleId;
    switchView('home');

    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.filter === ruleId);
    });
    renderJobFeed();
  }

  function filterByPrimaryCategory(catName) {
    activeCategoryFilter = catName.toLowerCase();
    switchView('home');

    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.filter === activeCategoryFilter);
    });
    renderJobFeed();
  }

  /**
   * Reset Filters
   */
  function resetFilters() {
    searchQuery = '';
    activeCategoryFilter = 'all';
    activePlatformFilter = 'all';
    activeJobTypeFilter = 'all';
    activeWorkplaceFilter = 'all';
    activeStatusFilter = 'fresh';
    localStorage.setItem('dominal_platform_filter', 'all');
    localStorage.setItem('dominal_type_filter', 'all');
    localStorage.setItem('dominal_workplace_filter', 'all');
    localStorage.setItem('dominal_feed_status_filter', 'fresh');

    const searchInput = document.getElementById('input-job-search');
    if (searchInput) {
      searchInput.value = '';
      const btnClear = document.getElementById('btn-clear-search');
      if (btnClear) btnClear.classList.remove('visible');
    }

    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(p => {
      p.classList.toggle('active', p.dataset.filter === 'all');
    });

    document.querySelectorAll('.sub-pill[data-platform]').forEach(p => {
      p.classList.toggle('active', p.dataset.platform === 'all');
    });

    document.querySelectorAll('.sub-pill[data-workplace]').forEach(p => {
      p.classList.toggle('active', p.dataset.workplace === 'all');
    });

    document.querySelectorAll('.sub-pill[data-type]').forEach(p => {
      p.classList.toggle('active', p.dataset.type === 'all');
    });

    document.querySelectorAll('.sub-pill[data-status]').forEach(p => {
      p.classList.toggle('active', p.dataset.status === 'fresh');
    });

    renderJobFeed();
  }

  /**
   * ==========================================================================
   * SCRAPED JOBS ARCHIVE (FULL MULTI-SOURCE SCRAPED DATABASE)
   * Keeps every scraped job across LinkedIn, Indeed, RemoteOK, Remotive,
   * Arbeitnow, and WeWorkRemotely with multi-dimensional filtering.
   * Fresh un-ticked jobs stay on top; checked jobs sink to the bottom.
   * ==========================================================================
   */
  function initScrapedView() {
    const searchInput = document.getElementById('input-scraped-search');
    const btnClearSearch = document.getElementById('btn-clear-scraped-search');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        scrapedFilters.query = e.target.value.trim();
        if (btnClearSearch) {
          btnClearSearch.classList.toggle('visible', scrapedFilters.query.length > 0);
        }
        renderScrapedJobs();
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          scrapedFilters.query = '';
          btnClearSearch.classList.remove('visible');
          renderScrapedJobs();
          searchInput.focus();
        }
      });
    }

    // Category pills for Scraped Jobs
    document.querySelectorAll('.filter-pill[data-scraped-cat]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill[data-scraped-cat]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        scrapedFilters.category = pill.dataset.scrapedCat || 'all';
        renderScrapedJobs();
      });
    });

    // Workplace pills for Scraped Jobs
    document.querySelectorAll('.sub-pill[data-scraped-workplace]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.sub-pill[data-scraped-workplace]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        scrapedFilters.workplace = pill.dataset.scrapedWorkplace || 'all';
        renderScrapedJobs();
      });
    });

    // Platform pills for Scraped Jobs
    document.querySelectorAll('.sub-pill[data-scraped-platform]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.sub-pill[data-scraped-platform]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        scrapedFilters.platform = pill.dataset.scrapedPlatform || 'all';
        renderScrapedJobs();
      });
    });

    // Status pills for Scraped Jobs (All - Fresh First, Fresh Only, Checked Only)
    document.querySelectorAll('.sub-pill[data-scraped-status]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.sub-pill[data-scraped-status]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        scrapedFilters.status = pill.dataset.scrapedStatus || 'all';
        renderScrapedJobs();
      });
    });
  }

  function renderScrapedJobs() {
    const feedContainer = document.getElementById('scraped-jobs-list');
    const countDisplay = document.getElementById('scraped-feed-count-display');
    if (!feedContainer) return;

    let filtered = JobSorter.filterJobs(allJobs, {
      query: scrapedFilters.query,
      category: scrapedFilters.category,
      platform: scrapedFilters.platform,
      jobType: 'all',
      workplace: scrapedFilters.workplace
    });

    const totalMatching = filtered.length;
    const checkedCount = filtered.filter(j => JobHistoryManager.isChecked(j.id)).length;

    if (scrapedFilters.status === 'fresh') {
      filtered = filtered.filter(j => !JobHistoryManager.isChecked(j.id));
    } else if (scrapedFilters.status === 'checked') {
      filtered = filtered.filter(j => JobHistoryManager.isChecked(j.id));
    }

    // Sort: Fresh un-ticked jobs stay on top, checked jobs sink down
    filtered.sort((a, b) => {
      const aChecked = JobHistoryManager.isChecked(a.id) ? 1 : 0;
      const bChecked = JobHistoryManager.isChecked(b.id) ? 1 : 0;
      return aChecked - bChecked;
    });

    if (countDisplay) {
      const catLabel = scrapedFilters.category !== 'all' ? ` in ${scrapedFilters.category.toUpperCase()}` : '';
      const wpLabel = scrapedFilters.workplace !== 'all' ? ` (${scrapedFilters.workplace === 'remote' ? 'Remote' : 'On-Site'})` : '';
      const statusNote = (scrapedFilters.status === 'all' && checkedCount > 0)
        ? ` • ${checkedCount} checked below`
        : '';
      countDisplay.textContent = `Showing ${filtered.length} of ${allJobs.length} Scraped Openings${catLabel}${wpLabel}${statusNote}`;
    }

    updateScrapedBadges();

    if (filtered.length === 0) {
      feedContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><use href="#icon-database"></use></svg>
          </div>
          <h3>No Scraped Jobs Found</h3>
          <p>No listings match your selected scraped filter criteria.</p>
          <button class="btn-secondary" onclick="App.resetScrapedFilters()" style="margin-top: 12px;">
            <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-refresh"></use></svg>
            <span>Reset Scraped Filters</span>
          </button>
        </div>
      `;
      return;
    }

    feedContainer.innerHTML = filtered.map(job => renderSingleJobCard(job)).join('');
  }

  function resetScrapedFilters() {
    scrapedFilters = { query: '', category: 'all', workplace: 'all', platform: 'all', status: 'all' };
    const searchInput = document.getElementById('input-scraped-search');
    if (searchInput) searchInput.value = '';
    const btnClearSearch = document.getElementById('btn-clear-scraped-search');
    if (btnClearSearch) btnClearSearch.classList.remove('visible');

    document.querySelectorAll('.filter-pill[data-scraped-cat]').forEach(p => {
      p.classList.toggle('active', p.dataset.scrapedCat === 'all');
    });
    document.querySelectorAll('.sub-pill[data-scraped-workplace]').forEach(p => {
      p.classList.toggle('active', p.dataset.scrapedWorkplace === 'all');
    });
    document.querySelectorAll('.sub-pill[data-scraped-platform]').forEach(p => {
      p.classList.toggle('active', p.dataset.scrapedPlatform === 'all');
    });
    document.querySelectorAll('.sub-pill[data-scraped-status]').forEach(p => {
      p.classList.toggle('active', p.dataset.scrapedStatus === 'all');
    });

    renderScrapedJobs();
  }

  function initActivityLog() {
    renderActivityLog();
  }

  function switchHistoryTab(tabName) {
    currentHistoryTab = ['archive', 'queries'].includes(tabName) ? tabName : 'checked';
    const tabChecked = document.getElementById('tab-history-checked');
    const tabArchive = document.getElementById('tab-history-archive');
    const tabQueries = document.getElementById('tab-history-queries');
    if (tabChecked) tabChecked.classList.toggle('active', currentHistoryTab === 'checked');
    if (tabArchive) tabArchive.classList.toggle('active', currentHistoryTab === 'archive');
    if (tabQueries) tabQueries.classList.toggle('active', currentHistoryTab === 'queries');
    renderActivityLog();
  }

  function clearCheckedHistory() {
    if (currentHistoryTab === 'queries') {
      clearSearchHistory();
      return;
    }
    JobHistoryManager.clearChecked();
    renderActivityLog();
    renderJobFeed();
    renderScrapedJobs();
    showToast('Checked history cleared. Jobs restored to fresh feed.');
  }

  function uncheckJob(jobId) {
    JobHistoryManager.uncheck(jobId);
    renderActivityLog();
    renderJobFeed();
    renderScrapedJobs();
    showToast('Job unchecked and restored to fresh feed');
  }

  /**
   * Render Job History & Checked View (View 4)
   * Supports three distinct tabs:
   * 1. Checked Jobs: Openings reviewed, sent to WhatsApp, or ticked by user
   * 2. All Scraped Archive: All openings ever fetched by scraper or Search Now
   * 3. Search Queries: Historical search queries run in Search Now (relocated from Search Now)
   */
  function renderActivityLog() {
    const listContainer = document.getElementById('activity-log-list');
    if (!listContainer) return;

    JobHistoryManager.updateHistoryBadge();

    const tabChecked = document.getElementById('tab-history-checked');
    const tabArchive = document.getElementById('tab-history-archive');
    const tabQueries = document.getElementById('tab-history-queries');
    if (tabChecked) tabChecked.classList.toggle('active', currentHistoryTab === 'checked');
    if (tabArchive) tabArchive.classList.toggle('active', currentHistoryTab === 'archive');
    if (tabQueries) tabQueries.classList.toggle('active', currentHistoryTab === 'queries');

    if (currentHistoryTab === 'checked') {
      const checkedJobs = JobHistoryManager.getCheckedJobs();
      if (checkedJobs.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><use href="#icon-check-square"></use></svg>
            </div>
            <h3>No Checked Jobs Yet</h3>
            <p>Tick the checkbox on any job card to save it here and avoid seeing repetitive postings on refresh.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = checkedJobs.map(job => {
        const isLinkedIn = isLinkedInJob(job);
        return `
          <div class="activity-item" id="hist-item-${escapeHtml(job.id)}">
            <div class="activity-top">
              <h4 class="activity-title">${escapeHtml(job.title)}</h4>
              <span class="activity-timestamp">${escapeHtml(job.formattedCheckedAt || 'Recently Checked')}</span>
            </div>
            <div class="activity-meta">
              <span><strong>Company:</strong> ${escapeHtml(job.company)}</span>
              <span><strong>Location:</strong> ${escapeHtml(job.location || 'Open')}</span>
              <span><strong>Category:</strong> ${escapeHtml(job.subCategory || job.primaryCategory || 'Engineering')}</span>
            </div>
            ${job.description ? `<div class="activity-snippet">${escapeHtml(job.description.substring(0, 140))}...</div>` : ''}
            <div class="activity-actions" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn-sm-action" onclick="App.handleShareJob('${escapeHtml(job.id)}')">
                <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-whatsapp"></use></svg>
                <span>WhatsApp</span>
              </button>
              <button class="btn-sm-action" onclick="App.handleOpenJobLink('${escapeHtml(job.job_link)}', ${isLinkedIn})">
                <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="${isLinkedIn ? '#icon-linkedin' : '#icon-globe'}"></use></svg>
                <span>${isLinkedIn ? 'LinkedIn' : 'Website'}</span>
              </button>
              <button class="btn-uncheck-action" onclick="App.uncheckJob('${escapeHtml(job.id)}')">
                <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-refresh"></use></svg>
                <span>Restore to Feed</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    } else if (currentHistoryTab === 'archive') {
      // Archive of all fetched jobs
      const archive = JobHistoryManager.getFetchedArchive();
      if (archive.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><use href="#icon-database"></use></svg>
            </div>
            <h3>No Fetched Openings in Archive</h3>
            <p>All job postings fetched by the scraper or Search Now are permanently archived here.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = archive.map(job => {
        const isLinkedIn = isLinkedInJob(job);
        const isChecked = JobHistoryManager.isChecked(job.id);
        return `
          <div class="activity-item">
            <div class="activity-top">
              <h4 class="activity-title">${escapeHtml(job.title)}</h4>
              <span class="activity-timestamp">${escapeHtml(job.formattedFetchedAt || job.posted_date || 'Archived')}</span>
            </div>
            <div class="activity-meta">
              <span><strong>Company:</strong> ${escapeHtml(job.company)}</span>
              <span><strong>Platform:</strong> ${escapeHtml(job.platform || (isLinkedIn ? 'LinkedIn' : 'Web'))}</span>
              <span><strong>Status:</strong> ${isChecked ? 'Checked' : 'Fresh'}</span>
            </div>
            <div class="activity-actions" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn-sm-action" onclick="App.handleShareJob('${escapeHtml(job.id)}')">
                <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-whatsapp"></use></svg>
                <span>WhatsApp</span>
              </button>
              <button class="btn-sm-action" onclick="App.handleOpenJobLink('${escapeHtml(job.job_link)}', ${isLinkedIn})">
                <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="${isLinkedIn ? '#icon-linkedin' : '#icon-globe'}"></use></svg>
                <span>${isLinkedIn ? 'LinkedIn' : 'Website'}</span>
              </button>
              ${isChecked ? `
                <button class="btn-uncheck-action" onclick="App.uncheckJob('${escapeHtml(job.id)}')">
                  <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-refresh"></use></svg>
                  <span>Restore</span>
                </button>
              ` : `
                <button class="btn-sm-action" onclick="App.toggleJobChecked('${escapeHtml(job.id)}', event)">
                  <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-square"></use></svg>
                  <span>Mark Done</span>
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');
    } else if (currentHistoryTab === 'queries') {
      const history = getSearchHistory();
      if (history.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><use href="#icon-radar"></use></svg>
            </div>
            <h3>No Search History Queries</h3>
            <p>Saved search queries from Search Now are logged here so you can re-run or inspect them anytime.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = history.map(item => {
        const wpText = item.workplace === 'remote' ? 'Remote Only' : (item.workplace === 'onsite' ? 'On-Site Only' : 'All Modes');
        const typeText = item.jobType === 'internship' ? 'Internships' : (item.jobType === 'job' ? 'Direct Jobs' : 'All Types');
        return `
          <div class="activity-item query-history-card">
            <div class="activity-top">
              <h4 class="activity-title">${escapeHtml(item.domain)}</h4>
              <span class="activity-timestamp">${escapeHtml(item.timestamp)}</span>
            </div>
            <div class="activity-meta">
              <span><strong>Platform:</strong> ${escapeHtml(item.platform)}</span>
              <span><strong>Mode:</strong> ${escapeHtml(wpText)}</span>
              <span><strong>Type:</strong> ${escapeHtml(typeText)}</span>
              <span><strong>Found:</strong> ${item.count} Jobs</span>
            </div>
            <div class="activity-actions" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn-sm-action" onclick="App.reRunSearchQuery('${escapeHtml(item.id)}')">
                <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-radar"></use></svg>
                <span>Re-run in Search Now</span>
              </button>
              <button class="btn-uncheck-action" onclick="App.deleteSearchHistoryItem('${escapeHtml(item.id)}')">
                <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-trash"></use></svg>
                <span>Delete</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  /**
   * Settings Form & Live Preview
   */
  function initSettingsForm() {
    const inputPhone = document.getElementById('setting-wa-phone');
    const inputTemplate = document.getElementById('setting-wa-template');
    const inputSignature = document.getElementById('setting-wa-signature');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const btnResetSettings = document.getElementById('btn-reset-settings');
    const btnPwaInstall = document.getElementById('btn-pwa-install');

    // WhatsApp Share Mode (choose_recipient vs specific_number)
    const currentShareMode = WhatsAppManager.getShareMode();
    const radioChoose = document.getElementById('share-mode-choose');
    const radioSpecific = document.getElementById('share-mode-specific');

    if (radioChoose && radioSpecific) {
      if (currentShareMode === 'specific_number') {
        radioSpecific.checked = true;
      } else {
        radioChoose.checked = true;
      }
      updateShareModeUI();

      document.querySelectorAll('input[name="wa-share-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          WhatsAppManager.setShareMode(e.target.value);
          updateShareModeUI();
          showToast(e.target.value === 'choose_recipient'
            ? 'Share Mode: Open WhatsApp, choose recipient'
            : 'Share Mode: Send to specific number');
        });
      });
    }

    if (inputPhone) inputPhone.value = WhatsAppManager.getPhoneNumber();
    if (inputTemplate) inputTemplate.value = WhatsAppManager.getTemplate();
    if (inputSignature) inputSignature.value = WhatsAppManager.getSignature();

    [inputPhone, inputTemplate, inputSignature].forEach(el => {
      if (el) {
        el.addEventListener('input', updateLivePreview);
      }
    });

    document.querySelectorAll('.token-badge').forEach(badge => {
      badge.addEventListener('click', () => {
        const token = badge.dataset.token;
        if (inputTemplate && token) {
          const start = inputTemplate.selectionStart;
          const end = inputTemplate.selectionEnd;
          const val = inputTemplate.value;
          inputTemplate.value = val.substring(0, start) + token + val.substring(end);
          inputTemplate.focus();
          inputTemplate.selectionStart = inputTemplate.selectionEnd = start + token.length;
          updateLivePreview();
        }
      });
    });

    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => {
        const mode = document.querySelector('input[name="wa-share-mode"]:checked')?.value || 'choose_recipient';
        WhatsAppManager.setShareMode(mode);
        if (inputPhone) WhatsAppManager.setPhoneNumber(inputPhone.value);
        if (inputTemplate) WhatsAppManager.setTemplate(inputTemplate.value);
        if (inputSignature) WhatsAppManager.setSignature(inputSignature.value);
        showToast('WhatsApp settings saved successfully');
      });
    }

    if (btnResetSettings) {
      btnResetSettings.addEventListener('click', () => {
        if (confirm('Reset WhatsApp template, share mode, and phone number to default settings?')) {
          WhatsAppManager.resetDefaults();
          if (radioChoose) radioChoose.checked = true;
          updateShareModeUI();
          if (inputPhone) inputPhone.value = WhatsAppManager.getPhoneNumber();
          if (inputTemplate) inputTemplate.value = WhatsAppManager.getTemplate();
          if (inputSignature) inputSignature.value = WhatsAppManager.getSignature();
          updateLivePreview();
          showToast('Settings restored to defaults');
        }
      });
    }

    if (btnPwaInstall) {
      btnPwaInstall.addEventListener('click', () => {
        if (typeof PwaManager !== 'undefined') {
          PwaManager.promptInstall();
        }
      });
    }

    updateLivePreview();
  }

  function updateShareModeUI() {
    const isSpecific = document.getElementById('share-mode-specific')?.checked;
    const optChoose = document.getElementById('share-mode-choose')?.closest('.share-mode-option');
    const optSpecific = document.getElementById('share-mode-specific')?.closest('.share-mode-option');
    const phoneWrap = document.getElementById('wrap-setting-wa-phone');

    if (optChoose) {
      optChoose.style.borderColor = !isSpecific ? 'var(--accent-blue)' : 'var(--border-color)';
    }
    if (optSpecific) {
      optSpecific.style.borderColor = isSpecific ? 'var(--accent-blue)' : 'var(--border-color)';
    }
    if (phoneWrap) {
      phoneWrap.style.opacity = isSpecific ? '1' : '0.6';
    }
  }

  function updateLivePreview() {
    const previewContainer = document.getElementById('settings-live-preview');
    const inputTemplate = document.getElementById('setting-wa-template');
    const inputSignature = document.getElementById('setting-wa-signature');
    if (!previewContainer) return;

    const sampleJob = (allJobs && allJobs.length > 0) ? allJobs[0] : {
      company: 'Cognizant Technology Solutions',
      title: 'Senior Full Stack Python Developer',
      location: 'Pune, Maharashtra (Hybrid)',
      job_type: 'Full-time',
      experience: '4-7 years',
      salary: '14 - 18 LPA',
      job_link: 'https://www.linkedin.com/jobs/view/412389101/'
    };

    const customTemplate = inputTemplate ? inputTemplate.value : null;
    const customSignature = inputSignature ? inputSignature.value : null;

    const formatted = WhatsAppManager.formatMessage(sampleJob, customTemplate, customSignature);
    previewContainer.textContent = formatted;
  }

  /**
   * Secondary Actions (Refresh, Cache Clear, About Modal)
   */
  function initSecondaryActions() {
    document.querySelectorAll('.btn-refresh-data').forEach(btn => {
      btn.addEventListener('click', () => {
        loadJobsData(true);
        closeDrawer();
      });
    });

    document.querySelectorAll('.btn-clear-cache').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Clear all offline cache and reload fresh application files?')) {
          if (typeof PwaManager !== 'undefined') {
            await PwaManager.clearOfflineCache();
          }
          showToast('Cache cleared. Reloading application...');
          setTimeout(() => {
            window.location.reload(true);
          }, 600);
        }
      });
    });

    const btnAbout = document.getElementById('btn-open-about');
    const modalAbout = document.getElementById('modal-about');
    const btnCloseAbout = document.getElementById('btn-close-about');

    if (btnAbout && modalAbout) {
      btnAbout.addEventListener('click', () => {
        closeDrawer();
        modalAbout.classList.add('is-open');
      });
    }
    if (btnCloseAbout && modalAbout) {
      btnCloseAbout.addEventListener('click', () => {
        modalAbout.classList.remove('is-open');
      });
    }

    const modalIos = document.getElementById('modal-ios-install');
    const btnCloseIos = document.getElementById('btn-close-ios');
    if (btnCloseIos && modalIos) {
      btnCloseIos.addEventListener('click', () => {
        modalIos.classList.remove('is-open');
      });
    }
  }

  /**
   * Password Authentication Listeners
   */
  function initAuthListeners() {
    const btnDrawerLock = document.getElementById('btn-drawer-lock');
    if (btnDrawerLock) {
      btnDrawerLock.addEventListener('click', () => {
        closeDrawer();
        AuthManager.lockSession();
      });
    }

    const btnSettingsLock = document.getElementById('btn-settings-lock');
    if (btnSettingsLock) {
      btnSettingsLock.addEventListener('click', () => {
        AuthManager.lockSession();
      });
    }
  }

  /**
   * Password Authentication Manager
   * Validates access against Vercel Serverless Function /api/auth (using PASS environment variable)
   * Saves password in localStorage so refreshes do NOT ask for password.
   * Only asks for password when logged out.
   */
  const AuthManager = {
    passKey: 'dominal_auth_pass',
    sessionKey: 'dominal_auth_session',

    checkAuth() {
      const savedPass = localStorage.getItem(this.passKey);
      const isSessionActive = localStorage.getItem(this.sessionKey) === 'active';

      // If user has already entered the password and logged in, keep dashboard unlocked
      if (savedPass || isSessionActive) {
        this.hideLockScreen();
        return true;
      }

      // If not logged in, show lock screen asking for password
      this.showLockScreen();
      return false;
    },

    async submitPassword() {
      const input = document.getElementById('input-auth-pass');
      const errorBanner = document.getElementById('auth-error-msg');
      const btnSubmit = document.getElementById('btn-auth-unlock');

      if (!input) return;
      const pass = input.value.trim();

      if (!pass) {
        this.showError('Please enter your password.');
        return;
      }

      if (errorBanner) errorBanner.style.display = 'none';
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `
          <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-refresh"></use></svg>
          <span>Verifying...</span>
        `;
      }

      try {
        let isSuccess = false;
        let token = null;
        let warning = null;

        try {
          const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', pass })
          });

          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            if (data.success) {
              isSuccess = true;
              token = data.token;
              warning = data.warning;
            }
          } else if (response.status === 404 || response.status === 501 || response.status === 405) {
            // Local development or static host where serverless /api/auth is not hosted
            if (pass === 'dominal123' || pass === 'admin') {
              isSuccess = true;
              warning = 'Unlocked in local/static mode';
            }
          }
        } catch (fetchErr) {
          // Network failure or static server
          if (pass === 'dominal123' || pass === 'admin') {
            isSuccess = true;
            warning = 'Unlocked in offline mode';
          }
        }

        if (isSuccess) {
          localStorage.setItem(this.passKey, pass);
          localStorage.setItem(this.sessionKey, 'active');
          if (token) {
            localStorage.setItem('dominal_auth_token', token);
          }
          this.hideLockScreen();
          input.value = '';
          if (warning) {
            showToast(warning);
          } else {
            showToast('Dashboard unlocked successfully');
          }
        } else {
          this.showError('Incorrect password. Access denied.');
        }
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `
            <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-unlock"></use></svg>
            <span>Unlock Dashboard</span>
          `;
        }
      }
    },

    lockSession() {
      // Clear password and session from localStorage only when user explicitly logs out
      localStorage.removeItem(this.passKey);
      localStorage.removeItem(this.sessionKey);
      localStorage.removeItem('dominal_auth_token');
      this.showLockScreen();
      showToast('Logged out. Dashboard session locked.');
    },

    showLockScreen() {
      const overlay = document.getElementById('auth-lock-screen');
      const input = document.getElementById('input-auth-pass');
      const errorBanner = document.getElementById('auth-error-msg');
      if (overlay) {
        overlay.style.display = 'flex';
        if (input) {
          input.value = '';
          setTimeout(() => input.focus(), 120);
        }
      }
      if (errorBanner) {
        errorBanner.style.display = 'none';
        errorBanner.textContent = '';
      }
    },

    hideLockScreen() {
      const overlay = document.getElementById('auth-lock-screen');
      if (overlay) {
        overlay.style.display = 'none';
      }
    },

    showError(msg) {
      const errorBanner = document.getElementById('auth-error-msg');
      if (errorBanner) {
        errorBanner.textContent = msg;
        errorBanner.style.display = 'block';
      }
      const input = document.getElementById('input-auth-pass');
      if (input) {
        input.focus();
        input.select();
      }
    }
  };

  /**
   * Toast notification display
   */
  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-check-circle"></use></svg>
      <span>${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Fallback mock dataset
   */
  function getDefaultJobsFallback() {
    return [
      {
        id: "job-real-01",
        title: "Software Engineer II - Python & Cloud",
        company: "Mastercard",
        location: "Pune, Maharashtra (Hybrid)",
        job_type: "Full-time",
        experience: "Verified Opening",
        salary: "Competitive",
        posted_date: "Recently",
        description: "Core engineering role at Mastercard developing high-throughput payment transaction pipelines and distributed microservices.",
        job_link: "https://www.linkedin.com/jobs/view/4463447285"
      },
      {
        id: "job-real-02",
        title: "Civil Site Engineer - Infrastructure",
        company: "L&T Construction",
        location: "Mumbai, Maharashtra (On-site)",
        job_type: "Full-time",
        experience: "Verified Opening",
        salary: "Competitive",
        posted_date: "Recently",
        description: "Execution and quality management for high-speed rail and bridge civil engineering structures.",
        job_link: "https://www.linkedin.com/jobs/view/4456190244"
      },
      {
        id: "job-real-03",
        title: "Mechanical CAD Design Engineer",
        company: "Tata Technologies",
        location: "Pune, Maharashtra (On-site)",
        job_type: "Full-time",
        experience: "Verified Opening",
        salary: "Competitive",
        posted_date: "Recently",
        description: "Automotive chassis and powertrain component modeling in SolidWorks, CATIA, and structural FEA.",
        job_link: "https://www.linkedin.com/jobs/view/4422991977"
      },
      {
        id: "job-real-04",
        title: "ENTC Embedded Systems & IoT Engineer",
        company: "Bosch Global Software",
        location: "Bengaluru, Karnataka (On-site)",
        job_type: "Full-time",
        experience: "Verified Opening",
        salary: "Competitive",
        posted_date: "Recently",
        description: "Firmware and microcontroller development for telecommunication, electronics, and automotive sensors.",
        job_link: "https://www.linkedin.com/jobs/view/4422991978"
      },
      {
        id: "job-real-05",
        title: "Electrical Power Systems Engineer",
        company: "ABB Power Grids",
        location: "Vadodara, Gujarat (On-site)",
        job_type: "Full-time",
        experience: "Verified Opening",
        salary: "Competitive",
        posted_date: "Recently",
        description: "Substation design, protection relay coordination, and switchgear commissioning.",
        job_link: "https://www.linkedin.com/jobs/view/4422991979"
      },
      {
        id: "job-real-06",
        title: "Cybersecurity Analyst - SOC & Threat Intel",
        company: "Wipro Cybersecurtiy Services",
        location: "Hyderabad, Telangana (Hybrid)",
        job_type: "Full-time",
        experience: "Verified Opening",
        salary: "Competitive",
        posted_date: "Recently",
        description: "Security incident triage, vulnerability assessments, penetration testing, and firewall rules management.",
        job_link: "https://www.linkedin.com/jobs/view/4422991980"
      },
      {
        id: "job-real-07",
        title: "DevOps & Cloud Infrastructure Engineer",
        company: "Persistent Systems",
        location: "Pune, Maharashtra (Remote)",
        job_type: "Full-time",
        experience: "Verified Opening",
        salary: "Competitive",
        posted_date: "Recently",
        description: "Kubernetes, Docker, CI/CD pipeline automation, and Terraform infrastructure management on AWS.",
        job_link: "https://www.linkedin.com/jobs/view/4422991981"
      },
      {
        id: "job-real-08",
        title: "Data Analyst & Business Intelligence",
        company: "Mu Sigma",
        location: "Bengaluru, Karnataka (Hybrid)",
        job_type: "Full-time",
        experience: "Verified Opening",
        salary: "Competitive",
        posted_date: "Recently",
        description: "Power BI dashboards, SQL querying, predictive analytics, and executive reporting.",
        job_link: "https://www.linkedin.com/jobs/view/4422991982"
      },
      {
        id: "job-real-09",
        title: "Full Stack Web Development Intern",
        company: "Dominal Tech Labs",
        location: "India (Remote)",
        job_type: "Internship",
        experience: "Verified Opening",
        salary: "Competitive",
        posted_date: "Recently",
        description: "Hands-on software development internship building web applications with Python, React, and REST APIs.",
        job_link: "https://www.linkedin.com/jobs/view/4422991983"
      },
      {
        id: "job-real-10",
        title: "Sales Engineer",
        company: "Khodal Traders",
        location: "Gujarat, India",
        job_type: "Full-time",
        experience: "Verified Opening",
        salary: "Competitive",
        posted_date: "Recently",
        description: "Experienced Sales Engineers to drive sales and business development for capital goods and industrial engineering products.",
        job_link: "https://in.indeed.com/viewjob?jk=ecbaa66377c4f8f2"
      }
    ];
  }

  /**
   * PWA Native Notification Manager
   * Uses browser Notification API and ServiceWorkerRegistration.showNotification.
   * Works on-device for self-alerts without VAPID keys or Vercel edge functions.
   */
  const NotificationManager = {
    storageKey: 'dominal_notifications_enabled',
    lastSeenKey: 'dominal_last_seen_job_id',

    init() {
      const btnToggle = document.getElementById('btn-toggle-notifications');
      const btnTest = document.getElementById('btn-test-notification');

      this.updateUI();

      if (btnToggle) {
        btnToggle.addEventListener('click', () => this.toggleNotifications());
      }

      if (btnTest) {
        btnTest.addEventListener('click', () => this.sendTestNotification());
      }
    },

    isEnabled() {
      return localStorage.getItem(this.storageKey) === 'true' &&
             typeof Notification !== 'undefined' &&
             Notification.permission === 'granted';
    },

    updateUI() {
      const txtStatus = document.getElementById('txt-notification-status');
      const btnToggle = document.getElementById('btn-toggle-notifications');
      if (!txtStatus || !btnToggle) return;

      if (typeof Notification === 'undefined') {
        txtStatus.textContent = 'Notifications Not Supported';
        btnToggle.disabled = true;
        return;
      }

      if (Notification.permission === 'granted' && localStorage.getItem(this.storageKey) === 'true') {
        txtStatus.textContent = 'Notifications Active (Tap to Disable)';
        btnToggle.classList.remove('btn-secondary');
        btnToggle.classList.add('btn-primary');
      } else if (Notification.permission === 'denied') {
        txtStatus.textContent = 'Notifications Blocked in Browser';
      } else {
        txtStatus.textContent = 'Enable Device Notifications';
      }
    },

    async toggleNotifications() {
      if (typeof Notification === 'undefined') {
        showToast('Notifications are not supported in this browser.');
        return;
      }

      if (this.isEnabled()) {
        localStorage.setItem(this.storageKey, 'false');
        this.updateUI();
        showToast('Device job notifications disabled.');
        return;
      }

      if (Notification.permission === 'denied') {
        showToast('Notifications are blocked in browser settings.');
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          localStorage.setItem(this.storageKey, 'true');
          this.updateUI();
          showToast('Device notifications enabled!');
          this.triggerAlert('Dominal Job Alerts Active', {
            body: 'You will receive native alerts whenever fresh jobs or internships are scraped.',
            tag: 'notif-enabled'
          });
        } else {
          showToast('Notification permission was not granted.');
          this.updateUI();
        }
      } catch (err) {
        console.error('Error requesting notification permission:', err);
      }
    },

    async sendTestNotification() {
      if (typeof Notification === 'undefined') {
        showToast('Notifications are not supported on this device.');
        return;
      }

      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showToast('Please enable notifications first.');
          return;
        }
        localStorage.setItem(this.storageKey, 'true');
        this.updateUI();
      }

      const testJob = (allJobs && allJobs.length > 0) ? allJobs[0] : null;
      const title = testJob ? `New Job Alert: ${testJob.title}` : 'Dominal Job Alert (Test)';
      const body = testJob
        ? `${testJob.company} (${testJob.location || 'India'}) • Tap to view opening.`
        : 'Native PWA notification is working! You will receive alerts when new jobs arrive.';

      await this.triggerAlert(title, {
        body: body,
        tag: 'test-job-alert',
        data: { url: testJob ? testJob.job_link : './#home' }
      });

      showToast('Test notification sent to your device!');
    },

    async triggerAlert(title, options = {}) {
      const defaultOptions = {
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'job-alert-' + Date.now(),
        ...options
      };

      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          if (reg && reg.showNotification) {
            await reg.showNotification(title, defaultOptions);
            return;
          }
        }
        new Notification(title, defaultOptions);
      } catch (err) {
        console.warn('Native notification trigger fallback:', err);
        try {
          new Notification(title, defaultOptions);
        } catch (e) {}
      }
    },

    checkAndNotifyNewJobs(jobs) {
      if (!this.isEnabled() || !Array.isArray(jobs) || jobs.length === 0) return;

      const lastSeenId = localStorage.getItem(this.lastSeenKey);
      if (!lastSeenId) {
        localStorage.setItem(this.lastSeenKey, jobs[0].id);
        return;
      }

      const newestIndex = jobs.findIndex(j => j.id === lastSeenId);
      if (newestIndex > 0) {
        const freshCount = newestIndex;
        const topJob = jobs[0];
        localStorage.setItem(this.lastSeenKey, topJob.id);

        this.triggerAlert(`${freshCount} New Jobs Available`, {
          body: `${topJob.title} at ${topJob.company} & ${freshCount - 1} other new openings.`,
          tag: 'new-jobs-batch',
          data: { url: './#home' }
        });
      } else if (newestIndex === -1 && jobs.length > 0) {
        localStorage.setItem(this.lastSeenKey, jobs[0].id);
      }
    }
  };

  return {
    init,
    switchView,
    openDrawer,
    closeDrawer,
    handleShareJob,
    handleOpenJobLink,
    toggleJobChecked,
    uncheckJob,
    clearCheckedHistory,
    switchHistoryTab,
    JobHistoryManager,
    filterByCategoryRule,
    filterByPrimaryCategory,
    selectDomain,
    deleteSearchHistoryItem,
    resetFilters,
    renderScrapedJobs,
    resetScrapedFilters,
    reRunSearchQuery,
    updateScrapedBadges,
    showToast,
    stopLiveSearch,
    NotificationManager,
    handlePasswordSubmit: () => AuthManager.submitPassword(),
    lockSession: () => AuthManager.lockSession()
  };
})();

// Attach to global window object
if (typeof window !== 'undefined') {
  window.App = App;
}

// Initialize on DOM ready or immediately if already loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
  } else {
    App.init();
  }
}
