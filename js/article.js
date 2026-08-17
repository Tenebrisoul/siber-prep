export class ArticleModule {
  constructor(dataManager, onNavigate) {
    this.dataManager = dataManager;
    this.onNavigate = onNavigate;
    this.showAll = false;
  }

  init(showAll = false) {
    this.showAll = showAll;
    this.render();
  }

  render() {
    const container = document.getElementById('view-container');
    if (!container) return;

    if (this.showAll) {
      this.renderFullStudyGuide(container);
    } else {
      this.renderSingleTopicArticle(container);
    }
  }

  renderSingleTopicArticle(container) {
    const subtopic = this.dataManager.getActiveSubtopic();
    const section = this.dataManager.getActiveSection();

    if (!subtopic || !subtopic.article) {
      container.innerHTML = `
        <div class="view-header fade-in">
          <div class="view-meta">
            <span class="view-status-tag">1. Adım: Konu Anlatımı</span>
            <h1 class="view-title">${subtopic?.title || 'Konu Rehberi'}</h1>
          </div>
        </div>
        <div class="article-wrapper fade-in">
          <div class="article-card" style="text-align:center; padding: 48px 24px;">
            <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Bu konu için henüz ders notu eklenmemiş.</h3>
            <p style="color: var(--text-muted); font-size: 13.5px; margin-bottom: 20px;">
              Doğrudan hafıza kartları veya quiz testine geçebilirsiniz.
            </p>
            <div style="display: flex; gap: 10px; justify-content: center;">
              <button class="btn-primary" id="btn-goto-fc-direct">Hafıza Kartlarına Geç (Flashcards) →</button>
              <button class="btn-ghost" id="btn-open-full-guide">Tüm Ders Notlarını Aç</button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-goto-fc-direct')?.addEventListener('click', () => {
        if (this.onNavigate) this.onNavigate('flashcards');
      });

      document.getElementById('btn-open-full-guide')?.addEventListener('click', () => {
        this.init(true);
      });
      return;
    }

    container.innerHTML = `
      <div class="view-header fade-in">
        <div class="view-meta">
          <span class="view-status-tag">1. Adım: Konu Anlatımı • ${section?.title || 'Bölüm Rehberi'}</span>
          <div class="view-title-row">
            <h1 class="view-title">${subtopic.title}</h1>
          </div>
        </div>
      </div>

      <div class="article-wrapper fade-in">
        <div class="article-hero">
          <div class="article-badge-row">
            <span class="article-badge">Ders Notu & Özet</span>
            <span style="font-size: 12px; color: var(--text-muted);">
              ${subtopic.flashcards?.length || 0} Flashcard • ${subtopic.quiz?.length || 0} Test Sorusu
            </span>
          </div>
          <h1 class="article-title">${subtopic.title}</h1>
        </div>

        <div class="article-card">
          <div class="article-prose">
            ${this.parseMarkdown(subtopic.article)}
          </div>

          <!-- Next Step CTA: Pipeline (1. Article -> 2. Flashcards) -->
          <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid var(--border-color); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px;">
            <div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text-primary);">Ders notunu tamamladınız mı?</div>
              <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">Kavramları hafıza kartları ile pekiştirip ardından test sınavına geçebilirsiniz.</div>
            </div>
            <button class="btn-primary" id="btn-next-to-fc">
              2. Adım: Flashcards Çalışmasına Geç →
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-next-to-fc')?.addEventListener('click', () => {
      if (this.onNavigate) this.onNavigate('flashcards');
    });
  }

  renderFullStudyGuide(container) {
    const data = this.dataManager.data;
    if (!data || !data.sections) return;

    let allArticlesHtml = '';
    let totalSections = data.sections.length;

    data.sections.forEach(sec => {
      const subtopicsWithArticle = (sec.subtopics || []).filter(sub => sub.article && sub.article.trim().length > 0);

      if (subtopicsWithArticle.length > 0) {
        allArticlesHtml += `
          <div class="section-full-block">
            <div class="section-full-header">
              <span>${sec.title}</span>
            </div>
            ${subtopicsWithArticle.map(sub => `
              <div class="article-card" style="margin-bottom: 16px;">
                <h2 style="font-size: 17px; font-weight: 700; color: var(--primary); margin-bottom: 12px;">
                  ${sub.title}
                </h2>
                <div class="article-prose">
                  ${this.parseMarkdown(sub.article)}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    });

    container.innerHTML = `
      <div class="view-header fade-in">
        <div class="view-meta">
          <span class="view-status-tag">Kapsamlı Rehber</span>
          <h1 class="view-title">Tüm Konu Anlatımları</h1>
        </div>
      </div>

      <div class="article-wrapper fade-in">
        <div class="article-hero">
          <div class="article-badge-row">
            <span class="article-badge">Tüm Bölümler</span>
            <span style="font-size: 12px; color: var(--text-muted);">${totalSections} Bölüm</span>
          </div>
          <h1 class="article-title">${data.title || 'Ders Çalışma Rehberi'}</h1>
          <p style="color: var(--text-secondary); font-size: 14px;">
            Aşağıda tüm bölümlere ait konu anlatımlarını ve özet bilgileri bulabilirsiniz.
          </p>
        </div>

        ${allArticlesHtml || '<div class="article-card"><p>Henüz kayıtlı konu anlatımı bulunmuyor.</p></div>'}
      </div>
    `;
  }

  parseMarkdown(md) {
    if (!md) return '';
    let html = md
      // Headers
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold / Italic
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Blockquotes
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      // Lists
      .replace(/^\s*\*\s+(.*$)/gim, '<li>$1</li>')
      .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
      // Paragraphs
      .replace(/\n\s*\n/gim, '</p><p>');

    return `<p>${html}</p>`.replace(/<p>\s*<\/p>/gim, '');
  }
}
