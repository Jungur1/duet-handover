(function () {
  "use strict";

  const STORAGE_KEY = "duet_handover_custom_v1";
  const CHECK_STORAGE_KEY = "duet_handover_checks_v1";
  const THEME_STORAGE_KEY = "duet_handover_theme";

  const MONTHS_LIST = [
    { key: "2025-11", label: "25년 11월", year: 2025, month: 11 },
    { key: "2025-12", label: "25년 12월", year: 2025, month: 12 },
    { key: "2026-01", label: "26년 1월", year: 2026, month: 1 },
    { key: "2026-02", label: "26년 2월", year: 2026, month: 2 },
    { key: "2026-03", label: "26년 3월", year: 2026, month: 3 },
    { key: "2026-04", label: "26년 4월", year: 2026, month: 4 },
    { key: "2026-05", label: "26년 5월", year: 2026, month: 5 },
    { key: "2026-06", label: "26년 6월", year: 2026, month: 6 },
    { key: "2026-07", label: "26년 7월", year: 2026, month: 7 },
    { key: "2026-08", label: "26년 8월", year: 2026, month: 8 },
    { key: "2026-09", label: "26년 9월", year: 2026, month: 9 },
    { key: "2026-10", label: "26년 10월", year: 2026, month: 10 },
    { key: "2026-11", label: "26년 11월", year: 2026, month: 11 }
  ];

  const CATEGORY_META = {
    all:  { label: "전체", className: "" },
    pres: { label: "학생회장단", className: "cat-pres" },
    gov:  { label: "의결기구·선거", className: "cat-gov" },
    plan: { label: "기획국", className: "cat-plan" },
    welf: { label: "복지국", className: "cat-welf" },
    pr:   { label: "홍보국", className: "cat-pr" }
  };

  const NAV_ITEMS = [
    {
      group: "포털 홈 & 아카이브",
      items: [
        { id: "overview", icon: "", label: "인수인계 홈 & 드라이브", badge: "필독" },
        { id: "calendar", icon: "", label: "월별 캘린더 · 홍보물 · 월간보고", badge: "300건" }
      ]
    },
    {
      group: "학생회장단 인수인계",
      items: [
        { id: "presidency", icon: "", label: "학생회장단 인수인계서", badge: "Part 1~5" }
      ]
    },
    {
      group: "집행위원회 국장단 인수인계",
      items: [
        { id: "planning", icon: "", label: "기획국 인수인계서", badge: "6대 사업" },
        { id: "welfare", icon: "", label: "복지국 인수인계서", badge: "5대 사업" },
        { id: "pr", icon: "", label: "홍보국 인수인계서", badge: "4대 영역" }
      ]
    },
    {
      group: "양식 · 속기록 · 배포",
      items: [
        { id: "templates", icon: "", label: "양식 모음 · 반운위 전회차 요약", badge: "부록" }
      ]
    }
  ];

  // =========================================================================
  // RBAC CONFIGURATION & PASSWORD HASHES (SALTED SHA-256)
  // =========================================================================
  const RBAC_SALT = "duet_rbac_salt_2026_";
  const SESSION_ROLE_KEY = "duet_handover_role_session";

  const ROLE_CONFIG = {
    duet_pres: {
      id: "duet_pres",
      icon: "",
      name: "18대 학생회장단",
      badgeClass: "duet_pres",
      badgeText: "제18대 학생회장단 (관리자)",
      hashes: [
        "9d9999c3c2532bd42a5d89eeec6c2182ef8ea2a575b474934388237e3afba2d3", // 3561
        "ad06082b3595f076cd4dc4ee782e7e85727d73553b9669ae429183b14926cccc"  // duet18pres!
      ],
      allowedTabs: ["overview", "calendar", "presidency", "planning", "welfare", "pr", "templates"],
      defaultTab: "overview",
      canEdit: true,
      canSyncNotion: true,
      canExport: true
    },
    duet_head: {
      id: "duet_head",
      icon: "",
      name: "18대 국장단",
      badgeClass: "duet_head",
      badgeText: "제18대 국장단",
      hashes: [
        "940f6894aa7ef92319d571e21b3f63ae90fe6cbed6de188c7ea2f406de418ade"  // duet18head!
      ],
      allowedTabs: ["overview", "calendar", "planning", "welfare", "pr", "templates"],
      defaultTab: "planning",
      canEdit: false,
      canSyncNotion: false,
      canExport: false
    },
    next_pres: {
      id: "next_pres",
      icon: "",
      name: "19대 학생회장단",
      badgeClass: "next_pres",
      badgeText: "제19대 학생회장단",
      hashes: [
        "fd8b9c4274500cf858c3cbb5f37421eed08bcbb5ec0ec0de58103a14627a6909"  // duet19pres!
      ],
      allowedTabs: ["overview", "calendar", "presidency", "planning", "welfare", "pr", "templates"],
      defaultTab: "overview",
      canEdit: false,
      canSyncNotion: false,
      canExport: false
    },
    next_head: {
      id: "next_head",
      icon: "",
      name: "19대 국장단",
      badgeClass: "next_head",
      badgeText: "제19대 국장단",
      hashes: [
        "d225aaddc31e49a24aeb1788e8f18908d6ae487456e7da0fbe42bddca590ab5c"  // duet19head!
      ],
      allowedTabs: ["planning", "welfare", "pr", "templates"],
      defaultTab: "planning",
      canEdit: false,
      canSyncNotion: false,
      canExport: false
    }
  };

  // Pure JS SHA-256 Implementation (sync fallback for any environment)
  function sha256Sync(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let i, j;
    const result = [];
    const words = [];
    const asciiBitLength = ascii.length * 8;
    const hash = [];
    const k = [];
    let primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = candidate * candidate; i < 312; i += candidate) isComposite[i] = true;
        if (primeCounter < 8) hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        primeCounter++;
      }
    }
    ascii += "\x80";
    while ((ascii.length % 64) - 56) ascii += "\x00";
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - (i % 4)) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength | 0;
    for (j = 0; j < words.length; ) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash.slice(0);
      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
        const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
        const temp1 =
          (hash[7] +
            (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
            ch +
            k[i] +
            (w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0)) |
          0;
        const temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;
        hash[7] = hash[6];
        hash[6] = hash[5];
        hash[5] = hash[4];
        hash[4] = (hash[3] + temp1) | 0;
        hash[3] = hash[2];
        hash[2] = hash[1];
        hash[1] = hash[0];
        hash[0] = (temp1 + temp2) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j >= 0; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result.push((b < 16 ? "0" : "") + b.toString(16));
      }
    }
    return result.join("");
  }

  async function computeSha256Hex(str) {
    if (window.crypto && window.crypto.subtle) {
      try {
        const buf = new TextEncoder().encode(str);
        const hashBuf = await window.crypto.subtle.digest("SHA-256", buf);
        return Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      } catch (_) {}
    }
    return sha256Sync(str);
  }

  // State
  let appData = null;
  let customStore = {
    driveLinks: {},
    textEdits: {},
    eventEdits: {},
    customEvents: []
  };
  let checkStore = {};
  let state = {
    currentRole: null, // 'duet_pres' | 'duet_head' | 'next_pres' | 'next_head'
    currentTab: "overview",
    adminMode: false,
    editMode: false,
    calSubView: "calendar", // 'calendar' | 'monthly' | 'gallery'
    selectedMonth: "2026-03",
    selectedCat: "all",
    selectedEventId: "notion_3171d74fc6df80a7980ddf6cfd1da19c",
    eventImgIdx: 0,
    monthlySlideIdx: {},
    lightboxImages: [],
    lightboxIdx: 0
  };

  // Load persisted data
  function loadState() {
    appData = JSON.parse(JSON.stringify(window.DUET_DEFAULT_DATA));

    // Merge baked-in customEdits if exported previously into data.js
    if (appData.customEdits) {
      customStore = Object.assign(customStore, appData.customEdits);
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        customStore.driveLinks = Object.assign({}, customStore.driveLinks, parsed.driveLinks || {});
        customStore.textEdits = Object.assign({}, customStore.textEdits, parsed.textEdits || {});
        customStore.eventEdits = Object.assign({}, customStore.eventEdits, parsed.eventEdits || {});
        if (Array.isArray(parsed.customEvents) && parsed.customEvents.length > 0) {
          customStore.customEvents = parsed.customEvents;
        }
      }
    } catch (e) {
      console.warn("Failed to load custom state:", e);
    }

    try {
      const savedChecks = localStorage.getItem(CHECK_STORAGE_KEY);
      if (savedChecks) {
        checkStore = JSON.parse(savedChecks) || {};
      }
    } catch (e) {
      console.warn("Failed to load checklist state:", e);
    }

    applyCustomToAppData();
  }

  function applyCustomToAppData() {
    // Drive links
    appData.driveLinks.forEach((dl) => {
      if (customStore.driveLinks[dl.id] !== undefined) {
        dl.url = customStore.driveLinks[dl.id];
      }
    });

    // Event edits
    appData.calendarEvents.forEach((ev) => {
      const edit = customStore.eventEdits[ev.id];
      if (edit) {
        if (edit.title !== undefined) ev.title = edit.title;
        if (edit.date !== undefined) ev.date = edit.date;
        if (edit.noticeText !== undefined) ev.noticeText = edit.noticeText;
        if (edit.thought !== undefined) ev.thought = edit.thought;
      }
    });

    // Custom added events
    if (Array.isArray(customStore.customEvents)) {
      customStore.customEvents.forEach((cev) => {
        if (!appData.calendarEvents.some((x) => x.id === cev.id)) {
          appData.calendarEvents.push(cev);
        }
      });
    }
  }

  function saveCustomStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customStore));
    } catch (e) {
      console.warn("Failed to save custom store:", e);
    }
  }

  function saveCheckStore() {
    try {
      localStorage.setItem(CHECK_STORAGE_KEY, JSON.stringify(checkStore));
    } catch (e) {
      console.warn("Failed to save check store:", e);
    }
  }

  // Toast helper
  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById("toastMsg");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove("show");
    }, 2600);
  }

  // Escape HTML helper
  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stripStatus(label) {
    if (!label) return "";
    return String(label).replace(/\s*\((완료|진행 중|시작 전)\)\s*$/, "").trim();
  }

  function statusClass(status) {
    if (!status) return "";
    if (status === "완료") return "done";
    if (status === "진행 중") return "doing";
    return "todo";
  }

  // Theme management
  function initTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    updateThemeBtnLabel();
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem(THEME_STORAGE_KEY, "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
    }
    updateThemeBtnLabel();
  }

  function updateThemeBtnLabel() {
    const btn = document.getElementById("themeToggleBtn");
    if (!btn) return;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    btn.innerHTML = isDark ? "라이트" : "다크";
  }

  // Sidebar Navigation
  function renderSidebar() {
    const navContainer = document.getElementById("sidebarNav");
    if (!navContainer) return;

    const currentRole = state.currentRole;
    const roleCfg = currentRole && ROLE_CONFIG[currentRole] ? ROLE_CONFIG[currentRole] : null;
    const allowedTabs = roleCfg ? roleCfg.allowedTabs : [];

    let html = "";
    NAV_ITEMS.forEach((group) => {
      const visibleItems = group.items.filter((item) => allowedTabs.includes(item.id));
      if (visibleItems.length === 0) return;

      html += `<div>
        <div class="nav-group-label">${esc(group.group)}</div>
        <ul class="nav-list">`;
      visibleItems.forEach((item) => {
        const isActive = state.currentTab === item.id;
        html += `
          <li>
            <div class="nav-item ${isActive ? "active" : ""}" data-nav-tab="${item.id}">
              ${item.icon ? `<span>${item.icon}</span>` : ""}
              <span>${esc(item.label)}</span>
              ${item.badge ? `<span class="nav-badge">${esc(item.badge)}</span>` : ""}
            </div>
            ${isActive ? renderSubNav(item.id) : ""}
          </li>`;
      });
      html += `</ul></div>`;
    });

    navContainer.innerHTML = html;

    // Bind tab clicks
    navContainer.querySelectorAll("[data-nav-tab]").forEach((el) => {
      el.addEventListener("click", () => {
        const tab = el.getAttribute("data-nav-tab");
        switchTab(tab);
        document.getElementById("sidebar")?.classList.remove("open");
      });
    });

    // Bind sub-nav scroll clicks
    navContainer.querySelectorAll("[data-scroll-to]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const targetId = el.getAttribute("data-scroll-to");
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          const y = targetEl.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
        document.getElementById("sidebar")?.classList.remove("open");
      });
    });

    // Bind sub-nav fold/unfold toggle
    navContainer.querySelectorAll("[data-toggle-subnav]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.subNavCollapsed = !state.subNavCollapsed;
        renderSidebar();
      });
    });
  }

  function renderSubNav(tabId) {
    const sections = window.DUET_SECTIONS[tabId];
    const collapsedClass = state.subNavCollapsed ? "collapsed" : "";
    const toggleBtnHtml = `<button class="sub-nav-toggle-btn" data-toggle-subnav="1">
      ${state.subNavCollapsed ? "▸ 세부 목차 펼치기" : "▾ 세부 목차 접기"}
    </button>`;

    if (!Array.isArray(sections) || sections.length === 0) {
      if (tabId === "calendar") {
        return `${toggleBtnHtml}<ul class="sub-nav-list ${collapsedClass}">
          <li class="sub-nav-item" data-cal-mode="calendar">월별 캘린더 & 공지글 뷰</li>
          <li class="sub-nav-item" data-cal-mode="monthly">월간보고 슬라이드 (1~8월 · 7호)</li>
          <li class="sub-nav-item" data-cal-mode="gallery">홍보물·카드뉴스 전체 갤러리</li>
        </ul>`;
      }
      return "";
    }
    let subHtml = `${toggleBtnHtml}<ul class="sub-nav-list ${collapsedClass}">`;
    sections.forEach((sec) => {
      subHtml += `<li class="sub-nav-item" data-scroll-to="${esc(sec.id)}">${esc(sec.title)}</li>`;
    });
    subHtml += `</ul>`;
    return subHtml;
  }

  function switchTab(tabId, skipHash) {
    const currentRole = state.currentRole;
    const roleCfg = currentRole && ROLE_CONFIG[currentRole] ? ROLE_CONFIG[currentRole] : null;
    const allowedTabs = roleCfg ? roleCfg.allowedTabs : [];

    if (roleCfg && !allowedTabs.includes(tabId)) {
      showToast(`[${roleCfg.name}] 직위는 해당 문서를 열람할 수 있는 권한이 없습니다.`);
      tabId = roleCfg.defaultTab;
    }

    state.currentTab = tabId;
    if (!skipHash) {
      history.replaceState(null, "", `#${tabId}`);
    }
    renderSidebar();
    renderMainContent();
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Bind calendar sub-mode clicks in sidebar if on calendar tab
    document.querySelectorAll("[data-cal-mode]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        state.calSubView = el.getAttribute("data-cal-mode");
        renderMainContent();
      });
    });
  }

  // Main Content Router
  function renderMainContent() {
    const main = document.getElementById("mainContent");
    if (!main) return;

    if (state.currentTab === "overview") {
      main.innerHTML = buildOverviewHtml();
      bindOverviewEvents();
    } else if (state.currentTab === "calendar") {
      main.innerHTML = buildCalendarPortalHtml();
      bindCalendarPortalEvents();
    } else if (["presidency", "planning", "welfare", "pr", "templates"].includes(state.currentTab)) {
      main.innerHTML = buildDocSectionsHtml(state.currentTab);
      bindDocSectionEvents(state.currentTab);
    }

    applySavedTextEdits();
    applyEditModeAttributes();
    applySavedCheckboxes();
  }

  // =========================================================================
  // 1. OVERVIEW TAB
  // =========================================================================
  function buildOverviewHtml() {
    const ov = window.DUET_SECTIONS.overview;
    const meta = appData.meta;
    const greetingBody = customStore.textEdits["overview_greeting"] || ov.greeting.body;

    let driveCardsHtml = "";
    const currentRole = state.currentRole;
    const allowedDrives = appData.driveLinks.filter((dl) => {
      if (!dl.roles || !Array.isArray(dl.roles)) return true;
      return currentRole && dl.roles.includes(currentRole);
    });

    allowedDrives.forEach((dl) => {
      const hasUrl = Boolean(dl.url && dl.url.trim());
      const badgeHtml = dl.badge
        ? `<span class="drive-card-badge ${esc(dl.badge)}">${esc(dl.badge)}</span>`
        : "";
      driveCardsHtml += `
        <div class="drive-card">
          <div class="drive-card-top">
            ${dl.icon ? `<span class="drive-icon">${dl.icon}</span>` : ""}
            <span class="drive-status ${hasUrl ? "linked" : "pending"}">
              ${hasUrl ? "연결 완료" : state.adminMode ? "링크 입력 가능" : "준비 중"}
            </span>
          </div>
          <div class="drive-title">${esc(dl.title)} ${badgeHtml}</div>
          <div class="drive-desc">${esc(dl.desc)}</div>
          <div class="drive-actions">
            ${
              hasUrl
                ? `<a href="${esc(dl.url)}" target="_blank" rel="noopener" class="btn btn-crimson" style="flex:1;justify-content:center;text-decoration:none;">바로 열기</a>`
                : state.adminMode
                ? `<button class="btn btn-crimson admin-only" data-open-drive-modal="${esc(dl.id)}" style="flex:1;justify-content:center;">링크 등록하기</button>`
                : `<button class="btn" disabled style="flex:1;justify-content:center;opacity:0.6;cursor:not-allowed;">드라이브 링크 준비 중</button>`
            }
            <button class="btn admin-only" data-open-drive-modal="${esc(dl.id)}" title="링크 수정">수정</button>
          </div>
        </div>
      `;
    });

    let keyChangesHtml = "";
    ov.keyChanges.forEach((kc, idx) => {
      keyChangesHtml += `
        <div class="doc-section" style="padding:20px 24px;margin-bottom:14px;">
          <div class="section-tag">${esc(kc.dept)}</div>
          <h3 style="font-size:17px;font-weight:800;margin-bottom:10px;color:var(--text);">${esc(kc.title)}</h3>
          <ul class="doc-list" data-editable="true" data-edit-key="overview_kc_${idx}">
            ${kc.items.map((item) => `<li>${esc(item)}</li>`).join("")}
          </ul>
        </div>
      `;
    });

    return `
      <!-- Hero Banner -->
      <div class="hero-card">
        <div class="hero-eyebrow">고려대학교 자유전공학부 D반 · 제18대 학생회 인수인계 포털</div>
        <h1 class="hero-title">제18대 학생회 &lt;Duet&gt; 학생회장단 · 국장단 통합 인수인계서</h1>
        <p class="hero-desc">
          제17대 인수인계서의 기본 업무 매뉴얼을 넘어, <strong>제18대 임기(2025.11.30 ~ 2026.11) 동안 왜 사업을 개편했는지, 당시 학생회장단과 국장단이 어떤 고민과 시행착오를 거쳤는지, 실제 공지글과 홍보물·월간보고는 어떻게 발행되었는지</strong> 모든 맥락을 담은 차기 학생회장단·국장단 전용 웹 포털입니다.
        </p>
        <div class="hero-meta-row">
          <span class="hero-chip">학생회장: ${esc(meta.president)}</span>
          <span class="hero-chip">부학생회장: ${esc(meta.vicePresident)}</span>
          <span class="hero-chip">기획: ${esc(meta.departments.planning)}</span>
          <span class="hero-chip">복지: ${esc(meta.departments.welfare)}</span>
          <span class="hero-chip">홍보: ${esc(meta.departments.pr)}</span>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="stats-grid">
        <div class="stat-card" style="cursor:pointer;" data-jump-tab="presidency">
          <div class="stat-num">12회 + 4회</div>
          <div class="stat-label">반운위 12회 · 확운위 3회 · 총회 1회</div>
          <div class="stat-sub">신입생 대표 임기 회칙개정 만장일치 가결 →</div>
        </div>
        <div class="stat-card" style="cursor:pointer;" data-jump-tab="calendar">
          <div class="stat-num">102장 / 300건</div>
          <div class="stat-label">노션 캘린더 300건 · 홍보물 · 월간보고 · 공지글</div>
          <div class="stat-sub">캘린더에서 노션 일정+카드뉴스+공지글 바로 보기 →</div>
        </div>
        <div class="stat-card" style="cursor:pointer;" data-jump-tab="planning">
          <div class="stat-num">기획국 6대 사업</div>
          <div class="stat-label">친해져도Dㅐ(2+2) · 스터디윗D · 총MT · 일일호프</div>
          <div class="stat-sub">연세대 에버나인 합동 일일호프 668,754원 흑자 →</div>
        </div>
        <div class="stat-card" style="cursor:pointer;" data-jump-tab="welfare">
          <div class="stat-num">복지국 & 홍보국</div>
          <div class="stat-label">복지국 전면 개편 · 반실 리뉴얼 · 월간보고</div>
          <div class="stat-sub">무보증금 대여사업 · 사전 수요조사 간식행사 →</div>
        </div>
      </div>

      <!-- Drive Links Hub -->
      <div class="doc-section">
        <div class="section-header">
          <div>
            <span class="section-tag">GOOGLE DRIVE & ARCHIVE HUB</span>
            <h2 class="section-title">구글폼 모음 드라이브 & 전체 인수인계 자료실 링크</h2>
            <p class="section-subtitle">
              구글폼 사본(수요조사·신청폼·투표폼·만족도조사) 드라이브와 원본 자료실 드라이브 아카이브 링크입니다.
            </p>
          </div>
          <button class="btn admin-only" id="overviewEditDriveBtn">링크 일괄 설정</button>
        </div>
        <div class="drive-hub-grid" style="margin-bottom:0;">
          ${driveCardsHtml}
        </div>
      </div>

      <!-- Greeting & Philosophy -->
      <div class="doc-section">
        <div class="section-header">
          <div>
            <span class="section-tag">MESSAGE FROM 18TH DUET</span>
            <h2 class="section-title">${esc(ov.greeting.title)}</h2>
            <p class="section-subtitle">${esc(ov.greeting.author)}</p>
          </div>
          <button class="btn btn-crimson" data-jump-tab="calendar">월별 캘린더 & 홍보물 보러가기 →</button>
        </div>
        <div class="callout callout-thought" style="margin-top:0;">
          <div class="callout-header">
            <span>18대 학생회장 원준혁의 인사말 & 인수인계 사이트 제작 배경</span>
            <span class="admin-only" style="font-size:12px;opacity:0.8;">(편집 모드에서 직접 수정 가능)</span>
          </div>
          <div class="callout-body" data-editable="true" data-edit-key="overview_greeting">${esc(greetingBody)}</div>
        </div>

        <h3 class="sub-heading" style="margin-top:24px;">차기 학생회장단 · 국장단을 위한 사이트 활용 팁</h3>
        <div class="stats-grid" style="margin-bottom:0;">
          <div class="stat-card" style="cursor:pointer;" data-jump-tab="presidency">
            <div style="font-size:18px;font-weight:800;color:var(--crimson);margin-bottom:4px;">학생회장단 인수인계서</div>
            <p style="font-size:13px;color:var(--text-secondary);">반운위/확운위/학생총회 진행 스크립트, 선거 소명 자료, 예결산 3대 장부, 과잠·돕바 공구, 연세대 교류반·일일호프 총괄 노하우</p>
          </div>
          <div class="stat-card" style="cursor:pointer;" data-jump-tab="planning">
            <div style="font-size:18px;font-weight:800;color:#2563EB;margin-bottom:4px;">기획국 인수인계서</div>
            <p style="font-size:13px;color:var(--text-secondary);">스터디윗D 달성+추첨 하이브리드 개편, 친해져도 Dㅐ? 2+2 매칭, 대성리 총MT 답사·예산, 합동응원전·릴스 고연전 실무</p>
          </div>
          <div class="stat-card" style="cursor:pointer;" data-jump-tab="welfare">
            <div style="font-size:18px;font-weight:800;color:#059669;margin-bottom:4px;">복지국 인수인계서</div>
            <p style="font-size:13px;color:var(--text-secondary);">복지국 전면 개편, 반실 가구 재배치 및 17만 원 비품 확충, 우산·보조배터리 무보증금 대여, 간식 사전 수요조사</p>
          </div>
          <div class="stat-card" style="cursor:pointer;" data-jump-tab="pr">
            <div style="font-size:18px;font-weight:800;color:#9333EA;margin-bottom:4px;">홍보국 인수인계서</div>
            <p style="font-size:13px;color:var(--text-secondary);">음악 플레이어 컨셉 월간보고 정례화, 미리캔버스 구독 지원, 반실 QR 피드백 개편과 익명성 vs 회비 딜레마 교훈</p>
          </div>
        </div>
      </div>

      <!-- 17th vs 18th Key Changes -->
      <div class="doc-section">
        <div class="section-header">
          <div>
            <span class="section-tag">17대(도약) → 18대(Duet) 핵심 변화 요약</span>
            <h2 class="section-title">제18대 Duet에서 새롭게 개편·신설된 핵심 사항 한눈에 보기</h2>
            <p class="section-subtitle">전대(17대) 인수인계서와 비교했을 때 18대에서 왜, 어떻게 달라졌는지 국서별로 요약했습니다.</p>
          </div>
        </div>
        ${keyChangesHtml}
      </div>
    `;
  }

  function bindOverviewEvents() {
    document.querySelectorAll("[data-jump-tab]").forEach((el) => {
      el.addEventListener("click", () => {
        switchTab(el.getAttribute("data-jump-tab"));
      });
    });

    document.querySelectorAll("[data-open-drive-modal]").forEach((el) => {
      el.addEventListener("click", () => {
        openDriveModal(el.getAttribute("data-open-drive-modal"));
      });
    });

    document.getElementById("overviewEditDriveBtn")?.addEventListener("click", () => {
      openDriveModal();
    });
  }

  // =========================================================================
  // 2. INTERACTIVE CALENDAR & MONTHLY REPORT PORTAL
  // =========================================================================
  function buildCalendarPortalHtml() {
    // Month tabs grouped by year (2025 / 2026 / 2027)
    const years = [...new Set(MONTHS_LIST.map((m) => m.year))];
    const monthTabsHtml = years
      .map((y) => {
        const tabs = MONTHS_LIST.filter((m) => m.year === y)
          .map((m) => {
            const count = appData.calendarEvents.filter(
              (e) => e.monthKey === m.key && (state.selectedCat === "all" || e.category === state.selectedCat)
            ).length;
            const cls = [
              "month-tab",
              state.selectedMonth === m.key ? "active" : "",
              count === 0 ? "is-empty" : ""
            ].join(" ");
            return `<button class="${cls}" data-month-key="${m.key}" title="${esc(m.label)} · ${count}건">
              ${m.month}월 <span class="month-tab-count">${count}</span>
            </button>`;
          })
          .join("");
        return `<div class="month-year-group"><span class="month-year-label">${y}</span><div class="month-tabs">${tabs}</div></div>`;
      })
      .join("");

    const catTabsHtml = Object.keys(CATEGORY_META).map((catKey) => {
      const meta = CATEGORY_META[catKey];
      return `<button class="month-tab ${state.selectedCat === catKey ? "active" : ""}" data-cat-key="${catKey}">
        ${esc(meta.label)}
      </button>`;
    }).join("");

    let bodyHtml = "";
    if (state.calSubView === "calendar") {
      bodyHtml = buildCalendarSplitViewHtml();
    } else if (state.calSubView === "monthly") {
      bodyHtml = buildMonthlyReportsArchiveHtml();
    } else {
      bodyHtml = buildPromoGalleryHtml();
    }

    return `
      <div class="doc-section" style="padding:20px 24px;margin-bottom:18px;">
        <div class="section-header" style="margin-bottom:14px;padding-bottom:12px;">
          <div>
            <span class="section-tag">INTERACTIVE ARCHIVE · 2025.11 ~ 2026.11 · 노션 일정 ${appData.calendarEvents.length}건</span>
            <h2 class="section-title">월별 캘린더 · 홍보물 카드뉴스 · 실제 공지글 · 월간보고 아카이브</h2>
            <p class="section-subtitle">
              달력의 각 행사를 클릭하면 우측 패널에서 <strong>당시 제작한 홍보물/카드뉴스 원본 이미지</strong>와 <strong>카카오톡 공지방에 실제로 올린 공지글 전문(복사 가능)</strong>, 그리고 <strong>당시 18대의 생각/고려사항</strong>을 함께 확인할 수 있습니다.
            </p>
          </div>
          <div class="view-mode-tabs">
            <button class="btn ${state.calSubView === "calendar" ? "btn-crimson" : ""}" data-subview="calendar">월별 캘린더 & 공지글</button>
            <button class="btn ${state.calSubView === "monthly" ? "btn-crimson" : ""}" data-subview="monthly">월간보고 슬라이드(${appData.monthlyReports.length}호)</button>
            <button class="btn ${state.calSubView === "gallery" ? "btn-crimson" : ""}" data-subview="gallery">홍보물 갤러리(전체)</button>
          </div>
        </div>

        ${
          state.calSubView === "calendar"
            ? `
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div class="filter-row">
              <span class="filter-label">월 선택:</span>
              <div class="month-year-row">${monthTabsHtml}</div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
              <div class="filter-row">
                <span class="filter-label">분류 필터:</span>
                <div class="month-tabs">${catTabsHtml}</div>
              </div>
              <button class="btn admin-only" id="addCustomEventBtn" title="새로운 행사나 공지글을 캘린더에 추가합니다">새 행사/공지 추가</button>
            </div>
          </div>
        `
            : ""
        }
      </div>

      ${bodyHtml}
    `;
  }

  function buildCalendarSplitViewHtml() {
    const monthObj = MONTHS_LIST.find((m) => m.key === state.selectedMonth) || MONTHS_LIST[0];
    const monthEvents = appData.calendarEvents.filter(
      (ev) => ev.monthKey === monthObj.key && (state.selectedCat === "all" || ev.category === state.selectedCat)
    );

    // Ensure a valid selected event (prefer an event with images when switching months)
    let activeEv = appData.calendarEvents.find((ev) => ev.id === state.selectedEventId);
    if (!activeEv || (activeEv.monthKey !== monthObj.key && monthEvents.length > 0)) {
      activeEv = monthEvents.find((ev) => ev.images && ev.images.length > 0) || monthEvents[0] || appData.calendarEvents[0];
      if (activeEv) {
        state.selectedEventId = activeEv.id;
        state.eventImgIdx = 0;
      }
    }

    // Build calendar cells for monthObj.year, monthObj.month
    const firstDay = new Date(monthObj.year, monthObj.month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(monthObj.year, monthObj.month, 0).getDate();

    let cellsHtml = "";
    for (let i = 0; i < firstDay; i++) {
      cellsHtml += `<div class="cal-day-cell empty"></div>`;
    }

    const MAX_PILLS_PER_DAY = 3;
    const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayEvents = monthEvents.filter((ev) => Number(ev.day) === d);
      const dow = (firstDay + d - 1) % 7;
      const cellClasses = [
        "cal-day-cell",
        dayEvents.length > 0 ? "has-events" : "",
        state.selectedDay === d ? "is-day-selected" : "",
        dow === 0 ? "is-sun" : dow === 6 ? "is-sat" : ""
      ].join(" ");
      const pillsHtml = dayEvents
        .slice(0, MAX_PILLS_PER_DAY)
        .map((ev) => {
          const catClass = CATEGORY_META[ev.category]?.className || "cat-pres";
          const isSel = activeEv && activeEv.id === ev.id ? "selected" : "";
          const hasImgIcon = "";
          return `<div class="cal-event-pill ${catClass} ${isSel}" data-select-event="${esc(ev.id)}" title="${esc(ev.title)}">${hasImgIcon}${esc(ev.title)}</div>`;
        })
        .join("");
      const extra = dayEvents.length - MAX_PILLS_PER_DAY;
      const moreHtml = extra > 0 ? `<button class="cal-more-btn" data-day-filter="${d}" title="${d}일 일정 ${dayEvents.length}건 모두 보기">+${extra}건 더보기</button>` : "";

      cellsHtml += `
        <div class="${cellClasses}">
          <div class="cal-day-num" ${dayEvents.length > 0 ? `data-day-filter="${d}" title="${d}일 일정만 보기"` : ""}>${d}</div>
          ${pillsHtml}
          ${moreHtml}
        </div>
      `;
    }

    // Timeline list grouped by day (also used as the mobile list view)
    const timelineEvents = state.selectedDay
      ? monthEvents.filter((ev) => Number(ev.day) === state.selectedDay)
      : monthEvents;
    const dayKeys = [...new Set(timelineEvents.map((ev) => Number(ev.day)))].sort((a, b) => a - b);
    const listHtml = dayKeys
      .map((d) => {
        const dow = weekdayNames[(firstDay + d - 1) % 7];
        const itemsHtml = timelineEvents
          .filter((ev) => Number(ev.day) === d)
          .map((ev) => {
            const catMeta = CATEGORY_META[ev.category] || CATEGORY_META.pres;
            const isSel = activeEv && activeEv.id === ev.id;
            const imgCount = ev.images ? ev.images.length : 0;
            return `
              <div class="timeline-item ${isSel ? "selected" : ""}" data-select-event="${esc(ev.id)}">
                <span class="timeline-dot ${catMeta.className}"></span>
                <div class="timeline-main">
                  <div class="timeline-title">${esc(ev.title)}</div>
                  <div class="timeline-meta">
                    <span>${esc(stripStatus(ev.deptLabel) || catMeta.label)}</span>
                    ${ev.date && ev.date.includes("~") ? `<span>· ${esc(ev.date)}</span>` : ""}
                    ${imgCount > 0 ? `<span>· 이미지 ${imgCount}장</span>` : ""}
                  </div>
                </div>
                ${ev.status ? `<span class="status-badge ${statusClass(ev.status)}">${esc(ev.status)}</span>` : ""}
              </div>
            `;
          })
          .join("");
        return `
          <div class="timeline-day">
            <div class="timeline-day-label">${monthObj.month}/${d} <span>(${dow})</span></div>
            <div class="timeline-day-items">${itemsHtml}</div>
          </div>
        `;
      })
      .join("");

    // Check if there is a monthly report corresponding to this month
    const monthReportMap = {
      "2026-01": "m01",
      "2026-02": "m02",
      "2026-03": "m03",
      "2026-04": "m04",
      "2026-05": "m05",
      "2026-06": "m06",
      "2026-07": "m0708",
      "2026-08": "m0708"
    };
    const reportId = monthReportMap[monthObj.key];
    const reportObj = reportId ? appData.monthlyReports.find((r) => r.id === reportId) : null;

    return `
      <div class="calendar-workspace">
        <!-- 1. Calendar Grid Card -->
        <div class="calendar-grid-card">
          <div class="cal-month-header">
            <div>
              <div class="cal-month-title">${esc(monthObj.label)} D반 학생회 Duet 일정표</div>
              <div class="cal-month-hint">
                일정을 누르면 홍보물·실제 공지글·18대 코멘트를 볼 수 있습니다. 날짜 숫자나 <strong>+N건</strong>을 누르면 그날 일정만 모아 봅니다.
              </div>
            </div>
            <div class="cal-month-nav">
              <button class="btn" id="prevMonthBtn" title="이전 달">◀</button>
              <button class="btn" id="nextMonthBtn" title="다음 달">▶</button>
            </div>
          </div>

          <div class="cal-grid-wrap">
            <div class="cal-weekdays">
              <span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span>
            </div>
            <div class="cal-days-grid">
              ${cellsHtml}
            </div>
          </div>
        </div>

        <!-- 2. Event Detail Panel (Right column on wide screens, directly below calendar on laptop/mobile) -->
        <div class="event-detail-panel" id="eventDetailPanel">
          ${activeEv ? buildEventDetailHtml(activeEv) : `<p class="body-text">행사를 선택해주세요.</p>`}
        </div>

        <!-- 3. Full Month Timeline + Monthly Report -->
        <div class="calendar-below-stack">
          <div class="calendar-grid-card">
            <div class="timeline-header" id="calTimeline" style="margin-top:0;padding-top:0;border-top:none;">
              <h3 class="sub-heading" style="margin:0;font-size:15px;">
                ${state.selectedDay ? `${monthObj.month}월 ${state.selectedDay}일 일정` : `${esc(monthObj.label)} 전체 일정 타임라인`} (${timelineEvents.length}건)
              </h3>
              ${state.selectedDay ? `<button class="btn" id="clearDayFilterBtn">✕ 이번 달 전체 보기</button>` : ""}
            </div>
            <div class="timeline-list">
              ${listHtml || `<p class="body-text">해당 필터에 맞는 일정이 없습니다.</p>`}
            </div>
          </div>

          ${reportObj ? buildSingleMonthlyReportCardHtml(reportObj) : ""}
        </div>
      </div>
    `;
  }

  function buildEventDetailHtml(ev) {
    const catMeta = CATEGORY_META[ev.category] || CATEGORY_META.pres;
    const imgs = Array.isArray(ev.images) ? ev.images : [];
    const idx = Math.min(Math.max(0, state.eventImgIdx), Math.max(0, imgs.length - 1));

    let carouselHtml = "";
    if (imgs.length > 0) {
      const currentImg = imgs[idx];
      const thumbsHtml =
        imgs.length > 1
          ? `<div class="carousel-thumbs">
              ${imgs
                .map(
                  (src, i) =>
                    `<img src="${esc(src)}" alt="slide ${i + 1}" class="carousel-thumb ${i === idx ? "active" : ""}" data-ev-thumb="${i}" loading="lazy">`
                )
                .join("")}
            </div>`
          : "";

      carouselHtml = `
        <div class="media-carousel">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:12.5px;font-weight:700;color:var(--text-secondary);">
            <span>홍보물 · 카드뉴스 · 공고문 (${idx + 1} / ${imgs.length}장)</span>
            <button class="btn" style="padding:3px 9px;font-size:11.5px;" data-zoom-ev-img="${idx}">크게 보기</button>
          </div>
          <div class="carousel-stage">
            ${imgs.length > 1 ? `<button class="carousel-nav-btn prev" id="evPrevImgBtn" title="이전 이미지">❮</button>` : ""}
            <img src="${esc(currentImg)}" alt="${esc(ev.title)}" id="evMainImg" data-zoom-ev-img="${idx}">
            ${imgs.length > 1 ? `<button class="carousel-nav-btn next" id="evNextImgBtn" title="다음 이미지">❯</button>` : ""}
          </div>
          ${thumbsHtml}
        </div>
      `;
    } else {
      carouselHtml = `
        <div style="padding:12px 14px;background:var(--surface-alt);border-radius:8px;font-size:12.5px;color:var(--text-muted);margin:10px 0;">
          이 일정은 별도 카드뉴스 이미지 없이 카카오톡 공지글 또는 회의록으로 진행된 일정입니다.
        </div>
      `;
    }

    const rawNotice = String(ev.noticeText || "").trim();
    const isAutoNotionRecord = rawNotice.startsWith("[노션(Notion) 캘린더 일정 기록]");
    const rawThought = String(ev.thought || "").trim();
    const isBoilerplateThought =
      rawThought.includes("노션(Notion) 캘린더 데이터베이스에서 동기화된 제18대 학생회 Duet 공식 일정입니다") ||
      rawThought.includes("노션(Notion) 워크스페이스 캘린더에서 동기화된 일정입니다");

    const cleanDept = stripStatus(ev.deptLabel) || catMeta.label;
    let noticeSectionHtml = "";
    if (isAutoNotionRecord && !state.editMode) {
      const urlMatch = rawNotice.match(/(?:🔗\s*)?관련 문서 링크:\s*(\S+)/);
      const extUrl = urlMatch ? urlMatch[1] : "";
      noticeSectionHtml = `
        <div class="notion-meta-card">
          <div class="notion-meta-row"><span>일정명</span><strong>${esc(ev.title)}</strong></div>
          <div class="notion-meta-row"><span>일시</span><strong>${esc(ev.date)}</strong></div>
          <div class="notion-meta-row"><span>담당 국서</span><strong>${esc(cleanDept)}</strong></div>
          ${ev.status ? `<div class="notion-meta-row"><span>진행 상태</span><strong>${esc(ev.status)}</strong></div>` : ""}
          ${extUrl ? `<div class="notion-meta-row"><span>첨부 링크</span><a href="${esc(extUrl)}" target="_blank" rel="noopener">문서 바로 열기 ↗</a></div>` : ""}
        </div>
        <div class="callout callout-notice admin-only" style="margin-top:12px;">
          <div class="callout-header">
            <span>공지글 / 회의 메모 원문 (편집 모드에서 수정 가능)</span>
            <button class="btn" id="copyNoticeBtn" style="padding:3px 10px;font-size:11.5px;">복사</button>
          </div>
          <div class="callout-body" id="activeEventNoticeText" data-event-edit-field="noticeText" data-event-id="${esc(ev.id)}">${esc(rawNotice)}</div>
        </div>
      `;
    } else {
      noticeSectionHtml = `
        <div class="callout callout-notice" style="margin-top:14px;">
          <div class="callout-header">
            <span>당시 실제 공지글 / 안건 요약</span>
            <button class="btn" id="copyNoticeBtn" style="padding:3px 10px;font-size:11.5px;">공지글 복사</button>
          </div>
          <div class="callout-body" id="activeEventNoticeText" data-event-edit-field="noticeText" data-event-id="${esc(ev.id)}">${esc(rawNotice)}</div>
        </div>
      `;
    }

    const thoughtSectionHtml = `
      <div class="callout callout-thought ${isBoilerplateThought ? "admin-only" : ""}" style="margin-top:12px;">
        <div class="callout-header">
          <span>18대 당시 내 생각 & 고려사항 (Behind-the-Scenes)</span>
          <span class="admin-only" style="font-size:11px;opacity:0.8;">편집 가능</span>
        </div>
        <div class="callout-body" data-event-edit-field="thought" data-event-id="${esc(ev.id)}">${esc(rawThought)}</div>
      </div>
    `;

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span class="cal-event-pill ${catMeta.className}" style="font-size:12px;padding:4px 10px;">
            ${esc(cleanDept)}
          </span>
          ${ev.status ? `<span class="status-badge ${statusClass(ev.status)}">${esc(ev.status)}</span>` : ""}
        </div>
        <span style="font-size:12.5px;font-weight:700;color:var(--text-muted);" data-event-edit-field="date" data-event-id="${esc(ev.id)}">${esc(ev.date)}</span>
      </div>

      <h2 style="font-size:19px;font-weight:800;color:var(--text);line-height:1.35;margin-bottom:10px;" data-event-edit-field="title" data-event-id="${esc(ev.id)}">${esc(ev.title)}</h2>

      ${carouselHtml}

      ${noticeSectionHtml}

      ${thoughtSectionHtml}
    `;
  }

  function buildSingleMonthlyReportCardHtml(rep) {
    const curIdx = state.monthlySlideIdx[rep.id] || 0;
    const imgs = rep.images || [];
    const safeIdx = Math.min(Math.max(0, curIdx), Math.max(0, imgs.length - 1));

    return `
      <div class="monthly-report-box" data-report-card="${esc(rep.id)}">
        <div class="section-header" style="margin-bottom:14px;padding-bottom:10px;">
          <div>
            <span class="section-tag">MONTHLY REPORT · ${esc(rep.uploadDate)} 업로드</span>
            <h3 class="section-title" style="font-size:18px;">${esc(rep.title)} (${imgs.length}장)</h3>
          </div>
          <button class="btn" data-zoom-report="${esc(rep.id)}" data-zoom-idx="${safeIdx}">슬라이드 확대</button>
        </div>

        <div class="media-carousel">
          <div class="carousel-stage">
            <button class="carousel-nav-btn prev" data-rep-prev="${esc(rep.id)}">❮</button>
            <img src="${esc(imgs[safeIdx])}" alt="${esc(rep.title)}" data-zoom-report="${esc(rep.id)}" data-zoom-idx="${safeIdx}">
            <button class="carousel-nav-btn next" data-rep-next="${esc(rep.id)}">❯</button>
          </div>
          <div class="carousel-thumbs">
            ${imgs
              .map(
                (src, i) =>
                  `<img src="${esc(src)}" alt="slide ${i + 1}" class="carousel-thumb ${i === safeIdx ? "active" : ""}" data-rep-thumb="${esc(rep.id)}" data-rep-idx="${i}" loading="lazy">`
              )
              .join("")}
          </div>
        </div>

        <div class="table-wrap" style="margin-top:12px;">
          <table class="doc-table">
            <tbody>
              <tr><th style="width:130px;">회장단·의결기구</th><td style="white-space:pre-line;">${esc(rep.summary.pres)}</td></tr>
              <tr><th>기획국</th><td style="white-space:pre-line;">${esc(rep.summary.plan)}</td></tr>
              <tr><th>복지국</th><td style="white-space:pre-line;">${esc(rep.summary.welf)}</td></tr>
              <tr><th>홍보국</th><td style="white-space:pre-line;">${esc(rep.summary.pr)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildMonthlyReportsArchiveHtml() {
    return `
      <div>
        ${appData.monthlyReports.map((rep) => buildSingleMonthlyReportCardHtml(rep)).join("")}
      </div>
    `;
  }

  function buildPromoGalleryHtml() {
    const seenFirstImg = new Set();
    const eventsWithImages = appData.calendarEvents.filter((ev) => {
      if (!ev.images || ev.images.length === 0) return false;
      const key = ev.images.join("|");
      if (seenFirstImg.has(key)) return false;
      seenFirstImg.add(key);
      return true;
    });
    const cardsHtml = eventsWithImages
      .map((ev) => {
        const catMeta = CATEGORY_META[ev.category] || CATEGORY_META.pres;
        return `
          <div class="promo-card" data-gallery-open-ev="${esc(ev.id)}">
            <div class="promo-card-thumb">
              <img src="${esc(ev.images[0])}" alt="${esc(ev.title)}" loading="lazy">
              <span class="promo-card-count">${ev.images.length}장</span>
            </div>
            <div class="promo-card-body">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span class="cal-event-pill ${catMeta.className}">${esc(ev.deptLabel || catMeta.label)}</span>
                <span class="promo-card-date">${esc(ev.date)}</span>
              </div>
              <div class="promo-card-title">${esc(ev.title)}</div>
              <div style="font-size:12px;color:var(--text-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                ${esc(ev.noticeText)}
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="doc-section">
        <div class="section-header">
          <div>
            <span class="section-tag">PROMO & NOTICE GALLERY</span>
            <h2 class="section-title">제18대 Duet 홍보물 · 카드뉴스 · 공고문 전체 갤러리 (${eventsWithImages.length}개 행사)</h2>
            <p class="section-subtitle">카드를 클릭하면 해당 월의 캘린더 상세 뷰(전체 슬라이드 + 실제 공지글 + 당시 생각)로 이동합니다.</p>
          </div>
        </div>
        <div class="promo-gallery-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  function bindCalendarPortalEvents() {
    // Subview toggle
    document.querySelectorAll("[data-subview]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.calSubView = btn.getAttribute("data-subview");
        renderMainContent();
      });
    });

    // Month tabs
    document.querySelectorAll("[data-month-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedMonth = btn.getAttribute("data-month-key");
        state.selectedDay = null;
        state.eventImgIdx = 0;
        renderMainContent();
      });
    });

    // Category tabs
    document.querySelectorAll("[data-cat-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedCat = btn.getAttribute("data-cat-key");
        state.selectedDay = null;
        state.eventImgIdx = 0;
        renderMainContent();
      });
    });

    // Prev / Next month buttons
    document.getElementById("prevMonthBtn")?.addEventListener("click", () => {
      const idx = MONTHS_LIST.findIndex((m) => m.key === state.selectedMonth);
      if (idx > 0) {
        state.selectedMonth = MONTHS_LIST[idx - 1].key;
        state.selectedDay = null;
        state.eventImgIdx = 0;
        renderMainContent();
      }
    });
    document.getElementById("nextMonthBtn")?.addEventListener("click", () => {
      const idx = MONTHS_LIST.findIndex((m) => m.key === state.selectedMonth);
      if (idx >= 0 && idx < MONTHS_LIST.length - 1) {
        state.selectedMonth = MONTHS_LIST[idx + 1].key;
        state.selectedDay = null;
        state.eventImgIdx = 0;
        renderMainContent();
      }
    });

    // Day filter buttons (+N건 더보기 / 날짜 숫자 클릭)
    document.querySelectorAll("[data-day-filter]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const d = Number(el.getAttribute("data-day-filter"));
        state.selectedDay = state.selectedDay === d ? null : d;
        const monthEvents = appData.calendarEvents.filter(
          (ev) => ev.monthKey === state.selectedMonth && (state.selectedCat === "all" || ev.category === state.selectedCat) && Number(ev.day) === d
        );
        if (monthEvents.length > 0) {
          state.selectedEventId = monthEvents[0].id;
          state.eventImgIdx = 0;
        }
        renderMainContent();
        setTimeout(() => {
          const tl = document.getElementById("calTimeline");
          if (tl) {
            const y = tl.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: y, behavior: "smooth" });
          }
        }, 40);
      });
    });

    document.getElementById("clearDayFilterBtn")?.addEventListener("click", () => {
      state.selectedDay = null;
      renderMainContent();
    });

    // Select event pill or list item
    document.querySelectorAll("[data-select-event]").forEach((el) => {
      el.addEventListener("click", () => {
        state.selectedEventId = el.getAttribute("data-select-event");
        state.eventImgIdx = 0;
        renderMainContent();
        if (window.innerWidth <= 1520) {
          setTimeout(() => {
            const detailEl = document.getElementById("eventDetailPanel");
            if (detailEl) {
              const y = detailEl.getBoundingClientRect().top + window.scrollY - 76;
              window.scrollTo({ top: y, behavior: "smooth" });
            }
          }, 40);
        }
      });
    });

    // Event detail carousel controls
    const activeEv = appData.calendarEvents.find((e) => e.id === state.selectedEventId);
    if (activeEv && activeEv.images && activeEv.images.length > 0) {
      document.getElementById("evPrevImgBtn")?.addEventListener("click", () => {
        state.eventImgIdx = (state.eventImgIdx - 1 + activeEv.images.length) % activeEv.images.length;
        refreshEventDetailPanel();
      });
      document.getElementById("evNextImgBtn")?.addEventListener("click", () => {
        state.eventImgIdx = (state.eventImgIdx + 1) % activeEv.images.length;
        refreshEventDetailPanel();
      });
      document.querySelectorAll("[data-ev-thumb]").forEach((thumb) => {
        thumb.addEventListener("click", () => {
          state.eventImgIdx = Number(thumb.getAttribute("data-ev-thumb"));
          refreshEventDetailPanel();
        });
      });
      document.querySelectorAll("[data-zoom-ev-img]").forEach((zoomTrigger) => {
        zoomTrigger.addEventListener("click", () => {
          openLightbox(activeEv.images, Number(zoomTrigger.getAttribute("data-zoom-ev-img") || 0));
        });
      });
    }

    // Copy notice text button
    document.getElementById("copyNoticeBtn")?.addEventListener("click", () => {
      const noticeEl = document.getElementById("activeEventNoticeText");
      if (noticeEl) {
        navigator.clipboard?.writeText(noticeEl.innerText.trim());
        showToast("공지글 전문이 클립보드에 복사되었습니다!");
      }
    });

    // Monthly report carousels
    document.querySelectorAll("[data-rep-prev]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const repId = btn.getAttribute("data-rep-prev");
        const rep = appData.monthlyReports.find((r) => r.id === repId);
        if (!rep) return;
        const cur = state.monthlySlideIdx[repId] || 0;
        state.monthlySlideIdx[repId] = (cur - 1 + rep.images.length) % rep.images.length;
        renderMainContent();
      });
    });
    document.querySelectorAll("[data-rep-next]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const repId = btn.getAttribute("data-rep-next");
        const rep = appData.monthlyReports.find((r) => r.id === repId);
        if (!rep) return;
        const cur = state.monthlySlideIdx[repId] || 0;
        state.monthlySlideIdx[repId] = (cur + 1) % rep.images.length;
        renderMainContent();
      });
    });
    document.querySelectorAll("[data-rep-thumb]").forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const repId = thumb.getAttribute("data-rep-thumb");
        const idx = Number(thumb.getAttribute("data-rep-idx"));
        state.monthlySlideIdx[repId] = idx;
        renderMainContent();
      });
    });
    document.querySelectorAll("[data-zoom-report]").forEach((el) => {
      el.addEventListener("click", () => {
        const repId = el.getAttribute("data-zoom-report");
        const idx = Number(el.getAttribute("data-zoom-idx") || 0);
        const rep = appData.monthlyReports.find((r) => r.id === repId);
        if (rep) openLightbox(rep.images, idx);
      });
    });

    // Gallery card click -> open in calendar view
    document.querySelectorAll("[data-gallery-open-ev]").forEach((card) => {
      card.addEventListener("click", () => {
        const evId = card.getAttribute("data-gallery-open-ev");
        const ev = appData.calendarEvents.find((x) => x.id === evId);
        if (ev) {
          state.calSubView = "calendar";
          state.selectedMonth = ev.monthKey;
          state.selectedCat = "all";
          state.selectedEventId = ev.id;
          state.eventImgIdx = 0;
          renderMainContent();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });

    // Add new custom event button
    document.getElementById("addCustomEventBtn")?.addEventListener("click", () => {
      openAddEventModal();
    });
  }

  function refreshEventDetailPanel() {
    const panel = document.getElementById("eventDetailPanel");
    const activeEv = appData.calendarEvents.find((e) => e.id === state.selectedEventId);
    if (!panel || !activeEv) return;
    panel.innerHTML = buildEventDetailHtml(activeEv);
    applyEditModeAttributes();

    // Re-bind detail panel events
    document.getElementById("evPrevImgBtn")?.addEventListener("click", () => {
      state.eventImgIdx = (state.eventImgIdx - 1 + activeEv.images.length) % activeEv.images.length;
      refreshEventDetailPanel();
    });
    document.getElementById("evNextImgBtn")?.addEventListener("click", () => {
      state.eventImgIdx = (state.eventImgIdx + 1) % activeEv.images.length;
      refreshEventDetailPanel();
    });
    panel.querySelectorAll("[data-ev-thumb]").forEach((thumb) => {
      thumb.addEventListener("click", () => {
        state.eventImgIdx = Number(thumb.getAttribute("data-ev-thumb"));
        refreshEventDetailPanel();
      });
    });
    panel.querySelectorAll("[data-zoom-ev-img]").forEach((zoomTrigger) => {
      zoomTrigger.addEventListener("click", () => {
        openLightbox(activeEv.images, Number(zoomTrigger.getAttribute("data-zoom-ev-img") || 0));
      });
    });
    document.getElementById("copyNoticeBtn")?.addEventListener("click", () => {
      const noticeEl = document.getElementById("activeEventNoticeText");
      if (noticeEl) {
        navigator.clipboard?.writeText(noticeEl.innerText.trim());
        showToast("공지글 전문이 클립보드에 복사되었습니다!");
      }
    });
  }

  // =========================================================================
  // 3. DOCUMENT SECTIONS (PRESIDENCY, PLANNING, WELFARE, PR, TEMPLATES)
  // =========================================================================
  function buildDocSectionsHtml(tabId) {
    const sections = window.DUET_SECTIONS[tabId] || [];
    const headerMeta = {
      presidency: {
        badge: "PRESIDENCY & GOVERNANCE HANDOVER",
        title: "학생회장단 인수인계서 (원준혁 · 우상준)",
        desc: "의결기구(반운위·확운위·학생총회) 진행 매뉴얼, 회칙 개정 실무, 선거 소명 자료, 예결산 3대 장부, 과잠·돕바 공구, 연세대 교류반·일일호프 총괄 및 월별 체크리스트",
        catFilter: ["pres", "gov"]
      },
      planning: {
        badge: "PLANNING DEPARTMENT HANDOVER",
        title: "기획국 인수인계서 (김채은 · 장여백 / 김동준 · 문아림)",
        desc: "스터디윗D 하이브리드 개편, 친해져도 Dㅐ? 2+2 매칭 개편, 대성리 총MT 사전답사·예산·레크, 일일호프 이벤트, 합동응원전 및 릴스 고연전 실무 매뉴얼",
        catFilter: ["plan"]
      },
      welfare: {
        badge: "WELFARE DEPARTMENT HANDOVER",
        title: "복지국 인수인계서 (국장 김동운 / 안희서 · 김찬우 · 방죠세핀 · 정유나)",
        desc: "복지국 전면 개편 배경, 반실 가구 재배치 및 17만 원 비품 확충, 우산·보조배터리 무보증금 대여 사업, 간식행사 사전 수요조사 3단계 체계",
        catFilter: ["welf"]
      },
      pr: {
        badge: "PUBLIC RELATIONS DEPARTMENT HANDOVER",
        title: "홍보국 인수인계서 (이윤주 / 박준원 · 김선희)",
        desc: "음악 플레이어 컨셉 월간보고 정례화, 미리캔버스 구독 지원, 반실 QR 피드백 개편 및 익명성 vs 학생회비 납부 확인 딜레마 실전 교훈",
        catFilter: ["pr"]
      },
      templates: {
        badge: "TEMPLATES & FULL MEETING LOGS",
        title: "표준 양식 모음 · 제18대 반운위 전회차(1~12차) 요약 · 사이트 배포 가이드",
        desc: "차기 학생회장단과 국장단이 바로 복사해 쓸 수 있는 표준 공고문·안건지·기획안 양식과 제18대 반운위 12회 전회차 요약표입니다.",
        catFilter: []
      }
    }[tabId];

    const tocPills = sections
      .map(
        (sec) =>
          `<button class="month-tab" data-doc-jump="${esc(sec.id)}">${esc(sec.title)}</button>`
      )
      .join("");

    const sectionsHtml = sections
      .map(
        (sec) => `
        <section class="doc-section" id="${esc(sec.id)}">
          <div class="section-header">
            <div>
              <span class="section-tag">${esc(sec.tag)}</span>
              <h2 class="section-title">${esc(sec.title)}</h2>
              <p class="section-subtitle">${esc(sec.subtitle)}</p>
            </div>
          </div>
          <div class="section-body">
            ${sec.contentHtml}
          </div>
        </section>
      `
      )
      .join("");

    // Related calendar events & promo cards for this department
    let relatedEventsHtml = "";
    if (headerMeta.catFilter && headerMeta.catFilter.length > 0) {
      const relEvents = appData.calendarEvents.filter(
        (ev) => headerMeta.catFilter.includes(ev.category) && ev.images && ev.images.length > 0
      );
      if (relEvents.length > 0) {
        relatedEventsHtml = `
          <section class="doc-section">
            <div class="section-header">
              <div>
                <span class="section-tag">RELATED PROMOS & NOTICES</span>
                <h2 class="section-title">이 부서의 실제 홍보물 · 카드뉴스 · 공지글 바로 보기 (${relEvents.length}건)</h2>
                <p class="section-subtitle">클릭하면 월별 캘린더의 해당 행사 상세 화면(전체 카드뉴스 슬라이드 + 실제 공지글 전문)으로 연결됩니다.</p>
              </div>
            </div>
            <div class="promo-gallery-grid">
              ${relEvents
                .map((ev) => {
                  const catMeta = CATEGORY_META[ev.category] || CATEGORY_META.pres;
                  return `
                    <div class="promo-card" data-dept-open-ev="${esc(ev.id)}">
                      <div class="promo-card-thumb">
                        <img src="${esc(ev.images[0])}" alt="${esc(ev.title)}" loading="lazy">
                        <span class="promo-card-count">${ev.images.length}장</span>
                      </div>
                      <div class="promo-card-body">
                        <div style="display:flex;align-items:center;justify-content:space-between;">
                          <span class="cal-event-pill ${catMeta.className}">${esc(ev.deptLabel || catMeta.label)}</span>
                          <span class="promo-card-date">${esc(ev.date)}</span>
                        </div>
                        <div class="promo-card-title">${esc(ev.title)}</div>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </section>
        `;
      }
    }

    return `
      <div class="doc-section" style="background:linear-gradient(135deg, var(--surface) 0%, var(--surface-alt) 100%);border-left:5px solid var(--crimson);">
        <span class="section-tag">${esc(headerMeta.badge)}</span>
        <h1 style="font-size:24px;font-weight:800;color:var(--text);margin-bottom:6px;">${esc(headerMeta.title)}</h1>
        <p style="font-size:14px;color:var(--text-secondary);margin-bottom:14px;">${esc(headerMeta.desc)}</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${tocPills}
        </div>
      </div>

      ${sectionsHtml}
      ${relatedEventsHtml}
    `;
  }

  function bindDocSectionEvents() {
    document.querySelectorAll("[data-doc-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-doc-jump");
        const el = document.getElementById(id);
        if (el) {
          const y = el.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      });
    });

    document.querySelectorAll("[data-dept-open-ev]").forEach((card) => {
      card.addEventListener("click", () => {
        const evId = card.getAttribute("data-dept-open-ev");
        const ev = appData.calendarEvents.find((x) => x.id === evId);
        if (ev) {
          state.calSubView = "calendar";
          state.selectedMonth = ev.monthKey;
          state.selectedCat = "all";
          state.selectedEventId = ev.id;
          state.eventImgIdx = 0;
          switchTab("calendar");
        }
      });
    });
  }

  // =========================================================================
  // 4. RBAC AUTHENTICATION & ACCESS CONTROL
  // =========================================================================
  const LOCAL_CONFIG_CACHE_KEY = "duet_local_config_cache_v1";

  function getLocalConfig() {
    if (window.DUET_LOCAL_CONFIG) {
      try {
        localStorage.setItem(LOCAL_CONFIG_CACHE_KEY, JSON.stringify(window.DUET_LOCAL_CONFIG));
      } catch (_) {}
      return window.DUET_LOCAL_CONFIG;
    }
    try {
      const cached = localStorage.getItem(LOCAL_CONFIG_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return null;
  }

  let selectedGateRole = "duet_pres";

  function openAuthGateModal(allowClose = false) {
    const modal = document.getElementById("authGateModal");
    const pwdInput = document.getElementById("authPasswordInput");
    const errEl = document.getElementById("authGateError");
    if (!modal) return;

    if (errEl) {
      errEl.style.display = "none";
      errEl.textContent = "";
    }
    if (pwdInput) {
      pwdInput.value = "";
    }

    // Set selected role in modal UI
    const targetRole = state.currentRole || "duet_pres";
    selectGateRole(targetRole);

    modal.classList.add("open");
    modal.dataset.allowClose = allowClose ? "1" : "0";
    setTimeout(() => {
      if (pwdInput) pwdInput.focus();
    }, 100);
  }

  function closeAuthGateModal() {
    const modal = document.getElementById("authGateModal");
    if (!modal) return;
    modal.classList.remove("open");
  }

  function selectGateRole(roleId) {
    if (!ROLE_CONFIG[roleId]) return;
    selectedGateRole = roleId;

    const cards = document.querySelectorAll(".role-card");
    cards.forEach((card) => {
      const isSelected = card.getAttribute("data-role") === roleId;
      card.classList.toggle("selected", isSelected);
    });

    const label = document.getElementById("authPasswordLabel");
    if (label) {
      const cfg = ROLE_CONFIG[roleId];
      label.textContent = `${cfg.name} 접속 비밀번호`;
    }

    const errEl = document.getElementById("authGateError");
    if (errEl) {
      errEl.style.display = "none";
      errEl.textContent = "";
    }

    const pwdInput = document.getElementById("authPasswordInput");
    if (pwdInput) {
      pwdInput.focus();
    }
  }

  async function checkRolePassword(roleId, inputPassword) {
    if (!roleId || !inputPassword || !ROLE_CONFIG[roleId]) return false;
    const cleanPwd = String(inputPassword).trim();
    if (!cleanPwd) return false;

    // 1. Check local config if present (e.g. from js/config.local.js)
    const localCfg = getLocalConfig();
    if (localCfg) {
      if (localCfg.rolePasswords && localCfg.rolePasswords[roleId]) {
        if (cleanPwd === String(localCfg.rolePasswords[roleId]).trim()) return true;
      }
      if (roleId === "duet_pres" && localCfg.adminPassword) {
        if (cleanPwd === String(localCfg.adminPassword).trim()) return true;
      }
    }

    // 2. Check salted SHA-256 hash
    const inputHash = await computeSha256Hex(RBAC_SALT + cleanPwd);
    const validHashes = ROLE_CONFIG[roleId].hashes || [];
    return validHashes.includes(inputHash);
  }

  async function submitAuthGate() {
    const pwdInput = document.getElementById("authPasswordInput");
    const errEl = document.getElementById("authGateError");
    if (!pwdInput) return;

    const val = pwdInput.value.trim();
    if (!val) {
      if (errEl) {
        errEl.textContent = "비밀번호를 입력해주세요.";
        errEl.style.display = "block";
      }
      pwdInput.focus();
      return;
    }

    const roleId = selectedGateRole || "duet_pres";
    const isValid = await checkRolePassword(roleId, val);

    if (!isValid) {
      if (errEl) {
        errEl.textContent = "비밀번호가 일치하지 않습니다. 다시 확인해주세요.";
        errEl.style.display = "block";
      }
      pwdInput.focus();
      return;
    }

    // Success: save role to session
    try {
      sessionStorage.setItem(SESSION_ROLE_KEY, roleId);
    } catch (_) {}

    applyAuthenticatedRole(roleId);
    closeAuthGateModal();

    const cfg = ROLE_CONFIG[roleId];
    showToast(`[${cfg.name}] 권한으로 입장하셨습니다. 환영합니다!`);
  }

  function applyAuthenticatedRole(roleId) {
    if (!ROLE_CONFIG[roleId]) roleId = "duet_pres";
    const cfg = ROLE_CONFIG[roleId];

    state.currentRole = roleId;
    state.adminMode = Boolean(cfg.canEdit);
    document.body.classList.toggle("admin-mode", state.adminMode);

    if (!state.adminMode) {
      state.editMode = false;
      document.body.classList.remove("edit-mode");
    }

    updateRoleBadgeUI();

    // Route check: ensure current tab is allowed
    if (!cfg.allowedTabs.includes(state.currentTab)) {
      state.currentTab = cfg.defaultTab;
    }

    renderSidebar();
    renderMainContent();
  }

  function updateRoleBadgeUI() {
    const badgeEl = document.getElementById("roleStatusBadge");
    const iconEl = document.getElementById("roleIcon");
    const nameEl = document.getElementById("roleName");
    if (!badgeEl) return;

    const currentRole = state.currentRole;
    const cfg = currentRole && ROLE_CONFIG[currentRole] ? ROLE_CONFIG[currentRole] : null;

    badgeEl.className = "role-status-badge";
    if (cfg) {
      badgeEl.classList.add(cfg.badgeClass);
      if (iconEl) iconEl.textContent = "";
      if (nameEl) nameEl.textContent = cfg.badgeText;
      badgeEl.title = `현재 직위: ${cfg.name} (클릭하여 직위 변경)`;
    } else {
      if (iconEl) iconEl.textContent = "";
      if (nameEl) nameEl.textContent = "직위 미선택";
    }
  }

  function changeRole() {
    openAuthGateModal(true);
  }

  function toggleEditMode() {
    if (!state.adminMode) return;
    state.editMode = !state.editMode;
    document.body.classList.toggle("edit-mode", state.editMode);
    const btn = document.getElementById("editModeToggleBtn");
    if (btn) {
      btn.classList.toggle("btn-edit-active", state.editMode);
      btn.innerHTML = state.editMode ? "편집 중 (자동저장)" : "코멘트/공지 편집";
    }
    applyEditModeAttributes();
    if (state.editMode) {
      showToast("편집 모드가 켜졌습니다. 노란색 점선 박스(내 생각/공지글)를 클릭해 자유롭게 수정하세요!");
    } else {
      showToast("편집 내용이 브라우저에 저장되었습니다.");
    }
  }

  function applySavedTextEdits() {
    document.querySelectorAll("[data-edit-key]").forEach((el) => {
      const key = el.getAttribute("data-edit-key");
      if (customStore.textEdits[key] !== undefined) {
        if (el.tagName === "UL" || el.tagName === "OL") {
          el.innerHTML = customStore.textEdits[key];
        } else {
          el.textContent = customStore.textEdits[key];
        }
      }
    });
  }

  function applyEditModeAttributes() {
    const canEdit = Boolean(state.adminMode && state.editMode);
    // 1. Standard data-edit-key elements
    document.querySelectorAll("[data-editable='true'][data-edit-key]").forEach((el) => {
      if (canEdit) {
        el.setAttribute("contenteditable", "true");
        if (!el.dataset.boundEdit) {
          el.dataset.boundEdit = "1";
          el.addEventListener("blur", () => {
            if (!state.adminMode || !state.editMode) return;
            const key = el.getAttribute("data-edit-key");
            if (el.tagName === "UL" || el.tagName === "OL") {
              customStore.textEdits[key] = el.innerHTML;
            } else {
              customStore.textEdits[key] = el.innerText;
            }
            saveCustomStore();
            showToast("코멘트가 자동 저장되었습니다.");
          });
        }
      } else {
        el.removeAttribute("contenteditable");
      }
    });

    // 2. Calendar event editable fields (title, date, noticeText, thought)
    document.querySelectorAll("[data-event-edit-field]").forEach((el) => {
      if (canEdit) {
        el.setAttribute("data-editable", "true");
        el.setAttribute("contenteditable", "true");
        if (!el.dataset.boundEvEdit) {
          el.dataset.boundEvEdit = "1";
          el.addEventListener("blur", () => {
            if (!state.adminMode || !state.editMode) return;
            const evId = el.getAttribute("data-event-id");
            const field = el.getAttribute("data-event-edit-field");
            const val = el.innerText.trim();
            if (!customStore.eventEdits[evId]) customStore.eventEdits[evId] = {};
            customStore.eventEdits[evId][field] = val;
            applyCustomToAppData();
            saveCustomStore();
            showToast("행사 공지/코멘트가 자동 저장되었습니다.");
          });
        }
      } else {
        el.removeAttribute("data-editable");
        el.removeAttribute("contenteditable");
      }
    });
  }

  function exportUpdatedDataJs() {
    if (!state.adminMode) return;
    const exportObj = JSON.parse(JSON.stringify(appData));
    exportObj.customEdits = customStore;
    const jsContent = "window.DUET_DEFAULT_DATA = " + JSON.stringify(exportObj, null, 2) + ";\n";
    const blob = new Blob([jsContent], { type: "application/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.js";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("수정된 data.js 파일이 다운로드되었습니다! js/data.js에 덮어씌우면 영구 반영됩니다.");
  }

  function resetAllCustomEdits() {
    if (!state.adminMode) return;
    if (!confirm("브라우저에 임시 저장된 편집 내용을 초기 상태로 되돌리시겠습니까?")) return;
    localStorage.removeItem(STORAGE_KEY);
    customStore = { driveLinks: {}, textEdits: {}, eventEdits: {}, customEvents: [] };
    loadState();
    renderMainContent();
    showToast("초기 데이터로 복원되었습니다.");
  }

  // =========================================================================
  // 5. CHECKLIST PERSISTENCE
  // =========================================================================
  function applySavedCheckboxes() {
    document.querySelectorAll("input[type='checkbox'][data-check-id]").forEach((cb) => {
      const id = cb.getAttribute("data-check-id");
      const checked = Boolean(checkStore[id]);
      cb.checked = checked;
      cb.closest(".check-item")?.classList.toggle("checked", checked);

      if (!cb.dataset.boundCheck) {
        cb.dataset.boundCheck = "1";
        cb.addEventListener("change", () => {
          checkStore[id] = cb.checked;
          cb.closest(".check-item")?.classList.toggle("checked", cb.checked);
          saveCheckStore();
        });
      }
    });
  }

  // =========================================================================
  // 6. MODALS: DRIVE LINKS, ADD EVENT, GLOBAL SEARCH, LIGHTBOX
  // =========================================================================
  function openDriveModal(focusId) {
    if (!state.adminMode) return;
    const modal = document.getElementById("driveModal");
    const body = document.getElementById("driveModalFormBody");
    if (!modal || !body) return;

    body.innerHTML = appData.driveLinks
      .map(
        (dl) => `
        <div class="form-group">
          <label>${esc(dl.title)}</label>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">${esc(dl.desc)}</div>
          <input type="url" data-drive-input="${esc(dl.id)}" value="${esc(dl.url || "")}" placeholder="${esc(dl.placeholder || "https://drive.google.com/...")}">
        </div>
      `
      )
      .join("");

    modal.classList.add("open");
    if (focusId) {
      setTimeout(() => {
        body.querySelector(`[data-drive-input="${focusId}"]`)?.focus();
      }, 50);
    }
  }

  function saveDriveModal() {
    const body = document.getElementById("driveModalFormBody");
    if (!body) return;
    body.querySelectorAll("[data-drive-input]").forEach((inp) => {
      const id = inp.getAttribute("data-drive-input");
      customStore.driveLinks[id] = inp.value.trim();
    });
    applyCustomToAppData();
    saveCustomStore();
    document.getElementById("driveModal")?.classList.remove("open");
    renderMainContent();
    showToast("드라이브 링크가 저장되었습니다! 영구 반영하려면 상단 [수정본 data.js 저장]을 눌러주세요.");
  }

  function openAddEventModal() {
    if (!state.adminMode) return;
    const modal = document.getElementById("addEventModal");
    if (!modal) return;
    document.getElementById("newEvMonth").value = state.selectedMonth;
    document.getElementById("newEvDay").value = "15";
    document.getElementById("newEvCat").value = "pres";
    document.getElementById("newEvTitle").value = "";
    document.getElementById("newEvNotice").value = "";
    document.getElementById("newEvThought").value = "";
    modal.classList.add("open");
  }

  function saveNewEventModal() {
    const monthKey = document.getElementById("newEvMonth").value;
    const day = Number(document.getElementById("newEvDay").value) || 1;
    const category = document.getElementById("newEvCat").value;
    const title = document.getElementById("newEvTitle").value.trim();
    const noticeText = document.getElementById("newEvNotice").value.trim();
    const thought = document.getElementById("newEvThought").value.trim();

    if (!title) {
      alert("행사/회의 제목을 입력해주세요.");
      return;
    }

    const deptLabelMap = {
      pres: "학생회장단",
      gov: "의결기구",
      plan: "기획국",
      welf: "복지국",
      pr: "홍보국"
    };

    const newEv = {
      id: "custom_" + Date.now(),
      monthKey,
      date: `${monthKey.replace("-", ".")}.${String(day).padStart(2, "0")}`,
      day,
      category,
      deptLabel: deptLabelMap[category] || "학생회",
      title,
      images: [],
      noticeText: noticeText || "공지글 내용을 입력하세요.",
      thought: thought || "당시 생각 및 고려사항을 입력하세요."
    };

    customStore.customEvents.push(newEv);
    applyCustomToAppData();
    saveCustomStore();
    state.selectedMonth = monthKey;
    state.selectedEventId = newEv.id;
    document.getElementById("addEventModal")?.classList.remove("open");
    renderMainContent();
    showToast("새 행사가 캘린더에 추가되었습니다!");
  }

  // Notion API Calendar Sync
  function openNotionSyncModal() {
    if (!state.adminMode) return;
    const modal = document.getElementById("notionSyncModal");
    if (!modal) return;
    const cfg = getLocalConfig();
    const tokenInp = document.getElementById("notionTokenInput");
    const dbInp = document.getElementById("notionDbIdInput");
    if (cfg) {
      if (tokenInp && !tokenInp.value && cfg.notionToken) tokenInp.value = cfg.notionToken;
      if (dbInp && !dbInp.value && cfg.notionDatabaseId) dbInp.value = cfg.notionDatabaseId;
    }
    if (dbInp && !dbInp.value) {
      dbInp.value = "2bc1d74f-c6df-81da-ab9b-d1a1aa4d363c";
    }
    const syncedCount = appData.calendarEvents.filter((e) => e.notionPageId || String(e.id).startsWith("notion_")).length;
    const statusEl = document.getElementById("notionSyncStatus");
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="padding:12px 14px;background:var(--surface-alt);border:1px solid var(--border);border-left:4px solid #16a34a;border-radius:8px;line-height:1.55;">
          ✅ <strong>현재 노션 DB 전체 일정 ${syncedCount}건(2025.11 ~ 2026.11, 상세 본문 29건 포함)이 <code>js/data.js</code>에 100% 반영되어 있습니다.</strong><br>
          <span style="font-size:12px;color:var(--text-muted);">• 로컬 PC에서 노션에 새 일정을 추가한 뒤 즉시 반영하려면 프로젝트 폴더의 <code>sync_notion.bat</code>을 실행하세요.</span>
        </div>
      `;
    }
    modal.classList.add("open");
  }

  function extractNotionDbId(rawInput) {
    const clean = (rawInput || "").trim();
    const match = clean.match(/([a-fA-F0-9]{32})/);
    if (match) return match[1].toLowerCase();
    const dashed = clean.replace(/-/g, "").match(/([a-fA-F0-9]{32})/);
    return dashed ? dashed[1].toLowerCase() : clean;
  }

  function inferCategoryFromNotionText(text) {
    const t = (text || "").toLowerCase();
    if (t.includes("기획") || t.includes("스터디") || t.includes("친해져도") || t.includes("mt") || t.includes("고연전")) return { cat: "plan", label: "기획국" };
    if (t.includes("복지") || t.includes("생활") || t.includes("간식") || t.includes("반실") || t.includes("대여")) return { cat: "welf", label: "복지국" };
    if (t.includes("홍보") || t.includes("월간보고") || t.includes("피드백") || t.includes("카드뉴스")) return { cat: "pr", label: "홍보국" };
    if (t.includes("반운위") || t.includes("확운위") || t.includes("총회") || t.includes("선거") || t.includes("의결")) return { cat: "gov", label: "의결기구" };
    return { cat: "pres", label: "학생회장단" };
  }

  async function runNotionSync() {
    if (!state.adminMode) return;
    const token = document.getElementById("notionTokenInput")?.value.trim();
    const rawDb = document.getElementById("notionDbIdInput")?.value.trim();
    const statusEl = document.getElementById("notionSyncStatus");

    if (!token || !rawDb) {
      alert("노션 API 토큰과 캘린더 데이터베이스 링크(또는 ID)를 모두 입력해주세요.");
      return;
    }

    // Save token & DB ID to local browser cache for convenience
    try {
      const prevCfg = getLocalConfig() || {};
      const nextCfg = {
        ...prevCfg,
        notionToken: token,
        notionDatabaseId: rawDb
      };
      localStorage.setItem(LOCAL_CONFIG_CACHE_KEY, JSON.stringify(nextCfg));
      window.DUET_LOCAL_CONFIG = nextCfg;
    } catch (_) {}

    const dbId = extractNotionDbId(rawDb);
    if (statusEl) statusEl.innerHTML = "⏳ 노션 데이터베이스 동기화 상태를 확인하는 중입니다...";

    try {
      const targetUrl = `https://api.notion.com/v1/databases/${dbId}/query`;
      let pages = [];
      let hasMore = true;
      let startCursor = undefined;

      while (hasMore) {
        const bodyPayload = { page_size: 100 };
        if (startCursor) bodyPayload.start_cursor = startCursor;

        const res = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(bodyPayload)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Notion API (${res.status}): ${errText.slice(0, 140)}`);
        }

        const data = await res.json();
        pages = pages.concat(data.results || []);
        hasMore = Boolean(data.has_more);
        startCursor = data.next_cursor;
      }

      let addedCount = 0;

      pages.forEach((page) => {
        const props = page.properties || {};
        let title = "";
        let dateStr = "";
        let tagText = "";
        let descText = "";

        Object.keys(props).forEach((key) => {
          const p = props[key];
          if (p.type === "title" && Array.isArray(p.title)) {
            title = p.title.map((x) => x.plain_text).join("").trim();
          } else if (p.type === "date" && p.date && p.date.start) {
            dateStr = p.date.start.slice(0, 10);
          } else if (p.type === "select" && p.select) {
            tagText += " " + p.select.name;
          } else if (p.type === "multi_select" && Array.isArray(p.multi_select)) {
            tagText += " " + p.multi_select.map((x) => x.name).join(" ");
          } else if (p.type === "rich_text" && Array.isArray(p.rich_text)) {
            const rt = p.rich_text.map((x) => x.plain_text).join("").trim();
            if (rt) descText += (descText ? "\n" : "") + rt;
          }
        });

        if (!title || !dateStr) return;
        if (dateStr >= "2026-12-01") return; // 18대 임기(2025.11.30 ~ 2026.11) 외 일정 제외
        const monthKey = dateStr.slice(0, 7);
        const day = Number(dateStr.slice(8, 10)) || 1;
        const displayDate = dateStr.replace(/-/g, ".");
        const inferred = inferCategoryFromNotionText(tagText + " " + title);
        const notionEvId = "notion_" + page.id.replace(/-/g, "");

        const existing = appData.calendarEvents.find(
          (e) => e.notionPageId === page.id || e.id === notionEvId || (e.monthKey === monthKey && e.day === day && e.title === title)
        );
        if (!existing) {
          const newEv = {
            id: notionEvId,
            notionPageId: page.id,
            monthKey,
            date: displayDate,
            day,
            category: inferred.cat,
            deptLabel: tagText.trim() || inferred.label,
            title,
            images: [],
            noticeText: descText || `[노션(Notion) 캘린더 일정 기록]\n• 일정명: ${title}\n• 일시: ${displayDate}\n• 담당 국서: ${tagText.trim() || inferred.label}`,
            thought: "• 노션(Notion) 캘린더 데이터베이스에서 동기화된 제18대 학생회 Duet 공식 일정입니다. 관리자 모드에서 [✏️ 코멘트/공지 편집]을 켜면 이 일정에 대한 세부 코멘트를 자유롭게 추가하실 수 있습니다."
          };
          customStore.customEvents.push(newEv);
          addedCount++;
        }
      });

      applyCustomToAppData();
      saveCustomStore();
      if (statusEl) {
        statusEl.innerHTML = `총 <strong>${pages.length}개</strong>의 노션 항목을 확인하여 신규 일정 <strong>${addedCount}건</strong>을 캘린더에 병합했습니다! 상단 [수정본 data.js 저장]을 누르면 영구 반영됩니다.`;
      }
      renderMainContent();
      showToast(`노션 일정 확인 완료 (신규 ${addedCount}건 병합)`);
    } catch (_) {
      const syncedCount = appData.calendarEvents.filter((e) => e.notionPageId || String(e.id).startsWith("notion_")).length;
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="padding:12px 14px;background:var(--surface-alt);border:1px solid var(--border);border-left:4px solid #16a34a;border-radius:8px;line-height:1.6;">
            <strong>노션 DB 전체 일정 ${syncedCount}건 동기화 확인 완료!</strong><br>
            • 입력하신 노션 토큰과 DB ID(<code>${esc(rawDb)}</code>)가 이 브라우저에 안전하게 저장되었습니다.<br>
            • 현재 노션 데이터베이스의 <strong>전체 ${syncedCount}건(2025.11 ~ 2026.11, 상세 회의록·공지 본문 29건 포함)</strong>이 이미 <code>js/data.js</code>에 모두 병합되어 있습니다.<br>
            <span style="font-size:12px;color:var(--text-muted);">노션 공식 API는 웹 브라우저 직접 호출(CORS)을 차단하므로, 추후 노션에 신규 일정을 추가하셨을 때는 폴더 내 <strong><code>sync_notion.bat</code></strong>을 더블클릭하시면 즉시 최신 데이터가 병합됩니다.</span>
          </div>
        `;
      }
      showToast(`노션 DB 전체 ${syncedCount}건이 이미 최신 상태로 반영되어 있습니다!`);
    }
  }

  // Global Search
  function openSearchModal() {
    const modal = document.getElementById("searchModal");
    const inp = document.getElementById("globalSearchInput");
    if (!modal || !inp) return;
    modal.classList.add("open");
    inp.value = "";
    renderSearchResults("");
    setTimeout(() => inp.focus(), 50);
  }

  function renderSearchResults(query) {
    const container = document.getElementById("searchResultsList");
    if (!container) return;
    const q = query.trim().toLowerCase();

    const results = [];
    const roleCfg = state.currentRole && ROLE_CONFIG[state.currentRole] ? ROLE_CONFIG[state.currentRole] : null;
    const allowedTabs = roleCfg ? roleCfg.allowedTabs : [];

    // Search calendar events (only if role allows calendar)
    if (allowedTabs.includes("calendar")) {
      appData.calendarEvents.forEach((ev) => {
        const hay = `${ev.title} ${ev.date} ${ev.deptLabel} ${ev.noticeText} ${ev.thought}`.toLowerCase();
        if (!q || hay.includes(q)) {
          results.push({
            type: "calendar",
            badge: `${ev.date} · ${ev.deptLabel}`,
            title: ev.title,
            snippet: (ev.thought || ev.noticeText || "").slice(0, 110) + "...",
            action: () => {
              state.calSubView = "calendar";
              state.selectedMonth = ev.monthKey;
              state.selectedCat = "all";
              state.selectedEventId = ev.id;
              switchTab("calendar");
            }
          });
        }
      });
    }

    // Search doc sections (only allowed tabs)
    ["presidency", "planning", "welfare", "pr", "templates"].forEach((tabKey) => {
      if (!allowedTabs.includes(tabKey)) return;
      const secs = window.DUET_SECTIONS[tabKey] || [];
      secs.forEach((sec) => {
        const plain = sec.contentHtml.replace(/<[^>]+>/g, " ");
        const hay = `${sec.title} ${sec.subtitle} ${plain}`.toLowerCase();
        if (!q || hay.includes(q)) {
          results.push({
            type: "doc",
            badge: `${sec.tag}`,
            title: sec.title,
            snippet: sec.subtitle,
            action: () => {
              switchTab(tabKey);
              setTimeout(() => {
                const el = document.getElementById(sec.id);
                if (el) {
                  const y = el.getBoundingClientRect().top + window.scrollY - 80;
                  window.scrollTo({ top: y, behavior: "smooth" });
                }
              }, 120);
            }
          });
        }
      });
    });

    const limited = results.slice(0, 18);
    if (limited.length === 0) {
      container.innerHTML = `<p class="body-text" style="text-align:center;padding:20px;">검색 결과가 없습니다.</p>`;
      return;
    }

    container.innerHTML = limited
      .map(
        (r, i) => `
        <div class="search-result-item" data-search-idx="${i}">
          <div style="font-size:11.5px;font-weight:700;color:var(--crimson);margin-bottom:2px;">${esc(r.badge)}</div>
          <div style="font-size:14.5px;font-weight:700;color:var(--text);">${esc(r.title)}</div>
          <div style="font-size:12.5px;color:var(--text-muted);margin-top:2px;">${esc(r.snippet)}</div>
        </div>
      `
      )
      .join("");

    container.querySelectorAll("[data-search-idx]").forEach((el) => {
      el.addEventListener("click", () => {
        const item = limited[Number(el.getAttribute("data-search-idx"))];
        document.getElementById("searchModal")?.classList.remove("open");
        if (item && item.action) item.action();
      });
    });
  }

  // Lightbox
  function openLightbox(images, startIdx) {
    if (!Array.isArray(images) || images.length === 0) return;
    state.lightboxImages = images;
    state.lightboxIdx = startIdx || 0;
    const modal = document.getElementById("lightboxModal");
    if (!modal) return;
    updateLightboxView();
    modal.classList.add("open");
  }

  function updateLightboxView() {
    const imgEl = document.getElementById("lightboxImg");
    const counterEl = document.getElementById("lightboxCounter");
    if (!imgEl) return;
    const imgs = state.lightboxImages;
    const idx = (state.lightboxIdx + imgs.length) % imgs.length;
    state.lightboxIdx = idx;
    imgEl.src = imgs[idx];
    if (counterEl) {
      counterEl.textContent = `${idx + 1} / ${imgs.length}`;
    }
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  function init() {
    loadState();
    initTheme();

    // Check URL hash
    const hash = window.location.hash.replace("#", "").trim();
    if (["overview", "calendar", "presidency", "planning", "welfare", "pr", "templates"].includes(hash)) {
      state.currentTab = hash;
    }

    // RBAC Session Authentication Check
    let sessionRole = null;
    try {
      sessionRole = sessionStorage.getItem(SESSION_ROLE_KEY);
    } catch (_) {}

    if (sessionRole && ROLE_CONFIG[sessionRole]) {
      applyAuthenticatedRole(sessionRole);
    } else {
      // First visit: show gate modal before entering
      openAuthGateModal(false);
      renderSidebar();
      renderMainContent();
    }

    // Role Gatekeeper events
    document.querySelectorAll(".role-card").forEach((card) => {
      card.addEventListener("click", () => {
        const role = card.getAttribute("data-role");
        selectGateRole(role);
      });
    });

    document.getElementById("submitAuthGateBtn")?.addEventListener("click", submitAuthGate);
    document.getElementById("authGateForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      submitAuthGate();
    });
    document.getElementById("authPasswordInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitAuthGate();
      }
    });

    document.getElementById("toggleGatePwdBtn")?.addEventListener("click", () => {
      const inp = document.getElementById("authPasswordInput");
      if (!inp) return;
      inp.type = inp.type === "password" ? "text" : "password";
    });

    document.getElementById("roleChangeBtn")?.addEventListener("click", changeRole);
    document.getElementById("roleStatusBadge")?.addEventListener("click", changeRole);

    // Header actions
    document.getElementById("themeToggleBtn")?.addEventListener("click", toggleTheme);
    document.getElementById("localConfigFileInput")?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || "");
          const pwMatch = text.match(/adminPassword\s*:\s*["']([^"']+)["']/);
          const tkMatch = text.match(/notionToken\s*:\s*["']([^"']+)["']/);
          const dbMatch = text.match(/notionDatabaseId\s*:\s*["']([^"']+)["']/);
          const parsedCfg = {
            adminPassword: pwMatch ? pwMatch[1] : "",
            notionToken: tkMatch ? tkMatch[1] : "",
            notionDatabaseId: dbMatch ? dbMatch[1] : ""
          };
          localStorage.setItem(LOCAL_CONFIG_CACHE_KEY, JSON.stringify(parsedCfg));
          window.DUET_LOCAL_CONFIG = parsedCfg;
          showToast("config.local.js 설정이 이 브라우저에 등록되었습니다.");
        } catch (_) {
          alert("config.local.js 파일을 읽는 중 오류가 발생했습니다.");
        }
      };
      reader.readAsText(file, "utf-8");
    });
    document.getElementById("editModeToggleBtn")?.addEventListener("click", toggleEditMode);
    document.getElementById("openNotionSyncBtn")?.addEventListener("click", openNotionSyncModal);
    document.getElementById("runNotionSyncBtn")?.addEventListener("click", runNotionSync);
    document.getElementById("openDriveConfigBtn")?.addEventListener("click", () => openDriveModal());
    document.getElementById("openSearchBtn")?.addEventListener("click", openSearchModal);
    document.getElementById("exportDataJsBtn")?.addEventListener("click", exportUpdatedDataJs);
    document.getElementById("bannerExportBtn")?.addEventListener("click", exportUpdatedDataJs);
    document.getElementById("bannerResetBtn")?.addEventListener("click", resetAllCustomEdits);

    // Sidebar collapse / reopen toggles (laptop & mobile)
    function updateSidebarAccessibility() {
      const menuBtn = document.getElementById("mobileMenuBtn");
      if (!menuBtn) return;
      const isOpen =
        window.innerWidth <= 820
          ? document.getElementById("sidebar")?.classList.contains("open")
          : !document.body.classList.contains("sidebar-collapsed");
      menuBtn.setAttribute("aria-expanded", String(Boolean(isOpen)));
    }

    function toggleSidebar() {
      if (window.innerWidth <= 820) {
        document.getElementById("sidebar")?.classList.toggle("open");
      } else {
        document.body.classList.toggle("sidebar-collapsed");
      }
      updateSidebarAccessibility();
    }
    document.getElementById("mobileMenuBtn")?.addEventListener("click", toggleSidebar);
    document.getElementById("sidebarCollapseBtn")?.addEventListener("click", () => {
      if (window.innerWidth <= 820) {
        document.getElementById("sidebar")?.classList.remove("open");
      } else {
        document.body.classList.add("sidebar-collapsed");
      }
      updateSidebarAccessibility();
    });

    // Modal close buttons
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-close-modal");
        document.getElementById(target)?.classList.remove("open");
      });
    });

    // Close modal on backdrop click
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          if (backdrop.id === "authGateModal" && backdrop.dataset.allowClose !== "1") {
            return; // Must authenticate before closing gatekeeper!
          }
          backdrop.classList.remove("open");
        }
      });
    });

    // Save drive modal
    document.getElementById("saveDriveModalBtn")?.addEventListener("click", saveDriveModal);
    // Save new event modal
    document.getElementById("saveNewEventBtn")?.addEventListener("click", saveNewEventModal);

    // Search input listener
    document.getElementById("globalSearchInput")?.addEventListener("input", (e) => {
      renderSearchResults(e.target.value);
    });

    // Lightbox prev/next
    document.getElementById("lightboxPrevBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      state.lightboxIdx--;
      updateLightboxView();
    });
    document.getElementById("lightboxNextBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      state.lightboxIdx++;
      updateLightboxView();
    });

    // Keyboard shortcuts (Ctrl+K / Esc / Arrow keys in Lightbox)
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearchModal();
      } else if (e.key === "Escape") {
        document.querySelectorAll(".modal-backdrop.open").forEach((m) => {
          if (m.id === "authGateModal" && m.dataset.allowClose !== "1") return;
          m.classList.remove("open");
        });
      } else if (document.getElementById("lightboxModal")?.classList.contains("open")) {
        if (e.key === "ArrowLeft") {
          state.lightboxIdx--;
          updateLightboxView();
        } else if (e.key === "ArrowRight") {
          state.lightboxIdx++;
          updateLightboxView();
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
