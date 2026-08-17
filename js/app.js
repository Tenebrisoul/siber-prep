import { Storage } from './storage.js';
import { DataManager } from './dataManager.js';
import { QuizModule } from './quiz.js';
import { FlashcardsModule } from './flashcards.js';
import { ArticleModule } from './article.js';

class App {
  constructor() {
    this.dataManager = new DataManager();
    this.currentMode = 'article'; // Default learning order: 1. article -> 2. flashcards -> 3. quiz
    this.isFullArticleMode = false;
    this.isSidebarCollapsed = false;
    this.searchQuery = '';

    this.quizModule = null;
    this.flashcardsModule = null;
    this.articleModule = null;
  }

  async init() {
    // Theme setup
    this.initTheme();

    // Load initial data
    await this.dataManager.loadInitialData();

    // Restore last visited state if available in user's localStorage
    const lastState = Storage.getLastState();
    if (lastState && lastState.sectionId && lastState.subtopicId) {
      this.dataManager.selectSubtopic(lastState.sectionId, lastState.subtopicId);
      if (['quiz', 'flashcards', 'article'].includes(lastState.mode)) {
        this.currentMode = lastState.mode;
      }
    }

    // Dynamic Title
    this.updateAppTitle();

    // Instantiate modules with callback on state changes
    const onStateChange = () => {
      this.renderSidebar();
    };

    const onNavigate = (mode) => {
      this.switchMode(mode, false);
    };

    this.quizModule = new QuizModule(this.dataManager, onStateChange);
    this.flashcardsModule = new FlashcardsModule(this.dataManager, onStateChange, onNavigate);
    this.articleModule = new ArticleModule(this.dataManager, onNavigate);

    // Setup UI Bindings
    this.bindHeaderEvents();
    this.bindSidebarEvents();

    // Render initial views
    this.renderSidebar();
    this.switchMode(this.currentMode);
  }

  initTheme() {
    const savedTheme = Storage.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeButtonIcon(savedTheme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    Storage.setTheme(next);
    this.updateThemeButtonIcon(next);
  }

  updateThemeButtonIcon(theme) {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;
    if (theme === 'dark') {
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
    } else {
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
    }
  }

  updateAppTitle() {
    const titleEl = document.getElementById('app-course-title');
    if (titleEl && this.dataManager.data?.title) {
      titleEl.textContent = this.dataManager.data.title;
      document.title = this.dataManager.data.title;
    }
  }

  switchMode(mode, isFullArticle = false) {
    this.currentMode = mode;
    this.isFullArticleMode = isFullArticle;

    // Update Header Mode Tabs
    document.querySelectorAll('.mode-tab-btn[data-mode]').forEach(btn => {
      btn.classList.toggle('active', !isFullArticle && btn.getAttribute('data-mode') === mode);
    });

    // Update Full Article button state in sidebar
    const faBtn = document.getElementById('btn-full-article');
    if (faBtn) {
      faBtn.classList.toggle('active', isFullArticle);
    }

    // Update Breadcrumbs
    this.updateBreadcrumb();

    // Render active module
    if (isFullArticle) {
      this.articleModule.init(true);
    } else if (mode === 'quiz') {
      this.flashcardsModule.destroy();
      this.quizModule.init();
    } else if (mode === 'flashcards') {
      this.quizModule.destroy();
      this.flashcardsModule.init();
    } else if (mode === 'article') {
      this.flashcardsModule.destroy();
      this.quizModule.destroy();
      this.articleModule.init(false);
    }

    // Persist current position to user's localStorage
    Storage.saveLastState(this.dataManager.activeSectionId, this.dataManager.activeSubtopicId, this.currentMode);

    this.renderSidebar();
  }

  updateBreadcrumb() {
    const modeTitle = document.getElementById('bc-mode-title');
    if (modeTitle) {
      if (this.isFullArticleMode) modeTitle.textContent = 'Tüm Notlar';
      else if (this.currentMode === 'quiz') modeTitle.textContent = 'Quiz';
      else if (this.currentMode === 'flashcards') modeTitle.textContent = 'Flashcards';
      else if (this.currentMode === 'article') modeTitle.textContent = 'Konu Anlatımı';
    }
  }

  renderSidebar() {
    const stats = this.dataManager.getGlobalStats(this.currentMode);

    // Update Global Filter Stats Badges
    const chipAll = document.getElementById('chip-all');
    const chipMastered = document.getElementById('chip-mastered');
    const chipReview = document.getElementById('chip-review');
    const chipIncomplete = document.getElementById('chip-incomplete');

    if (chipAll) chipAll.innerHTML = `Tümü (${stats.totalItems || stats.totalSubtopics})`;
    if (chipMastered) chipMastered.innerHTML = `<span class="dot-indicator dot-mastered"></span> Öğrenilen %${stats.masteredPercent}`;
    if (chipReview) chipReview.innerHTML = `<span class="dot-indicator dot-review"></span> Tekrar (${stats.review})`;
    if (chipIncomplete) chipIncomplete.innerHTML = `<span class="dot-indicator dot-unmarked"></span> Kalan (${stats.incomplete})`;

    // Render Topics Tree
    const treeContainer = document.getElementById('sidebar-topics-tree');
    if (!treeContainer || !this.dataManager.data?.sections) return;

    const sections = this.dataManager.data.sections;
    const activeSubtopicId = this.dataManager.activeSubtopicId;
    const query = this.searchQuery.trim().toLowerCase();

    treeContainer.innerHTML = sections.map((sec) => {
      // Filter subtopics based on status filter and search query
      const visibleSubtopics = (sec.subtopics || []).filter(sub => {
        // Status filter
        let passStatus = true;
        if (this.dataManager.filter !== 'all') {
          const status = this.dataManager.getSubtopicStatus(sub);
          passStatus = (this.dataManager.filter === status);
        }

        // Search query filter
        let passSearch = true;
        if (query.length > 0) {
          const matchTitle = sub.title.toLowerCase().includes(query);
          const matchSec = sec.title.toLowerCase().includes(query);
          passSearch = matchTitle || matchSec;
        }

        return passStatus && passSearch;
      });

      if (visibleSubtopics.length === 0) {
        return '';
      }

      return `
        <div class="section-group" data-section-id="${sec.id}">
          <div class="section-header" data-toggle="section">
            <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <span class="section-title">${this.escapeHtml(sec.title)}</span>
          </div>

          <div class="section-children">
            ${visibleSubtopics.map(sub => {
        const isActive = sub.id === activeSubtopicId;
        const detailed = this.dataManager.getSubtopicDetailedStatus(sub);

        return `
                <div class="subtopic-item ${isActive ? 'active' : ''} ${detailed.overall}" 
                     data-subtopic-id="${sub.id}" 
                     data-section-id="${sec.id}">
                  <div class="subtopic-left">
                    <div class="subtopic-status-group">
                      ${detailed.fc.total > 0 ? `
                        <span class="status-micro-badge ${detailed.fc.status}" title="Flashcards: ${detailed.fc.status === 'review' ? detailed.fc.review + ' tekrar gerekiyor' : detailed.fc.status === 'mastered' ? 'Tümü Öğrenildi' : 'Kalan: ' + (detailed.fc.total - detailed.fc.mastered)}">
                          F:${detailed.fc.status === 'mastered' ? '✓' : detailed.fc.status === 'review' ? '✕' : detailed.fc.total}
                        </span>
                      ` : ''}
                      ${detailed.quiz.total > 0 ? `
                        <span class="status-micro-badge ${detailed.quiz.status}" title="Quiz: ${detailed.quiz.status === 'review' ? detailed.quiz.wrong + ' yanlış' : detailed.quiz.status === 'mastered' ? 'Tümü Doğru' : 'Kalan: ' + (detailed.quiz.total - detailed.quiz.correct)}">
                          Q:${detailed.quiz.status === 'mastered' ? '✓' : detailed.quiz.status === 'review' ? '✕' : detailed.quiz.total}
                        </span>
                      ` : ''}
                    </div>
                    <span class="subtopic-name">${this.escapeHtml(sub.title)}</span>
                  </div>
                </div>
              `;
      }).join('')}
          </div>
        </div>
      `;
    }).join('');

    this.bindSidebarItemEvents();
  }

  bindSidebarItemEvents() {
    // Accordion Toggle
    document.querySelectorAll('[data-toggle="section"]').forEach(el => {
      el.addEventListener('click', () => {
        const group = el.closest('.section-group');
        group?.classList.toggle('collapsed');
      });
    });

    // Subtopic Selection
    document.querySelectorAll('.subtopic-item').forEach(el => {
      el.addEventListener('click', () => {
        const secId = el.getAttribute('data-section-id');
        const subId = el.getAttribute('data-subtopic-id');
        this.dataManager.selectSubtopic(secId, subId);
        this.switchMode(this.currentMode, false);
      });
    });
  }

  bindSidebarEvents() {
    // Sidebar Collapse / Expand from top header bar
    const sidebar = document.getElementById('sidebar');
    const toggleSidebar = () => {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
      sidebar?.classList.toggle('collapsed', this.isSidebarCollapsed);
    };

    document.getElementById('btn-toggle-sidebar-header')?.addEventListener('click', toggleSidebar);

    // Search Input
    const searchInput = document.getElementById('sidebar-search');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderSidebar();
    });

    // Filter Chips
    const filters = [
      { id: 'chip-all', value: 'all' },
      { id: 'chip-mastered', value: 'mastered' },
      { id: 'chip-review', value: 'review' },
      { id: 'chip-incomplete', value: 'incomplete' }
    ];

    filters.forEach(f => {
      const el = document.getElementById(f.id);
      el?.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        this.dataManager.filter = f.value;
        this.renderSidebar();
      });
    });

    // Full Article Button
    document.getElementById('btn-full-article')?.addEventListener('click', () => {
      this.switchMode('article', true);
    });
  }

  bindHeaderEvents() {
    // Mode Switcher (Quiz / Flashcards / Article)
    document.querySelectorAll('.mode-tab-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        this.switchMode(mode, false);
      });
    });

    // Theme Toggle
    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Reset Progress Button in Header
    document.getElementById('btn-reset-progress')?.addEventListener('click', () => {
      if (confirm('Tüm çözülmüş soru ve kart ilerlemeniz sıfırlanacak. Onaylıyor musunuz?')) {
        Storage.resetAllProgress();
        this.showToast('İlerleme başarıyla sıfırlandı.', 'warning');
        this.renderSidebar();
        this.switchMode(this.currentMode, false);
      }
    });
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
