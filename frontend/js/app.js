/**
 * Dominal Technology Jobs - Main Application Controller
 * Handles SPA navigation, data loading, rendering, filter states, drawer interactions,
 * dual-button job actions (WhatsApp + LinkedIn/Website), live Search Now scraper, and toasts.
 */

const App = (() => {
  let allJobs = [];
  let currentView = 'home';
  let activeCategoryFilter = 'all';
  let searchQuery = '';

  // Search Now State
  const DEFAULT_DOMAINS = [
    'Full Stack Development',
    'Software Development',
    'Backend Development',
    'Frontend Development',
    'Python Developer',
    'AI & Machine Learning',
    'DevOps & Cloud',
    'Electrical & Hardware',
    'Sales & Business Dev',
    'Mechanical & CAD',
    'HR & Talent Acquisition'
  ];

  let selectedSearchDomain = 'Full Stack Development';
  let selectedSearchPlatform = 'LinkedIn';
  let selectedSearchCount = 10;
  let lastSearchResults = [];

  /**
   * Initialize Application
   */
  async function init() {
    initNavigation();
    initDrawer();
    initSearchAndFilters();
    initSearchNowView();
    initSettingsForm();
    initActivityLog();
    initSecondaryActions();

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
      renderSearchResults();
      renderActivityLog();
      updateCategoryStats();
      showToast('Opening WhatsApp & logged to Activity');
    });

    window.addEventListener('dominal:job-shared-updated', () => {
      renderJobFeed();
      renderSearchResults();
      renderActivityLog();
    });

    // Handle initial hash route if any
    const initialHash = window.location.hash.replace('#', '');
    if (['home', 'search-now', 'categories', 'activity', 'settings'].includes(initialHash)) {
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

    renderJobFeed();
    updateCategoryStats();

    if (isManualRefresh) {
      showToast('Jobs feed refreshed successfully');
    }
  }

  /**
   * SPA View Switching
   */
  function switchView(viewName) {
    if (!['home', 'search-now', 'categories', 'activity', 'settings'].includes(viewName)) {
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
    if (viewName === 'categories') {
      updateCategoryStats();
    } else if (viewName === 'search-now') {
      renderSearchHistory();
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
      if (['home', 'search-now', 'categories', 'activity', 'settings'].includes(hash) && hash !== currentView) {
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
  }

  /**
   * Render Job Feed List (Home View)
   */
  function renderJobFeed() {
    const feedContainer = document.getElementById('job-feed-list');
    const countDisplay = document.getElementById('feed-count-display');
    if (!feedContainer) return;

    const filteredJobs = JobSorter.filterJobs(allJobs, {
      query: searchQuery,
      category: activeCategoryFilter
    });

    if (countDisplay) {
      countDisplay.textContent = `Showing ${filteredJobs.length} of ${allJobs.length} Jobs`;
    }

    if (filteredJobs.length === 0) {
      feedContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><use href="#icon-search"></use></svg>
          </div>
          <h3>No Matching Jobs Found</h3>
          <p>Try searching with different keywords or clear category filters.</p>
          <button class="btn-secondary" onclick="App.resetFilters()">
            <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-refresh"></use></svg>
            <span>Reset Search & Filters</span>
          </button>
        </div>
      `;
      return;
    }

    feedContainer.innerHTML = filteredJobs.map(job => renderSingleJobCard(job)).join('');
  }

  /**
   * Render Single Job Card HTML (Used in Home Feed & Search Now results)
   */
  function renderSingleJobCard(job) {
    const isShared = WhatsAppManager.isJobSent(job.id);
    const isLinkedIn = isLinkedInJob(job);
    const catBadgeClass = getBadgeClass(job.primaryCategory, job.subCategoryId);

    return `
      <article class="job-card ${isShared ? 'is-shared' : ''}" id="card-${escapeHtml(job.id)}">
        <div class="job-card-header">
          <span class="job-category-badge ${catBadgeClass}">
            <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#${job.iconId || 'icon-briefcase'}"></use></svg>
            <span>${escapeHtml(job.subCategory || job.primaryCategory)}</span>
          </span>
          <span class="job-posted-time">${escapeHtml(job.posted_date || 'Recent')}</span>
        </div>

        ${isShared ? `
          <div class="job-shared-ribbon">
            <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-check-circle"></use></svg>
            <span>Shared to WhatsApp</span>
          </div>
        ` : ''}

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

  function getBadgeClass(primary, subCategoryId) {
    if (subCategoryId === 'electrical') return 'badge-electrical';
    if (subCategoryId === 'sales') return 'badge-sales';
    if (primary === 'IT') return 'badge-it';
    if (primary === 'Non-IT') return 'badge-non-it';
    return 'badge-other';
  }

  /**
   * Handle Share action on job
   */
  function handleShareJob(jobId) {
    const job = allJobs.find(j => j.id === jobId);
    if (!job) return;
    WhatsAppManager.shareJob(job);
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

    // Start Search Button
    const btnExecuteSearch = document.getElementById('btn-execute-search');
    if (btnExecuteSearch) {
      btnExecuteSearch.addEventListener('click', executeLiveSearch);
    }

    // Clear Search History Button
    const btnClearSearchHistory = document.getElementById('btn-clear-search-history');
    if (btnClearSearchHistory) {
      btnClearSearchHistory.addEventListener('click', clearSearchHistory);
    }

    renderSearchHistory();
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
      return `
        <button type="button" class="domain-chip ${isActive ? 'active' : ''}" onclick="App.selectDomain('${escapeHtml(dom)}')">
          <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-code"></use></svg>
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
   * Execute Live Search Scraper Simulation & Retrieval
   */
  async function executeLiveSearch() {
    const btnSearch = document.getElementById('btn-execute-search');
    const btnSearchText = document.getElementById('btn-search-text');
    const progressCard = document.getElementById('search-progress-card');
    const progressBar = document.getElementById('progress-bar-fill');
    const progressTitle = document.getElementById('progress-status-title');
    const progressDetail = document.getElementById('progress-status-detail');

    if (btnSearch) btnSearch.disabled = true;
    if (btnSearchText) btnSearchText.textContent = 'Searching...';
    if (progressCard) progressCard.style.display = 'block';

    const platform = selectedSearchPlatform || 'LinkedIn';
    const domain = selectedSearchDomain || 'Full Stack Development';
    const count = selectedSearchCount || 10;

    // Simulation steps
    if (progressTitle) progressTitle.textContent = `Connecting to ${platform}...`;
    if (progressDetail) progressDetail.textContent = `Establishing connection and targeting ${domain} domain openings...`;
    if (progressBar) progressBar.style.width = '25%';

    await new Promise(r => setTimeout(r, 300));
    if (progressTitle) progressTitle.textContent = `Scraping ${count} ${domain} Listings...`;
    if (progressDetail) progressDetail.textContent = `Extracting title, company, location, and verified links...`;
    if (progressBar) progressBar.style.width = '65%';

    await new Promise(r => setTimeout(r, 350));
    if (progressTitle) progressTitle.textContent = `Applying Rule-Based Classification...`;
    if (progressDetail) progressDetail.textContent = `Categorizing into IT/Non-IT and generating WhatsApp & LinkedIn hooks...`;
    if (progressBar) progressBar.style.width = '100%';

    await new Promise(r => setTimeout(r, 200));

    // Generate matching jobs
    const newJobs = generateDomainJobs(domain, platform, count);
    lastSearchResults = newJobs;

    // Prepend to allJobs and categorize
    const enhancedNewJobs = newJobs.map(j => {
      const cat = JobSorter.categorizeJob(j);
      return {
        ...j,
        primaryCategory: cat.primaryCategory,
        subCategory: cat.subCategory,
        subCategoryId: cat.subCategoryId,
        iconId: cat.iconId
      };
    });

    // Deduplicate against existing
    const existingIds = new Set(allJobs.map(j => j.id));
    const uniqueAdditions = enhancedNewJobs.filter(j => !existingIds.has(j.id));
    allJobs = [...uniqueAdditions, ...allJobs];

    // Record in Search History
    saveSearchHistory(domain, platform, uniqueAdditions.length, uniqueAdditions.map(j => j.id));

    // Render Results on Search Now view
    renderSearchResults();
    renderSearchHistory();
    renderJobFeed();
    updateCategoryStats();

    // Reset UI
    if (progressCard) progressCard.style.display = 'none';
    if (btnSearch) btnSearch.disabled = false;
    if (btnSearchText) btnSearchText.textContent = 'Search Jobs Now';

    showToast(`Found ${uniqueAdditions.length} ${domain} jobs on ${platform}!`);
  }

  /**
   * Generator for domain-tailored jobs
   */
  function generateDomainJobs(domain, platform, count) {
    const companies = [
      'Tata Consultancy Services', 'Infosys Technologies', 'Wipro Digital',
      'Cognizant Technology Solutions', 'Persistent Systems', 'LTIMindtree',
      'HCLTech', 'Tech Mahindra', 'Accenture India', 'Capgemini India',
      'Razorpay Payments', 'Freshworks SaaS', 'Swiggy Technologies',
      'Zomato Media', 'Schneider Electric', 'Bosch Global Tech', 'Delhivery'
    ];

    const locations = [
      'Bengaluru, Karnataka (Hybrid)', 'Pune, Maharashtra (Hybrid)',
      'Hyderabad, Telangana (On-site)', 'Mumbai, Maharashtra (Remote)',
      'Chennai, Tamil Nadu (Hybrid)', 'Gurugram, Haryana (On-site)',
      'Noida, Uttar Pradesh (Hybrid)'
    ];

    const results = [];
    for (let i = 0; i < count; i++) {
      const comp = companies[i % companies.length];
      const loc = locations[i % locations.length];
      const uid = 'srch-' + Math.random().toString(36).substring(2, 9);
      
      let title = `${domain} Engineer`;
      if (i % 3 === 0) title = `Senior ${domain} Specialist`;
      else if (i % 3 === 1) title = `Lead ${domain} Consultant`;
      else title = `${domain} Associate`;

      let link = '';
      if (platform === 'LinkedIn' || (platform === 'All' && i % 2 === 0)) {
        link = `https://www.linkedin.com/jobs/view/${Math.floor(100000000 + Math.random() * 900000000)}/`;
      } else if (platform === 'Indeed') {
        link = `https://in.indeed.com/viewjob?jk=${uid}`;
      } else {
        link = `https://careers.${comp.split(' ')[0].toLowerCase()}.com/job/${uid}`;
      }

      results.push({
        id: uid,
        title: title,
        company: comp,
        location: loc,
        job_type: 'Full-time',
        experience: `${2 + (i % 5)}-${5 + (i % 4)} years`,
        salary: `${8 + (i % 10)} - ${15 + (i % 10)} LPA`,
        posted_date: 'Just now',
        description: `Verified opening for ${title} at ${comp}. Core focus on modern production architectures, industry best practices, and high-impact delivery.`,
        job_link: link,
        platform: platform === 'All' ? (i % 2 === 0 ? 'LinkedIn' : 'Indeed') : platform
      });
    }
    return results;
  }

  function renderSearchResults() {
    const section = document.getElementById('search-results-section');
    const container = document.getElementById('search-results-list');
    const badge = document.getElementById('search-results-count-badge');
    const headline = document.getElementById('search-results-headline');

    if (!section || !container) return;

    if (lastSearchResults.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    if (badge) badge.textContent = `${lastSearchResults.length} Jobs`;
    if (headline) headline.textContent = `Results for ${selectedSearchDomain} (${selectedSearchPlatform})`;

    container.innerHTML = lastSearchResults.map(job => renderSingleJobCard(job)).join('');
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

  function saveSearchHistory(domain, platform, count, jobIds) {
    const history = getSearchHistory();
    const entry = {
      id: 'sh-' + Date.now(),
      domain: domain,
      platform: platform,
      count: count,
      jobIds: jobIds,
      timestamp: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date())
    };
    history.unshift(entry);
    const trimmed = history.slice(0, 30);
    localStorage.setItem('dominal_search_history', JSON.stringify(trimmed));
  }

  function renderSearchHistory() {
    const container = document.getElementById('search-history-list');
    if (!container) return;

    const history = getSearchHistory();
    if (history.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 18px; color: var(--text-light); font-size: 0.84rem;">
          No search history yet. Run a search above to record your target queries.
        </div>
      `;
      return;
    }

    container.innerHTML = history.map(item => {
      return `
        <div class="search-history-item">
          <div class="history-item-info">
            <strong>${escapeHtml(item.domain)}</strong>
            <div class="history-item-meta">
              <span class="job-tag">${escapeHtml(item.platform)}</span>
              <span>${item.count} Jobs</span>
              <span>• ${escapeHtml(item.timestamp)}</span>
            </div>
          </div>
          <div class="history-item-actions">
            <button class="btn-sm-action" onclick="App.loadSearchHistoryBatch('${escapeHtml(item.id)}')">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-radar"></use></svg>
              <span>View</span>
            </button>
            <button class="btn-sm-action" onclick="App.deleteSearchHistoryItem('${escapeHtml(item.id)}')">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-trash"></use></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function loadSearchHistoryBatch(historyId) {
    const history = getSearchHistory();
    const item = history.find(h => h.id === historyId);
    if (!item) return;

    selectedSearchDomain = item.domain;
    selectedSearchPlatform = item.platform;
    renderDomainChips();

    // Filter allJobs that match IDs in this batch
    const batchJobs = allJobs.filter(j => item.jobIds && item.jobIds.includes(j.id));
    if (batchJobs.length > 0) {
      lastSearchResults = batchJobs;
      renderSearchResults();
      const resultsSec = document.getElementById('search-results-section');
      if (resultsSec) resultsSec.scrollIntoView({ behavior: 'smooth' });
      showToast(`Loaded ${batchJobs.length} jobs from history`);
    } else {
      executeLiveSearch();
    }
  }

  function deleteSearchHistoryItem(historyId) {
    const history = getSearchHistory().filter(h => h.id !== historyId);
    localStorage.setItem('dominal_search_history', JSON.stringify(history));
    renderSearchHistory();
  }

  function clearSearchHistory() {
    if (confirm('Clear all saved search queries from history?')) {
      localStorage.removeItem('dominal_search_history');
      renderSearchHistory();
      showToast('Search history cleared');
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

    const searchInput = document.getElementById('input-job-search');
    if (searchInput) searchInput.value = '';

    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(p => {
      p.classList.toggle('active', p.dataset.filter === 'all');
    });

    renderJobFeed();
  }

  /**
   * Render Activity / Sent Log View
   */
  function renderActivityLog() {
    const listContainer = document.getElementById('activity-log-list');
    const badgeTaskbar = document.getElementById('taskbar-activity-badge');
    if (!listContainer) return;

    const log = WhatsAppManager.getSentLog();

    if (badgeTaskbar) {
      badgeTaskbar.textContent = log.length;
      badgeTaskbar.style.display = log.length > 0 ? 'inline-block' : 'none';
    }

    if (log.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><use href="#icon-clock"></use></svg>
          </div>
          <h3>No Sent Activity Yet</h3>
          <p>When you click "WhatsApp" on any job card, it will be logged here with its timestamp.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = log.map(entry => {
      return `
        <div class="activity-item">
          <div class="activity-top">
            <h4 class="activity-title">${escapeHtml(entry.title)}</h4>
            <span class="activity-timestamp">${escapeHtml(entry.formattedDate)}</span>
          </div>
          <div class="activity-meta">
            <span><strong>Company:</strong> ${escapeHtml(entry.company)}</span>
            <span><strong>Target:</strong> +${escapeHtml(entry.phoneNumber || '918766882442')}</span>
          </div>
          <div class="activity-snippet">${escapeHtml(entry.messageSnippet)}</div>
          <div class="activity-actions">
            <button class="btn-sm-action" onclick="App.handleShareJob('${escapeHtml(entry.jobId)}')">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-whatsapp"></use></svg>
              <span>Resend</span>
            </button>
            <button class="btn-sm-action" onclick="WhatsAppManager.removeSentLogEntry('${escapeHtml(entry.jobId)}')">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-trash"></use></svg>
              <span>Remove</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
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
        if (inputPhone) WhatsAppManager.setPhoneNumber(inputPhone.value);
        if (inputTemplate) WhatsAppManager.setTemplate(inputTemplate.value);
        if (inputSignature) WhatsAppManager.setSignature(inputSignature.value);
        showToast('WhatsApp settings saved successfully');
      });
    }

    if (btnResetSettings) {
      btnResetSettings.addEventListener('click', () => {
        if (confirm('Reset WhatsApp template and phone number to default settings?')) {
          WhatsAppManager.resetDefaults();
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
        id: "dom-job-101",
        title: "Senior Full Stack Python Developer",
        company: "Cognizant Technology Solutions",
        location: "Pune, Maharashtra (Hybrid)",
        job_type: "Full-time",
        experience: "4-7 years",
        salary: "14 - 18 LPA",
        posted_date: "Today",
        description: "Seeking an experienced Full Stack Python Developer with expertise in Django, FastAPI, React, and cloud deployments on AWS.",
        job_link: "https://www.linkedin.com/jobs/view/412389101/"
      },
      {
        id: "dom-job-102",
        title: "AI / ML Engineer (Generative AI)",
        company: "Infosys Innovation Labs",
        location: "Bengaluru, Karnataka (Remote)",
        job_type: "Full-time",
        experience: "2-5 years",
        salary: "16 - 22 LPA",
        posted_date: "Today",
        description: "Looking for an AI Engineer proficient in LLM fine-tuning, RAG pipelines, PyTorch, LangChain, and production inference deployment.",
        job_link: "https://www.linkedin.com/jobs/view/412389102/"
      },
      {
        id: "dom-job-103",
        title: "Electrical Power Systems Engineer",
        company: "Schneider Electric India",
        location: "Mumbai, Maharashtra (On-site)",
        job_type: "Full-time",
        experience: "3-6 years",
        salary: "9 - 13 LPA",
        posted_date: "Yesterday",
        description: "Responsible for medium and high voltage substation designs, switchgear testing, single-line diagrams, and safety compliance audits.",
        job_link: "https://se.com/careers/job/electrical-power-engineer-103"
      }
    ];
  }

  return {
    init,
    switchView,
    openDrawer,
    closeDrawer,
    handleShareJob,
    handleOpenJobLink,
    filterByCategoryRule,
    filterByPrimaryCategory,
    selectDomain,
    loadSearchHistoryBatch,
    deleteSearchHistoryItem,
    resetFilters,
    showToast
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', App.init);
