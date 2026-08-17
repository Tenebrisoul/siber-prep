/**
 * Storage Manager for Study Platform
 * 100% Client-Side Local Storage (Each visitor's progress is saved exclusively in their own browser)
 */
const StorageKey = {
  QUIZ_PROGRESS: 'siber_quiz_progress',
  FC_PROGRESS: 'siber_fc_progress',
  BOOKMARKS: 'siber_bookmarks',
  THEME: 'siber_theme',
  TRACK_PROGRESS: 'siber_track_progress',
  LAST_STATE: 'siber_last_state'
};

export const Storage = {
  // Theme (Dark / Light)
  getTheme() {
    return localStorage.getItem(StorageKey.THEME) || 'light';
  },
  setTheme(theme) {
    localStorage.setItem(StorageKey.THEME, theme);
  },

  // Track Progress Toggle
  getTrackProgress() {
    const val = localStorage.getItem(StorageKey.TRACK_PROGRESS);
    return val === null ? true : val === 'true';
  },
  setTrackProgress(enabled) {
    localStorage.setItem(StorageKey.TRACK_PROGRESS, String(enabled));
  },

  // Last Active State (Section, Subtopic, Mode)
  getLastState() {
    try {
      const state = localStorage.getItem(StorageKey.LAST_STATE);
      return state ? JSON.parse(state) : null;
    } catch (e) {
      return null;
    }
  },
  saveLastState(sectionId, subtopicId, mode) {
    try {
      const state = { sectionId, subtopicId, mode, updatedAt: Date.now() };
      localStorage.setItem(StorageKey.LAST_STATE, JSON.stringify(state));
    } catch (e) {}
  },

  // Quiz Progress: { [questionId]: { selectedIndex, isCorrect, timestamp } }
  getQuizProgress() {
    try {
      const p = localStorage.getItem(StorageKey.QUIZ_PROGRESS);
      return p ? JSON.parse(p) : {};
    } catch (e) {
      return {};
    }
  },
  saveQuizAnswer(questionId, selectedIndex, isCorrect) {
    const p = this.getQuizProgress();
    p[questionId] = { selectedIndex, isCorrect, timestamp: Date.now() };
    localStorage.setItem(StorageKey.QUIZ_PROGRESS, JSON.stringify(p));
  },
  clearQuizAnswer(questionId) {
    const p = this.getQuizProgress();
    delete p[questionId];
    localStorage.setItem(StorageKey.QUIZ_PROGRESS, JSON.stringify(p));
  },

  // Flashcards Progress: { [cardId]: 'mastered' | 'review' }
  getFlashcardsProgress() {
    try {
      const p = localStorage.getItem(StorageKey.FC_PROGRESS);
      return p ? JSON.parse(p) : {};
    } catch (e) {
      return {};
    }
  },
  setFlashcardRating(cardId, rating) {
    const p = this.getFlashcardsProgress();
    p[cardId] = rating; // 'mastered' or 'review'
    localStorage.setItem(StorageKey.FC_PROGRESS, JSON.stringify(p));
  },
  clearFlashcardRating(cardId) {
    const p = this.getFlashcardsProgress();
    delete p[cardId];
    localStorage.setItem(StorageKey.FC_PROGRESS, JSON.stringify(p));
  },

  // Bookmarks: array of question/card IDs
  getBookmarks() {
    try {
      const b = localStorage.getItem(StorageKey.BOOKMARKS);
      return b ? JSON.parse(b) : [];
    } catch (e) {
      return [];
    }
  },
  toggleBookmark(id) {
    const b = this.getBookmarks();
    const index = b.indexOf(id);
    if (index > -1) {
      b.splice(index, 1);
    } else {
      b.push(id);
    }
    localStorage.setItem(StorageKey.BOOKMARKS, JSON.stringify(b));
    return b.includes(id);
  },
  isBookmarked(id) {
    return this.getBookmarks().includes(id);
  },

  // Reset All Visitor's Progress
  resetAllProgress() {
    localStorage.removeItem(StorageKey.QUIZ_PROGRESS);
    localStorage.removeItem(StorageKey.FC_PROGRESS);
    localStorage.removeItem(StorageKey.BOOKMARKS);
    localStorage.removeItem(StorageKey.LAST_STATE);
  }
};
