/**
 * Parent Intelligence & Guidance Hub • Question-Led Parent V2
 * Antigravity / Excellencia Junior College
 * Adapted from student-question-design skill & PM Playbook
 */

(function () {
    'use strict';

    // ── Application State ──────────────────────────────────────────────────
    let allStudentsList = [];
    let currentStudentIndex = 0;
    let profileData = {};
    let analyticsData = {};
    let examsData = [];
    let masteryData = [];

    // Base score for simulator
    let baseScore = 115;

    // ── Initialization on DOM Ready ───────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async function () {
        setupNavigation();
        await loadStudentsAndInit();
    });

    /**
     * Set up question-led navigation tabs
     */
    function setupNavigation() {
        const navPills = document.querySelectorAll('.parent-nav-pill');
        const views = document.querySelectorAll('.parent-view');

        navPills.forEach(btn => {
            btn.addEventListener('click', function () {
                const targetViewId = this.getAttribute('data-view');
                if (!targetViewId) return;

                navPills.forEach(p => {
                    p.classList.remove('active', 'bg-teal-700', 'text-white');
                    p.classList.add('bg-slate-100', 'text-slate-700');
                    const icon = p.querySelector('i');
                    if (icon) icon.className = icon.className.replace('text-white', 'text-slate-400');
                });

                this.classList.add('active', 'bg-teal-700', 'text-white');
                this.classList.remove('bg-slate-100', 'text-slate-700');
                const activeIcon = this.querySelector('i');
                if (activeIcon) activeIcon.className = activeIcon.className.replace('text-slate-400', 'text-white');

                views.forEach(v => v.classList.add('hidden'));
                const targetEl = document.getElementById(targetViewId);
                if (targetEl) {
                    targetEl.classList.remove('hidden');
                    targetEl.classList.add('animate-fade-in');
                }
            });
        });
    }

    /**
     * Load list of students from window.STUDENTS_LIST or data/students.json
     */
    async function loadStudentsAndInit() {
        if (typeof window !== 'undefined' && window.STUDENTS_LIST && Array.isArray(window.STUDENTS_LIST) && window.STUDENTS_LIST.length > 0) {
            allStudentsList = window.STUDENTS_LIST;
        } else {
            try {
                const res = await fetch('data/students.json');
                if (res.ok) {
                    allStudentsList = await res.json();
                }
            } catch (e) {
                console.warn('Failed to load students.json, loading fallback student', e);
            }
        }

        const selector = document.getElementById('student-selector');
        if (selector && allStudentsList.length > 0) {
            selector.innerHTML = allStudentsList.map((st, idx) => {
                const name = st.name || `Student ${idx + 1}`;
                const batch = st.batch || 'SR MPC';
                return `<option value="${idx}">${name} • ${batch}</option>`;
            }).join('');

            selector.addEventListener('change', (e) => {
                const idx = parseInt(e.target.value, 10);
                if (!isNaN(idx) && allStudentsList[idx]) {
                    switchStudent(idx);
                }
            });

            // Prefer Bhagam Khyathi if available
            let defaultIdx = allStudentsList.findIndex(s => s.id === 'cf8f2a4c-adb0-4347-8033-5dd956acdc8b');
            if (defaultIdx === -1) defaultIdx = 0;
            selector.value = defaultIdx;
            await switchStudent(defaultIdx);
            return;
        }

        // Fallback single student
        await loadSingleStudent('cf8f2a4c-adb0-4347-8033-5dd956acdc8b');
    }

    /**
     * Switch student by index
     */
    async function switchStudent(index) {
        currentStudentIndex = index;
        const st = allStudentsList[index];
        if (!st) return;
        await loadSingleStudent(st.id);
    }

    /**
     * Load individual student files (supporting preloaded static data)
     */
    async function loadSingleStudent(sid) {
        try {
            if (typeof window !== 'undefined' && window.STUDENT_DATA_STORE && window.STUDENT_DATA_STORE[sid]) {
                const s = window.STUDENT_DATA_STORE[sid];
                profileData = s.profile || { id: sid, name: "Student", targetExam: "jee_mains", batch: "SR MPC" };
                analyticsData = s.analytics || {};
                examsData = Array.isArray(s.exams) ? s.exams : [];
                masteryData = Array.isArray(s.mastery) ? s.mastery : [];
            } else {
                const [profileRes, analyticsRes, examsRes, masteryRes] = await Promise.all([
                    fetch(`data/student_${sid}_profile.json`),
                    fetch(`data/student_${sid}_analytics.json`),
                    fetch(`data/student_${sid}_exams.json`),
                    fetch(`data/student_${sid}_mastery.json`)
                ]);

                profileData = await profileRes.json().catch(() => ({}));
                analyticsData = await analyticsRes.json().catch(() => ({}));
                examsData = await examsRes.json().catch(() => []);
                masteryData = await masteryRes.json().catch(() => []);
            }

            // Target Exam Pill
            const targetPill = document.getElementById('parent-target-pill');
            if (targetPill) {
                const exam = (profileData.targetExam || 'jee_mains').toUpperCase().replace(/_/g, ' ');
                targetPill.textContent = `${exam} 2027`;
            }

            renderStandingView();
            updateSimulator();

        } catch (err) {
            console.error('Error loading student telemetry for parent view:', err);
        }
    }

    // =========================================================================
    // 1. WHERE DOES MY CHILD STAND?
    // =========================================================================
    function renderStandingView() {
        const studentName = profileData.name || 'Bhagam Khyathi';
        const firstName = studentName.split(' ')[0];
        const latestExam = examsData[0] || {};
        baseScore = latestExam.total_score ?? 115;
        const examName = latestExam.name || 'WTM-21 (29 Aug 2026)';

        // Health Score & Dial
        const healthScoreEl = document.getElementById('parent-health-score');
        const healthDial = document.getElementById('health-score-dial');
        let healthScore = 84;
        if (baseScore >= 160) healthScore = 94;
        else if (baseScore >= 130) healthScore = 88;
        else if (baseScore >= 100) healthScore = 84;
        else healthScore = 72;

        if (healthScoreEl) healthScoreEl.textContent = healthScore;
        if (healthDial) healthDial.setAttribute('stroke-dasharray', `${healthScore}, 100`);

        // Update Labels
        const updatedTag = document.getElementById('parent-updated-tag');
        const headline = document.getElementById('parent-glance-headline');
        const desc = document.getElementById('parent-glance-desc');
        const projScore = document.getElementById('parent-proj-score');
        const projPct = document.getElementById('parent-proj-pct');
        const projAir = document.getElementById('parent-proj-air');

        if (updatedTag) updatedTag.textContent = `Updated on ${examName}`;

        if (projScore && projPct && projAir) {
            if (baseScore >= 150) {
                projScore.textContent = '190–220';
                projPct.textContent = '99.1–99.6';
                projAir.textContent = '3.5k–7.5k';
            } else if (baseScore >= 120) {
                projScore.textContent = '170–195';
                projPct.textContent = '98.2–98.9';
                projAir.textContent = '8.5k–14.5k';
            } else if (baseScore >= 100) {
                projScore.textContent = '162–188';
                projPct.textContent = '97.6–98.5';
                projAir.textContent = '13.5k–21k';
            } else {
                projScore.textContent = '135–155';
                projPct.textContent = '94.0–96.5';
                projAir.textContent = '35k–55k';
            }
        }

        if (headline) {
            headline.textContent = `${firstName} is well-positioned for Top NITs & IIITs (${projPct ? projPct.textContent : '97.6–98.5'}%ile projection).`;
        }

        if (desc) {
            desc.textContent = `Her test consistency is 90% (18 of 20 tests written). She scored ${baseScore}/300 on Sunday, well above the batch average (106 marks). Physics is her proven stronghold, while Chemistry has quick, recoverable calculation slips.`;
        }
    }

    // =========================================================================
    // INTERACTIVE "WHAT-IF" RECOVERY SIMULATOR
    // =========================================================================
    window.updateSimulator = function () {
        const calcSlider = document.getElementById('sim-calc-slider');
        const guessSlider = document.getElementById('sim-guess-slider');
        const calcVal = document.getElementById('sim-calc-val');
        const guessVal = document.getElementById('sim-guess-val');
        const upliftedScore = document.getElementById('sim-uplifted-score');
        const netRecovered = document.getElementById('sim-net-recovered');
        const rankText = document.getElementById('sim-projected-rank-text');

        if (!calcSlider || !guessSlider) return;

        const calcMarks = parseInt(calcSlider.value, 10) || 0;
        const guessMarks = parseInt(guessSlider.value, 10) || 0;
        const totalRecovered = calcMarks + guessMarks;

        if (calcVal) calcVal.textContent = `+${calcMarks} Marks`;
        if (guessVal) guessVal.textContent = `+${guessMarks} Marks`;

        const newScore = baseScore + totalRecovered;
        if (upliftedScore) upliftedScore.textContent = `${newScore} / 300`;
        if (netRecovered) netRecovered.textContent = `+${totalRecovered} Recovered`;

        if (rankText) {
            if (totalRecovered >= 16) {
                rankText.textContent = `Pushes All India Rank from ~18,000 → ~11,500 AIR (+6,500 Seats Higher!)`;
            } else if (totalRecovered >= 8) {
                rankText.textContent = `Pushes All India Rank from ~18,000 → ~14,000 AIR (+4,000 Seats Higher!)`;
            } else {
                rankText.textContent = `Pushes All India Rank from ~18,000 → ~16,500 AIR (+1,500 Seats Higher!)`;
            }
        }
    };

})();
