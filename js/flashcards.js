import { Storage } from './storage.js';

export class FlashcardsModule {
  constructor(dataManager, onStateChange, onNavigate) {
    this.dataManager = dataManager;
    this.onStateChange = onStateChange;
    this.onNavigate = onNavigate;
    this.flashcards = [];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.viewMode = 'card'; // 'card' | 'list'
    this.trackProgress = Storage.getTrackProgress();
    this.ratings = {}; // local progress cache

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  init() {
    this.ratings = Storage.getFlashcardsProgress();
    this.loadFlashcardsForActiveSubtopic();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  loadFlashcardsForActiveSubtopic(all = false) {
    if (all) {
      this.flashcards = this.dataManager.getAllFlashcards();
    } else {
      const subtopic = this.dataManager.getActiveSubtopic();
      if (!subtopic || !subtopic.flashcards) {
        this.flashcards = [];
      } else {
        this.flashcards = subtopic.flashcards.map(fc => ({
          ...fc,
          subtopicId: subtopic.id,
          subtopicTitle: subtopic.title,
          sectionTitle: subtopic.sectionTitle
        }));
      }
    }
    this.currentIndex = 0;
    this.isFlipped = false;
    this.render();
  }

  shuffle() {
    for (let i = this.flashcards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.flashcards[i], this.flashcards[j]] = [this.flashcards[j], this.flashcards[i]];
    }
    this.currentIndex = 0;
    this.isFlipped = false;
    this.render();
  }

  render() {
    const container = document.getElementById('view-container');
    if (!container) return;

    const subtopic = this.dataManager.getActiveSubtopic();

    if (this.flashcards.length === 0) {
      container.innerHTML = `
        <div class="view-header fade-in">
          <div class="view-meta">
            <span class="view-status-tag">Hafıza Kartları</span>
            <div class="view-title-row">
              <h1 class="view-title">${subtopic?.title || 'Seçili Konu'}</h1>
              <span class="view-count-badge">0 Kart</span>
            </div>
          </div>
        </div>
        <div class="flashcards-wrapper fade-in">
          <div class="quiz-card" style="text-align:center; padding: 48px 24px;">
            <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Bu konuda henüz hafıza kartı bulunmuyor.</h3>
            <p style="color: var(--text-muted); font-size: 13.5px; margin-bottom: 20px;">
              JSON dosyanıza bu alt konu için "flashcards" ekleyebilir veya tüm kartları toplu çalışabilirsiniz.
            </p>
            <div>
              <button class="btn-primary" id="btn-show-all-fc">Tüm Kartları Çalış</button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-show-all-fc')?.addEventListener('click', () => {
        this.loadFlashcardsForActiveSubtopic(true);
      });
      return;
    }

    if (this.viewMode === 'list') {
      this.renderListView(container, subtopic);
    } else {
      this.renderCardView(container, subtopic);
    }
  }

  renderCardView(container, subtopic) {
    const total = this.flashcards.length;
    const currentFc = this.flashcards[this.currentIndex];
    const isBookmarked = Storage.isBookmarked(currentFc.id);

    let masteredCount = 0;
    let reviewCount = 0;
    this.flashcards.forEach(fc => {
      const r = this.ratings[fc.id];
      if (r === 'mastered') masteredCount++;
      else if (r === 'review') reviewCount++;
    });

    const progressPercent = Math.round(((this.currentIndex + 1) / total) * 100);

    container.innerHTML = `
      <div class="view-header fade-in">
        <div class="view-meta">
          <span class="view-status-tag">Kart ${this.currentIndex + 1} / ${total}</span>
          <div class="view-title-row">
            <h1 class="view-title">${currentFc.subtopicTitle || subtopic?.title || 'Flashcards'}</h1>
          </div>
        </div>

        <!-- View Switcher (Card / List) -->
        <div class="mode-tabs">
          <button class="mode-tab-btn ${this.viewMode === 'card' ? 'active' : ''}" id="btn-view-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="5" width="20" height="14" rx="2"></rect>
              <line x1="2" y1="10" x2="22" y2="10"></line>
            </svg>
            Kart
          </button>
          <button class="mode-tab-btn ${this.viewMode === 'list' ? 'active' : ''}" id="btn-view-list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            Liste
          </button>
        </div>
      </div>

      <div class="flashcards-wrapper fade-in">
        <!-- Stats Subheader Bar -->
        <div class="fc-stats-bar">
          <div class="fc-stat-item review">
            <span class="dot-indicator dot-review"></span>
            <span>${reviewCount} Tekrar Gerekiyor</span>
          </div>
          <div class="fc-stat-item mastered">
            <span class="dot-indicator dot-mastered"></span>
            <span>${masteredCount} Öğrenildi</span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="quiz-progress-bar-wrap">
          <div class="quiz-progress-fill" style="width: ${progressPercent}%"></div>
        </div>

        <!-- 3D Flip Card -->
        <div class="flashcard-stage ${this.isFlipped ? 'flipped' : ''}" id="fc-stage">
          <div class="flashcard-inner">
            <!-- Front Face -->
            <div class="flashcard-face front">
              <div class="fc-face-header">
                <span class="fc-type-badge">Ön Yüz (Soru / Kavram)</span>
                <div class="fc-face-tools">
                  <button class="tool-icon-btn ${isBookmarked ? 'active' : ''}" id="btn-bookmark-fc" title="Yıldızla">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="fc-face-body">
                <div class="fc-main-text">${this.escapeHtml(currentFc.front)}</div>
              </div>

              <div class="fc-face-footer">
                <div class="fc-hint-pill">
                  Çevirmek için <kbd class="fc-kbd">Space</kbd> veya Karta Tıklayın
                </div>
              </div>
            </div>

            <!-- Back Face -->
            <div class="flashcard-face back">
              <div class="fc-face-header">
                <span class="fc-type-badge" style="color: var(--primary); background: var(--primary-light);">Arka Yüz (Açıklama / Cevap)</span>
                <div class="fc-face-tools">
                  <button class="tool-icon-btn ${isBookmarked ? 'active' : ''}" id="btn-bookmark-fc-back" title="Yıldızla">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="fc-face-body">
                <div class="fc-main-text" style="font-size: 18px; font-weight: 500;">
                  ${this.escapeHtml(currentFc.back)}
                </div>
                ${currentFc.reference ? `
                  <div class="fc-reference-tag">
                    ${this.escapeHtml(currentFc.reference)}
                  </div>
                ` : ''}
              </div>

              <div class="fc-face-footer">
                <div class="fc-hint-pill">
                  Ön yüze dönmek için <kbd class="fc-kbd">Space</kbd> tuşuna basın
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Action Toolbar -->
        <div class="fc-action-toolbar">
          <!-- Track Progress Toggle -->
          <div class="fc-toggle-wrap">
            <span>İlerlemeyi Takip Et</span>
            <input type="checkbox" id="toggle-track-progress" class="switch-input" ${this.trackProgress ? 'checked' : ''} />
            <label for="toggle-track-progress" class="switch-label"></label>
          </div>

          <!-- Rate Buttons (Iconic Solvely Circular Controls) -->
          <div class="fc-rating-actions">
            <button class="btn-fc-circle rate-wrong" id="btn-rate-review" title="Tekrar Gerekiyor (Kısayol: Sol Ok veya X)">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <button class="btn-fc-circle rate-correct" id="btn-rate-mastered" title="Öğrenildi (Kısayol: Sağ Ok veya C)">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          </div>

          <!-- Side Tools: Shuffle & Nav -->
          <div class="fc-side-tools">
            <button class="btn-icon" id="btn-shuffle-fc" title="Kartları Karıştır">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
              </svg>
            </button>
            <button class="btn-icon" id="btn-prev-fc" title="Önceki Kart" ${this.currentIndex === 0 ? 'disabled style="opacity:0.4"' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button class="btn-icon" id="btn-next-fc" title="Sonraki Kart" ${this.currentIndex === total - 1 ? 'disabled style="opacity:0.4"' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindCardEvents(currentFc);
  }

  renderListView(container, subtopic) {
    container.innerHTML = `
      <div class="view-header fade-in">
        <div class="view-meta">
          <span class="view-status-tag">Liste Görünümü</span>
          <div class="view-title-row">
            <h1 class="view-title">${subtopic?.title || 'Flashcards'}</h1>
            <span class="view-count-badge">${this.flashcards.length} Kart</span>
          </div>
        </div>

        <div class="mode-tabs">
          <button class="mode-tab-btn ${this.viewMode === 'card' ? 'active' : ''}" id="btn-view-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="5" width="20" height="14" rx="2"></rect>
              <line x1="2" y1="10" x2="22" y2="10"></line>
            </svg>
            Kart
          </button>
          <button class="mode-tab-btn ${this.viewMode === 'list' ? 'active' : ''}" id="btn-view-list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            Liste
          </button>
        </div>
      </div>

      <div class="flashcards-wrapper fade-in">
        <div class="fc-list-view">
          ${this.flashcards.map((fc, idx) => {
            const status = this.ratings[fc.id];
            return `
              <div class="fc-list-card">
                <div class="fc-list-front">
                  <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">#${idx + 1} Soru</div>
                  ${this.escapeHtml(fc.front)}
                </div>
                <div class="fc-list-back">
                  <div style="font-size: 11px; font-weight: 700; color: var(--primary); margin-bottom: 4px;">Cevap & Açıklama</div>
                  ${this.escapeHtml(fc.back)}
                  ${fc.reference ? `<div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">Kaynak: ${this.escapeHtml(fc.reference)}</div>` : ''}
                </div>
                <div>
                  <span class="dot-indicator ${status === 'mastered' ? 'dot-mastered' : status === 'review' ? 'dot-review' : 'dot-unmarked'}" title="${status || 'Henüz Çözülmedi'}"></span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-view-card')?.addEventListener('click', () => {
      this.viewMode = 'card';
      this.render();
    });
    document.getElementById('btn-view-list')?.addEventListener('click', () => {
      this.viewMode = 'list';
      this.render();
    });
  }

  bindCardEvents(currentFc) {
    // Flip Card Click
    const stage = document.getElementById('fc-stage');
    stage?.addEventListener('click', (e) => {
      if (e.target.closest('.tool-icon-btn')) return;
      this.isFlipped = !this.isFlipped;
      stage.classList.toggle('flipped', this.isFlipped);
    });

    // View Switchers
    document.getElementById('btn-view-card')?.addEventListener('click', () => {
      this.viewMode = 'card';
      this.render();
    });
    document.getElementById('btn-view-list')?.addEventListener('click', () => {
      this.viewMode = 'list';
      this.render();
    });

    // Bookmarks
    const toggleBm = () => {
      Storage.toggleBookmark(currentFc.id);
      this.render();
    };
    document.getElementById('btn-bookmark-fc')?.addEventListener('click', toggleBm);
    document.getElementById('btn-bookmark-fc-back')?.addEventListener('click', toggleBm);

    // Track Progress
    document.getElementById('toggle-track-progress')?.addEventListener('change', (e) => {
      this.trackProgress = e.target.checked;
      Storage.setTrackProgress(this.trackProgress);
    });

    // Rate Review (X)
    document.getElementById('btn-rate-review')?.addEventListener('click', () => {
      this.rateCard('review');
    });

    // Rate Mastered (✓)
    document.getElementById('btn-rate-mastered')?.addEventListener('click', () => {
      this.rateCard('mastered');
    });

    // Shuffle
    document.getElementById('btn-shuffle-fc')?.addEventListener('click', () => {
      this.shuffle();
    });

    // Prev / Next
    document.getElementById('btn-prev-fc')?.addEventListener('click', () => {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.isFlipped = false;
        this.render();
      }
    });

    document.getElementById('btn-next-fc')?.addEventListener('click', () => {
      if (this.currentIndex < this.flashcards.length - 1) {
        this.currentIndex++;
        this.isFlipped = false;
        this.render();
      }
    });
  }

  rateCard(rating) {
    const currentFc = this.flashcards[this.currentIndex];
    if (this.trackProgress && currentFc) {
      Storage.setFlashcardRating(currentFc.id, rating);
      this.ratings[currentFc.id] = rating;
      if (this.onStateChange) this.onStateChange();
    }

    if (this.currentIndex < this.flashcards.length - 1) {
      this.currentIndex++;
      this.isFlipped = false;
      this.render();
    } else {
      // Reached the end of flashcards deck -> Show summary of review and mastered cards
      this.renderSummary();
    }
  }

  renderSummary() {
    const container = document.getElementById('view-container');
    if (!container) return;

    const subtopic = this.dataManager.getActiveSubtopic();
    const reviewCards = this.flashcards.filter(fc => this.ratings[fc.id] === 'review');
    const masteredCards = this.flashcards.filter(fc => this.ratings[fc.id] === 'mastered');
    const unratedCards = this.flashcards.filter(fc => !this.ratings[fc.id]);

    const total = this.flashcards.length;
    const masteredPercent = total > 0 ? Math.round((masteredCards.length / total) * 100) : 0;

    container.innerHTML = `
      <div class="view-header fade-in">
        <div class="view-meta">
          <span class="view-status-tag">Tamamlandı</span>
          <h1 class="view-title">Flashcard Çalışma Özeti</h1>
        </div>
      </div>

      <div class="flashcards-wrapper fade-in">
        <div class="quiz-card quiz-summary-card">
          <div class="quiz-score-circle">
            %${masteredPercent}
            <span>ÖĞRENİLDİ</span>
          </div>

          <h2 style="font-size: 19px; font-weight: 700;">
            ${reviewCards.length === 0 ? 'Tebrikler! Tüm Kartları Öğrendiniz' : `${reviewCards.length} Kart Tekrar Edilmeyi Bekliyor`}
          </h2>

          <div class="summary-stats-grid">
            <div class="summary-stat-box">
              <div class="summary-stat-value" style="color: var(--success);">${masteredCards.length}</div>
              <div class="summary-stat-label">Öğrenildi</div>
            </div>
            <div class="summary-stat-box">
              <div class="summary-stat-value" style="color: var(--danger);">${reviewCards.length}</div>
              <div class="summary-stat-label">Tekrar Gereken</div>
            </div>
            <div class="summary-stat-box">
              <div class="summary-stat-value" style="color: var(--text-muted);">${unratedCards.length}</div>
              <div class="summary-stat-label">İşaretsiz</div>
            </div>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-bottom: 8px;">
            <button class="btn-primary" id="btn-next-to-quiz" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
              3. Adım: Quiz Testine Geç →
            </button>
            ${reviewCards.length > 0 ? `
              <button class="btn-primary" id="btn-study-review-only" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
                Sadece Tekrar Gerekenleri (${reviewCards.length}) Çalış
              </button>
            ` : ''}
            <button class="btn-ghost" id="btn-restart-all-fc">Tüm Kartları Baştan Çalış</button>
            <button class="btn-ghost" id="btn-open-list-view">Tüm Listeyi Gör</button>
          </div>
        </div>

        ${reviewCards.length > 0 ? `
          <div class="section-full-block fade-in" style="margin-top: 10px;">
            <div class="section-full-header" style="color: var(--danger);">
              <span>Tekrar Gereken Yanlış / Eksik Kartlar (${reviewCards.length})</span>
            </div>
            <div class="fc-list-view">
              ${reviewCards.map((fc, idx) => `
                <div class="fc-list-card" style="border-left: 3px solid var(--danger);">
                  <div class="fc-list-front">
                    <div style="font-size: 11px; font-weight: 700; color: var(--danger); margin-bottom: 4px;">#${idx + 1} Soru / Kavram</div>
                    ${this.escapeHtml(fc.front)}
                  </div>
                  <div class="fc-list-back">
                    <div style="font-size: 11px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">Cevap & Açıklama</div>
                    ${this.escapeHtml(fc.back)}
                    ${fc.reference ? `<div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">Kaynak: ${this.escapeHtml(fc.reference)}</div>` : ''}
                  </div>
                  <div>
                    <span class="dot-indicator dot-review" title="Tekrar Gerekiyor"></span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Bind Summary Actions
    document.getElementById('btn-next-to-quiz')?.addEventListener('click', () => {
      if (this.onNavigate) this.onNavigate('quiz');
    });

    document.getElementById('btn-study-review-only')?.addEventListener('click', () => {
      this.flashcards = reviewCards;
      this.currentIndex = 0;
      this.isFlipped = false;
      this.render();
    });

    document.getElementById('btn-restart-all-fc')?.addEventListener('click', () => {
      this.loadFlashcardsForActiveSubtopic(false);
    });

    document.getElementById('btn-open-list-view')?.addEventListener('click', () => {
      this.viewMode = 'list';
      this.render();
    });
  }

  handleKeyDown(e) {
    if (this.viewMode !== 'card' || this.flashcards.length === 0) return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      this.isFlipped = !this.isFlipped;
      const stage = document.getElementById('fc-stage');
      if (stage) stage.classList.toggle('flipped', this.isFlipped);
    } else if (e.code === 'ArrowLeft' || e.key.toLowerCase() === 'x') {
      this.rateCard('review');
    } else if (e.code === 'ArrowRight' || e.key.toLowerCase() === 'c') {
      this.rateCard('mastered');
    } else if (e.code === 'ArrowUp') {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.isFlipped = false;
        this.render();
      }
    } else if (e.code === 'ArrowDown') {
      if (this.currentIndex < this.flashcards.length - 1) {
        this.currentIndex++;
        this.isFlipped = false;
        this.render();
      }
    }
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
