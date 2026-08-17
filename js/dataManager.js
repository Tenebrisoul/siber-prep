import { Storage } from './storage.js';

export class DataManager {
  constructor() {
    this.data = null;
    this.activeSectionId = null;
    this.activeSubtopicId = null;
    this.filter = 'all'; // 'all' | 'mastered' | 'review' | 'incomplete'
  }

  async loadInitialData() {
    // Fetch directly from project file data/siber_guvenlik.json
    try {
      const res = await fetch('./data/siber_guvenlik.json');
      if (!res.ok) throw new Error('Data file not found');
      const raw = await res.json();
      this.data = this.normalizeData(raw);
    } catch (e) {
      console.warn('Could not fetch data json directly, using embedded fallback template', e);
      this.data = this.getFallbackData();
    }

    this.setDefaultSelection();
    return this.data;
  }

  normalizeData(raw) {
    if (!raw) return { title: 'Çalışma Portalı', sections: [] };

    // Support flat, V4, V3 and V2 formats seamlessly
    const sections = raw.sections || raw.source_v2?.sections || raw.source_v3?.sections || [];
    const title = raw.meta?.title || raw.title || raw.source_v2?.title || 'Siber Güvenlik Çalışma Portalı';
    const description = raw.meta?.purpose || raw.description || raw.source_v2?.description || '';

    return {
      title,
      description,
      sections,
      raw
    };
  }

  setCustomData(jsonData) {
    if (!jsonData || !jsonData.sections || !Array.isArray(jsonData.sections)) {
      throw new Error('Geçersiz veri formatı. "sections" dizisi bulunmalıdır.');
    }
    this.data = jsonData;
    Storage.saveData(jsonData);
    this.setDefaultSelection();
  }

  setDefaultSelection() {
    if (this.data && this.data.sections && this.data.sections.length > 0) {
      this.activeSectionId = this.data.sections[0].id;
      if (this.data.sections[0].subtopics && this.data.sections[0].subtopics.length > 0) {
        this.activeSubtopicId = this.data.sections[0].subtopics[0].id;
      }
    }
  }

  getActiveSection() {
    if (!this.data || !this.data.sections) return null;
    return this.data.sections.find(s => s.id === this.activeSectionId) || this.data.sections[0];
  }

  getActiveSubtopic() {
    if (!this.data || !this.data.sections) return null;
    for (const sec of this.data.sections) {
      const sub = sec.subtopics?.find(s => s.id === this.activeSubtopicId);
      if (sub) return { ...sub, sectionTitle: sec.title };
    }
    return this.data.sections[0]?.subtopics?.[0] || null;
  }

  selectSubtopic(sectionId, subtopicId) {
    this.activeSectionId = sectionId;
    this.activeSubtopicId = subtopicId;
  }

  /**
   * Calculates detailed breakdown status of a subtopic for both Flashcards and Quiz
   */
  getSubtopicDetailedStatus(subtopic) {
    const fcProgress = Storage.getFlashcardsProgress();
    const quizProgress = Storage.getQuizProgress();

    const flashcards = subtopic.flashcards || [];
    const quizzes = subtopic.quiz || [];

    // Flashcards status
    let fcMastered = 0;
    let fcReview = 0;
    let fcAttempted = 0;
    flashcards.forEach(fc => {
      const s = fcProgress[fc.id];
      if (s === 'mastered') { fcMastered++; fcAttempted++; }
      else if (s === 'review') { fcReview++; fcAttempted++; }
    });

    let fcStatus = 'unattempted';
    if (flashcards.length === 0) fcStatus = 'empty';
    else if (fcReview > 0) fcStatus = 'review';
    else if (fcMastered === flashcards.length) fcStatus = 'mastered';
    else if (fcAttempted > 0) fcStatus = 'inprogress';

    // Quiz status
    let quizCorrect = 0;
    let quizWrong = 0;
    let quizAttempted = 0;
    quizzes.forEach(q => {
      const ans = quizProgress[q.id];
      if (ans) {
        quizAttempted++;
        if (ans.isCorrect) quizCorrect++;
        else quizWrong++;
      }
    });

    let quizStatus = 'unattempted';
    if (quizzes.length === 0) quizStatus = 'empty';
    else if (quizWrong > 0) quizStatus = 'review';
    else if (quizCorrect === quizzes.length) quizStatus = 'mastered';
    else if (quizAttempted > 0) quizStatus = 'inprogress';

    // Overall status
    let overall = 'incomplete';
    if (fcStatus === 'review' || quizStatus === 'review') {
      overall = 'review';
    } else if (
      (fcStatus === 'mastered' || fcStatus === 'empty') &&
      (quizStatus === 'mastered' || quizStatus === 'empty') &&
      (fcStatus !== 'empty' || quizStatus !== 'empty')
    ) {
      overall = 'mastered';
    }

    return {
      overall,
      fc: {
        status: fcStatus,
        total: flashcards.length,
        mastered: fcMastered,
        review: fcReview,
        attempted: fcAttempted
      },
      quiz: {
        status: quizStatus,
        total: quizzes.length,
        correct: quizCorrect,
        wrong: quizWrong,
        attempted: quizAttempted
      }
    };
  }

  /**
   * Calculates overall status of a subtopic
   */
  getSubtopicStatus(subtopic) {
    return this.getSubtopicDetailedStatus(subtopic).overall;
  }

  /**
   * Calculate global statistics for sidebar filters
   */
  getGlobalStats(mode = 'quiz') {
    let totalSubtopics = 0;
    let totalItems = 0;
    let masteredSubtopics = 0;
    let reviewSubtopics = 0;
    let incompleteSubtopics = 0;

    if (!this.data || !this.data.sections) {
      return { total: 0, mastered: 0, review: 0, incomplete: 0, masteredPercent: 0 };
    }

    this.data.sections.forEach(sec => {
      (sec.subtopics || []).forEach(sub => {
        totalSubtopics++;
        const count = mode === 'quiz' ? (sub.quiz?.length || 0) : (sub.flashcards?.length || 0);
        totalItems += count;

        const status = this.getSubtopicStatus(sub);
        if (status === 'mastered') masteredSubtopics++;
        else if (status === 'review') reviewSubtopics++;
        else incompleteSubtopics++;
      });
    });

    const masteredPercent = totalSubtopics > 0 ? Math.round((masteredSubtopics / totalSubtopics) * 100) : 0;

    return {
      totalSubtopics,
      totalItems,
      mastered: masteredSubtopics,
      review: reviewSubtopics,
      incomplete: incompleteSubtopics,
      masteredPercent
    };
  }

  /**
   * Returns all quiz questions or flashcards combined across all subtopics or current subtopic
   */
  getAllQuestions() {
    const list = [];
    if (!this.data) return list;
    this.data.sections.forEach(sec => {
      sec.subtopics?.forEach(sub => {
        sub.quiz?.forEach((q, idx) => {
          list.push({
            ...q,
            subtopicId: sub.id,
            subtopicTitle: sub.title,
            sectionTitle: sec.title,
            qIndexInTopic: idx + 1
          });
        });
      });
    });
    return list;
  }

  getAllFlashcards() {
    const list = [];
    if (!this.data) return list;
    this.data.sections.forEach(sec => {
      sec.subtopics?.forEach(sub => {
        sub.flashcards?.forEach(fc => {
          list.push({
            ...fc,
            subtopicId: sub.id,
            subtopicTitle: sub.title,
            sectionTitle: sec.title
          });
        });
      });
    });
    return list;
  }

  getFallbackData() {
    return {
      title: "Siber Güvenlik Soru Cevap Kaynağı",
      sections: [
        {
          id: "sec-1",
          title: "SECTION 1: TEMEL BİLGİ GÜVENLİĞİ KAVRAMLARI",
          subtopics: [
            {
              id: "sub-1-1",
              title: "Güvenlik ilkeleri ve temel tanımlar",
              article: "### Güvenlik İlkeleri\nCIA Triad: Gizlilik, Bütünlük, Erişilebilirlik.",
              flashcards: [
                {
                  id: "fc-1",
                  front: "CIA Triad nedir?",
                  back: "Confidentiality (Gizlilik), Integrity (Bütünlük), Availability (Erişilebilirlik).",
                  reference: "Temel Güvenlik"
                }
              ],
              quiz: [
                {
                  id: "q-1",
                  question: "Bilgi güvenliğini siber güvenlikten ayıran ifade hangisidir?",
                  options: [
                    "Bilgi güvenliği; fiziksel, sözlü ve yazılı bilgiyi de kapsar",
                    "Yalnızca şifreleme ile ilgilenir",
                    "Yalnızca ağ cihazlarını kapsar",
                    "Yalnızca bulut hizmetlerini kapsar"
                  ],
                  correctIndex: 0,
                  explanation: "Bilgi güvenliği her formatta bilginin korunmasını kapsar."
                }
              ]
            }
          ]
        }
      ]
    };
  }
}
