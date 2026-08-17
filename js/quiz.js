import { Storage } from './storage.js';

export class QuizModule {
  constructor(dataManager, onStateChange) {
    this.dataManager = dataManager;
    this.onStateChange = onStateChange;
    this.questions = [];
    this.currentIndex = 0;
    this.userAnswers = {}; // local cache of session answers
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  init() {
    this.userAnswers = Storage.getQuizProgress();
    this.loadQuestionsForActiveSubtopic();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  loadQuestionsForActiveSubtopic(all = false) {
    if (all) {
      this.questions = this.dataManager.getAllQuestions();
    } else {
      const subtopic = this.dataManager.getActiveSubtopic();
      if (!subtopic || !subtopic.quiz) {
        this.questions = [];
      } else {
        this.questions = subtopic.quiz.map((q, idx) => ({
          ...q,
          subtopicId: subtopic.id,
          subtopicTitle: subtopic.title,
          sectionTitle: subtopic.sectionTitle,
          qIndexInTopic: idx + 1
        }));
      }
    }
    this.currentIndex = 0;
    this.render();
  }

  render() {
    const container = document.getElementById('view-container');
    if (!container) return;

    if (this.questions.length === 0) {
      container.innerHTML = `
        <div class="view-header fade-in">
          <div class="view-meta">
            <span class="view-status-tag">Quiz Modu</span>
            <div class="view-title-row">
              <h1 class="view-title">${this.dataManager.getActiveSubtopic()?.title || 'Seçili Konu'}</h1>
              <span class="view-count-badge">0 Soru</span>
            </div>
          </div>
        </div>
        <div class="quiz-wrapper fade-in">
          <div class="quiz-card" style="text-align:center; padding: 48px 24px;">
            <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Bu konuda henüz test sorusu bulunmuyor.</h3>
            <p style="color: var(--text-muted); font-size: 13.5px; margin-bottom: 20px;">
              JSON dosyanıza bu alt konu için "quiz" soruları ekleyebilir veya tüm soruları toplu çözebilirsiniz.
            </p>
            <div>
              <button class="btn-primary" id="btn-show-all-quizzes">Tüm Konuların Sorularını Çöz</button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-show-all-quizzes')?.addEventListener('click', () => {
        this.loadQuestionsForActiveSubtopic(true);
      });
      return;
    }

    const currentQ = this.questions[this.currentIndex];
    const total = this.questions.length;
    const progressPercent = Math.round(((this.currentIndex + 1) / total) * 100);
    const existingAnswer = this.userAnswers[currentQ.id];
    const isBookmarked = Storage.isBookmarked(currentQ.id);

    const letters = ['A', 'B', 'C', 'D', 'E'];

    container.innerHTML = `
      <div class="view-header fade-in">
        <div class="view-meta">
          <span class="view-status-tag">Soru ${this.currentIndex + 1} / ${total}</span>
          <div class="view-title-row">
            <h1 class="view-title">${currentQ.subtopicTitle || 'Test Sınavı'}</h1>
          </div>
        </div>
        <span class="view-count-badge">%${progressPercent} Tamamlandı</span>
      </div>

      <div class="quiz-wrapper fade-in">
        <!-- Progress Bar -->
        <div class="quiz-progress-bar-wrap">
          <div class="quiz-progress-fill" style="width: ${progressPercent}%"></div>
        </div>

        <!-- Quick Question Strip -->
        <div class="quiz-question-strip">
          ${this.questions.map((q, idx) => {
            const ans = this.userAnswers[q.id];
            let dotClass = '';
            if (idx === this.currentIndex) dotClass = 'current';
            else if (ans) dotClass = ans.isCorrect ? 'answered-correct' : 'answered-wrong';
            return `<button class="question-dot-btn ${dotClass}" data-goto-q="${idx}" title="Soru ${idx + 1}">${idx + 1}</button>`;
          }).join('')}
        </div>

        <!-- Question Card -->
        <div class="quiz-card">
          <div class="quiz-card-header">
            <span class="question-number-tag">Question ${this.currentIndex + 1}</span>
            <div class="quiz-card-tools">
              ${existingAnswer ? `
                <button class="btn-ghost" id="btn-retry-this-q" style="font-size: 11.5px; padding: 4px 10px;" title="Bu sorunun cevabını temizle ve yeniden çöz">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="1 4 1 10 7 10"></polyline>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                  </svg>
                  Yeniden Çöz
                </button>
              ` : ''}
              <button class="tool-icon-btn ${isBookmarked ? 'active' : ''}" id="btn-bookmark-q" title="Favorilere Ekle">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </button>
            </div>
          </div>

          <div class="question-prompt">
            ${this.escapeHtml(currentQ.question)}
          </div>

          <!-- Options List (Solvely Clean Style) -->
          <div class="quiz-options-list" id="options-list">
            ${currentQ.options.map((opt, optIdx) => {
              let stateClass = '';
              if (existingAnswer) {
                if (optIdx === currentQ.correctIndex) {
                  stateClass = 'correct';
                } else if (optIdx === existingAnswer.selectedIndex) {
                  stateClass = 'incorrect';
                }
              }

              return `
                <div class="quiz-option-item ${stateClass} ${existingAnswer ? 'disabled' : ''}" data-index="${optIdx}">
                  <span class="quiz-option-text">${this.escapeHtml(opt)}</span>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Explanation Box -->
          ${existingAnswer ? `
            <div class="quiz-explanation-box">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div class="explanation-title" style="color: ${existingAnswer.isCorrect ? 'var(--success)' : 'var(--danger)'}">
                  ${existingAnswer.isCorrect ? '✓ Doğru Cevap' : '✕ Yanlış Cevap (Doğru seçenek yeşil ile vurgulanmıştır)'}
                </div>
                <button class="btn-ghost" id="btn-retry-this-q-box" style="font-size: 11px; padding: 2px 8px; height: 26px;">
                  Tekrar Dene
                </button>
              </div>
              <div class="explanation-text">
                ${this.escapeHtml(currentQ.explanation || 'Bu soru için açıklama girilmemiştir.')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Navigation Footer -->
        <div class="quiz-footer">
          <div class="quiz-pagination-stats">
            Kalan: ${total - (this.currentIndex + 1)} soru
          </div>
          <div class="quiz-nav-btns">
            <button class="btn-ghost" id="btn-prev-q" ${this.currentIndex === 0 ? 'disabled style="opacity:0.4; cursor:not-allowed"' : ''}>
              ← Önceki Soru
            </button>
            ${this.currentIndex < total - 1 ? `
              <button class="btn-primary" id="btn-next-q">
                Sonraki Soru →
              </button>
            ` : `
              <button class="btn-primary" id="btn-finish-quiz" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                Sınavı Tamamla
              </button>
            `}
          </div>
        </div>
      </div>
    `;

    this.bindEvents(currentQ, existingAnswer);
  }

  bindEvents(currentQ, existingAnswer) {
    // Option Click
    if (!existingAnswer) {
      const optionItems = document.querySelectorAll('.quiz-option-item');
      optionItems.forEach(item => {
        item.addEventListener('click', () => {
          const selectedIdx = parseInt(item.getAttribute('data-index'), 10);
          this.selectOption(currentQ, selectedIdx);
        });
      });
    }

    // Retry Question Buttons
    const retryQuestion = () => {
      Storage.clearQuizAnswer(currentQ.id);
      delete this.userAnswers[currentQ.id];
      if (this.onStateChange) this.onStateChange();
      this.render();
    };
    document.getElementById('btn-retry-this-q')?.addEventListener('click', retryQuestion);
    document.getElementById('btn-retry-this-q-box')?.addEventListener('click', retryQuestion);

    // Bookmark Click
    document.getElementById('btn-bookmark-q')?.addEventListener('click', () => {
      Storage.toggleBookmark(currentQ.id);
      this.render();
    });

    // Strip Goto Clicks
    document.querySelectorAll('[data-goto-q]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetIdx = parseInt(btn.getAttribute('data-goto-q'), 10);
        if (targetIdx >= 0 && targetIdx < this.questions.length) {
          this.currentIndex = targetIdx;
          this.render();
        }
      });
    });

    // Prev / Next Buttons
    document.getElementById('btn-prev-q')?.addEventListener('click', () => {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.render();
      }
    });

    document.getElementById('btn-next-q')?.addEventListener('click', () => {
      if (this.currentIndex < this.questions.length - 1) {
        this.currentIndex++;
        this.render();
      }
    });

    // Finish Quiz Button
    document.getElementById('btn-finish-quiz')?.addEventListener('click', () => {
      this.renderSummary();
    });
  }

  selectOption(currentQ, selectedIdx) {
    const isCorrect = selectedIdx === currentQ.correctIndex;
    Storage.saveQuizAnswer(currentQ.id, selectedIdx, isCorrect);
    this.userAnswers[currentQ.id] = { selectedIndex: selectedIdx, isCorrect };

    if (this.onStateChange) this.onStateChange();
    this.render();
  }

  handleKeyDown(e) {
    if (this.questions.length === 0) return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    const currentQ = this.questions[this.currentIndex];
    const existingAnswer = this.userAnswers[currentQ.id];

    // Options selection via Keyboard (1-5 or A-E)
    if (!existingAnswer) {
      const key = e.key.toUpperCase();
      const map = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
      if (key in map) {
        const optIdx = map[key];
        if (optIdx < currentQ.options.length) {
          this.selectOption(currentQ, optIdx);
          return;
        }
      }
    }

    // Navigation shortcuts
    if (e.code === 'ArrowRight' || e.code === 'Enter') {
      if (this.currentIndex < this.questions.length - 1) {
        this.currentIndex++;
        this.render();
      }
    } else if (e.code === 'ArrowLeft') {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.render();
      }
    }
  }

  renderSummary() {
    const container = document.getElementById('view-container');
    if (!container) return;

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    this.questions.forEach(q => {
      const ans = this.userAnswers[q.id];
      if (!ans) unansweredCount++;
      else if (ans.isCorrect) correctCount++;
      else wrongCount++;
    });

    const scorePercent = this.questions.length > 0 ? Math.round((correctCount / this.questions.length) * 100) : 0;

    container.innerHTML = `
      <div class="view-header fade-in">
        <div class="view-meta">
          <span class="view-status-tag">Tamamlandı</span>
          <h1 class="view-title">Sınav Sonuç Raporu</h1>
        </div>
      </div>

      <div class="quiz-wrapper fade-in">
        <div class="quiz-card quiz-summary-card">
          <div class="quiz-score-circle">
            %${scorePercent}
            <span>BAŞARI</span>
          </div>

          <h2 style="font-size: 18px; font-weight: 700;">
            ${scorePercent >= 70 ? 'Tebrikler, Başarıyla Tamamladınız' : 'Konuyu Tekrar Edip Yeniden Deneyebilirsiniz'}
          </h2>

          <div class="summary-stats-grid">
            <div class="summary-stat-box">
              <div class="summary-stat-value" style="color: var(--success);">${correctCount}</div>
              <div class="summary-stat-label">Doğru</div>
            </div>
            <div class="summary-stat-box">
              <div class="summary-stat-value" style="color: var(--danger);">${wrongCount}</div>
              <div class="summary-stat-label">Yanlış</div>
            </div>
            <div class="summary-stat-box">
              <div class="summary-stat-value" style="color: var(--text-muted);">${unansweredCount}</div>
              <div class="summary-stat-label">Boş</div>
            </div>
          </div>

          <div style="display: flex; gap: 10px;">
            <button class="btn-primary" id="btn-restart-quiz">Testi Yeniden Başlat</button>
            <button class="btn-ghost" id="btn-review-questions">Soruları İncele</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-restart-quiz')?.addEventListener('click', () => {
      this.currentIndex = 0;
      this.render();
    });

    document.getElementById('btn-review-questions')?.addEventListener('click', () => {
      this.currentIndex = 0;
      this.render();
    });
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
