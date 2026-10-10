/* =========================================================================
   전쟁 예언자 — 앱 로직 (모바일 최적화: 탭 기반 상호작용 + OSM 지도)
   화면 라우팅 · 5개 미션 · 힌트 · 점수 · 종합 활동
   ========================================================================= */

(function () {
  "use strict";

  const D = GAME_DATA;
  const stage = document.getElementById("stage");
  const topbar = document.getElementById("topbar");
  const stepNav = document.getElementById("stepNav");
  const scoreValue = document.getElementById("scoreValue");
  const progressFill = document.getElementById("progressFill");
  const toastEl = document.getElementById("toast");
  document.getElementById("homeBtn").addEventListener("click", () => go("prologue"));

  const MISSION_KEYS = ["mission1", "mission2", "mission3", "mission4", "mission5"];
  const SCREENS = ["prologue", ...MISSION_KEYS, "epilogue", "result"];

  const state = {
    current: "prologue",
    scores: {},
    hintsUsed: {},
    solved: {},
    answers: {},
  };

  // ---------- localStorage 저장/복원 ----------
  const STORE_KEY = "war-prophet-progress-v1";

  function saveState() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          scores: state.scores,
          hintsUsed: state.hintsUsed,
          solved: state.solved,
          answers: state.answers,
          current: state.current,
        })
      );
    } catch (e) {}
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      state.scores = saved.scores || {};
      state.hintsUsed = saved.hintsUsed || {};
      state.solved = saved.solved || {};
      state.answers = saved.answers || {};
      state.current = saved.current || "prologue";
    } catch (e) {}
  }
  function clearStore() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    state.scores = {};
    state.hintsUsed = {};
    state.solved = {};
    state.answers = {};
  }
  function saveAnswer(missionKey, obj) {
    state.answers[missionKey] = Object.assign({}, state.answers[missionKey], obj);
    saveState();
  }
  function getAnswer(missionKey) {
    return state.answers[missionKey] || {};
  }

  // ---------- 유틸 ----------
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2400);
  }
  function totalScore() {
    return Object.values(state.scores).reduce((a, b) => a + b, 0);
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // ---------- 상단 진행 표시 ----------
  function renderTopbar() {
    if (state.current === "prologue") { topbar.hidden = true; return; }
    topbar.hidden = false;
    stepNav.innerHTML = "";
    MISSION_KEYS.forEach((mk, i) => {
      const dot = el("button", "step-dot");
      dot.textContent = i + 1;
      if (state.solved[mk]) dot.classList.add("done");
      if (state.current === mk) dot.classList.add("current");
      const idx = MISSION_KEYS.indexOf(state.current);
      const reachable = state.solved[mk] || i <= idx;
      dot.disabled = !reachable;
      dot.title = D[mk].name;
      dot.addEventListener("click", () => reachable && go(mk));
      stepNav.appendChild(dot);
    });
    scoreValue.textContent = totalScore();
    const solvedCount = MISSION_KEYS.filter((k) => state.solved[k]).length;
    progressFill.style.width = (solvedCount / MISSION_KEYS.length) * 100 + "%";
  }

  // ---------- 라우터 ----------
  function go(screen) {
    state.current = screen;
    saveState();
    renderTopbar();
    stage.innerHTML = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    ({
      prologue: renderPrologue,
      mission1: renderMission1,
      mission2: renderMission2,
      mission3: renderMission3,
      mission4: renderMission4,
      mission5: renderMission5,
      epilogue: renderEpilogue,
      result: renderResult,
    }[screen])();
  }
  function nextScreen(cur) { return SCREENS[SCREENS.indexOf(cur) + 1]; }

  // ---------- 공통: 미션 머리글 ----------
  function missionHeader(m) {
    const c = el("div", "card");
    c.appendChild(el("div", "mission-eyebrow", `🕯️ 미션 ${m.order} · 전쟁 예언자`));
    c.appendChild(el("h1", "mission-title serif", esc(m.name)));
    c.appendChild(el("p", "mission-goal", esc(m.goal)));
    return c;
  }

  // ---------- 공통: 힌트 박스 ----------
  function hintBlock(m) {
    const key = m.id === "m1" ? "mission1" : m.id === "m2" ? "mission2" : m.id === "m3" ? "mission3" : m.id === "m4" ? "mission4" : "mission5";
    state.hintsUsed[key] = state.hintsUsed[key] || 0;

    const box = el("div", "hint-box");
    box.appendChild(el("h4", null, "🔍 예언의 실마리 (힌트)"));
    box.appendChild(el("p", "tiny muted", "힌트를 열 때마다 이 미션의 예언 점수가 1점씩 줄어듭니다. 점수보다 스스로 추론하는 과정이 더 중요합니다."));
    const list = el("ul", "hint-list");
    box.appendChild(list);
    const row = el("div", "hint-btn-row");
    const btn = el("button", "btn btn-ghost", "힌트 열기 →");
    row.appendChild(btn);
    box.appendChild(row);

    let shown = 0;
    for (let i = 0; i < state.hintsUsed[key]; i++) {
      list.appendChild(el("li", null, `💡 ${esc(m.hints[i])}`));
      shown++;
    }
    updateBtn();
    btn.addEventListener("click", () => {
      if (shown >= m.hints.length) return;
      list.appendChild(el("li", null, `💡 ${esc(m.hints[shown])}`));
      shown++;
      state.hintsUsed[key] = Math.max(state.hintsUsed[key], shown);
      saveState();
      renderTopbar();
      updateBtn();
    });
    function updateBtn() {
      if (shown >= m.hints.length) { btn.disabled = true; btn.textContent = "힌트를 모두 열었어요"; }
      else { btn.textContent = `힌트 열기 (${shown}/${m.hints.length}) →`; }
    }
    return box;
  }

  function scoreFor(missionKey, base) {
    const used = state.hintsUsed[missionKey] || 0;
    return Math.max(1, base - used);
  }

  // ---------- 공통: 결과 패널 ----------
  function revealPanel({ verdict, cls, blocks, caution, twoSides, prophecy, gained }) {
    const p = el("div", "reveal " + (cls || "correct"));
    p.appendChild(el("div", "verdict", verdict));
    if (gained != null) p.appendChild(el("p", null, `이 미션에서 <b>${gained}점</b>을 얻었습니다.`));
    (blocks || []).forEach((b) => {
      const d = el("div", "block");
      d.innerHTML = `<b>${esc(b.h)}</b><br>${b.t}`;
      p.appendChild(d);
    });
    if (twoSides) {
      const ts = el("div", "two-sides");
      const pos = el("div", "side pos");
      pos.appendChild(el("h5", null, "✅ 긍정적인 면"));
      const ul1 = el("ul"); twoSides.positive.forEach((x) => ul1.appendChild(el("li", null, esc(x)))); pos.appendChild(ul1);
      const lim = el("div", "side lim");
      lim.appendChild(el("h5", null, "⚠️ 한계"));
      const ul2 = el("ul"); twoSides.limits.forEach((x) => ul2.appendChild(el("li", null, esc(x)))); lim.appendChild(ul2);
      ts.appendChild(pos); ts.appendChild(lim);
      p.appendChild(ts);
    }
    if (caution) p.appendChild(el("div", "caution", "🧭 " + esc(caution)));
    if (prophecy) p.appendChild(el("div", "prophecy-line", "『예언』 " + esc(prophecy)));
    return p;
  }

  function nextButton(cur, label) {
    const wrap = el("div", "actions");
    wrap.appendChild(el("div", "spacer"));
    const btn = el("button", "btn btn-primary", label || "다음 미션으로 →");
    btn.addEventListener("click", () => go(nextScreen(cur)));
    wrap.appendChild(btn);
    return wrap;
  }

  /* =======================================================================
     공통 상호작용 헬퍼 (탭/터치 기반, 드래그 없음)
     ======================================================================= */

  // 카드 분류: 데스크톱은 드래그 앤 드롭, 모바일은 탭(카드 탭 → 상자 탭).
  // items: [{id, html}]  zones: [{key, label}]  onChange(): 상태 변화 콜백
  // 반환: { getPlacement(): {id: zoneKey|null}, placeAll(map), lock() }
  function tapClassifier(host, items, zones, opts) {
    opts = opts || {};
    let selectedId = null;
    let locked = false;
    let draggedId = null;
    const placement = {}; // id -> zoneKey (없으면 풀)
    items.forEach((it) => (placement[it.id] = null));

    const desktopMode = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(min-width: 641px)").matches
      : false;

    const defaultHint = desktopMode
      ? "카드를 상자로 끌어다 놓아 분류하세요. (담긴 카드를 다시 풀로 끌어 꺼낼 수 있어요)"
      : "① 아래 카드를 하나 탭해 고르고 ② 담을 상자를 탭하세요. (담긴 카드를 다시 탭하면 꺼냅니다)";

    const pool = el("div", "tap-pool");
    pool.dataset.zone = "__pool__";
    const poolTitle = el("p", "pool-hint", opts.poolHint || defaultHint);
    host.appendChild(poolTitle);
    host.appendChild(pool);

    const zoneWrap = el("div", "tap-zones");
    const zoneEls = {};
    zones.forEach((z) => {
      const box = el("div", "tap-zone " + (z.cls || ""));
      box.appendChild(el("h4", null, z.label));
      const inner = el("div", "tap-zone-items");
      box.appendChild(inner);
      zoneEls[z.key] = { box, inner };
      // 모바일: 상자 탭으로 담기
      box.addEventListener("click", () => {
        if (locked || desktopMode) return;
        if (!selectedId) { toast("먼저 위에서 카드를 하나 탭해 고르세요."); return; }
        placement[selectedId] = z.key;
        selectedId = null;
        render();
        if (opts.onChange) opts.onChange();
      });
      // 데스크톱: 상자로 드롭
      attachDropZone(box, z.key);
      zoneWrap.appendChild(box);
    });
    host.appendChild(zoneWrap);

    // 풀(원위치)도 드롭 대상 → 담긴 카드를 다시 꺼내기
    attachDropZone(pool, null);

    function attachDropZone(elm, zoneKey) {
      if (!desktopMode) return;
      elm.addEventListener("dragover", (ev) => {
        if (locked || !draggedId) return;
        ev.preventDefault();
        elm.classList.add("drop-target");
      });
      elm.addEventListener("dragleave", (ev) => {
        if (!elm.contains(ev.relatedTarget)) elm.classList.remove("drop-target");
      });
      elm.addEventListener("drop", (ev) => {
        if (locked || !draggedId) return;
        ev.preventDefault();
        elm.classList.remove("drop-target");
        placement[draggedId] = zoneKey;
        draggedId = null;
        render();
        if (opts.onChange) opts.onChange();
      });
    }

    function makeCard(it, inZone) {
      const c = el("div", "tap-card" + (inZone ? " placed" : "") + (selectedId === it.id ? " selected" : ""));
      c.innerHTML = it.html;

      if (desktopMode && !locked) {
        c.draggable = true;
        c.addEventListener("dragstart", (ev) => {
          draggedId = it.id;
          c.classList.add("dragging");
          if (ev.dataTransfer) { ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", it.id); }
        });
        c.addEventListener("dragend", () => {
          c.classList.remove("dragging");
          draggedId = null;
          host.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
        });
      }

      // 모바일: 탭으로 선택/복귀
      c.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (locked || desktopMode) return;
        if (inZone) {
          placement[it.id] = null;
          selectedId = null;
          render();
          if (opts.onChange) opts.onChange();
        } else {
          selectedId = selectedId === it.id ? null : it.id;
          render();
        }
      });
      return c;
    }

    function render() {
      pool.innerHTML = "";
      Object.values(zoneEls).forEach((z) => (z.inner.innerHTML = ""));
      items.forEach((it) => {
        const z = placement[it.id];
        if (z && zoneEls[z]) zoneEls[z].inner.appendChild(makeCard(it, true));
        else pool.appendChild(makeCard(it, false));
      });
      if (pool.children.length === 0) {
        pool.appendChild(el("p", "tiny muted",
          desktopMode
            ? "모든 카드를 분류했어요. 담긴 카드를 이 영역으로 끌면 다시 꺼낼 수 있어요."
            : "모든 카드를 분류했어요. 담긴 카드를 탭하면 다시 꺼낼 수 있어요."));
      }
    }
    render();

    return {
      getPlacement: () => Object.assign({}, placement),
      placeAll: (map) => { Object.keys(map).forEach((id) => (placement[id] = map[id])); render(); },
      lock: () => { locked = true; render(); poolTitle.textContent = opts.lockedHint || "제출 완료 — 분류가 잠겼습니다."; },
    };
  }

  // 순서 배열: 데스크톱은 드래그 앤 드롭, 모바일은 ▲▼ 버튼.
  // cards: [{id, text, order}]
  // 반환: { getOrderIds(), markResult(), lock(), setOrder(ids) }
  function tapOrderList(host, cards) {
    let locked = false;
    let arr = cards.slice();
    const listEl = el("div", "order-list");
    const desktopMode = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(min-width: 641px)").matches
      : false;
    let draggedId = null;

    host.appendChild(listEl);

    function move(i, dir) {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      render();
    }

    function render() {
      listEl.innerHTML = "";
      arr.forEach((c, i) => {
        const it = el("div", "order-item" + (c._ok ? " ok" : "") + (c._bad ? " bad" : ""));
        it.dataset.id = c.id;
        it.appendChild(el("span", "num", String(i + 1)));
        it.appendChild(el("span", "txt", esc(c.text)));

        if (!locked && desktopMode) {
          it.draggable = true;
          const grip = el("span", "order-grip", "⠿");
          grip.setAttribute("aria-label", "카드를 끌어 순서를 바꾸세요");
          grip.title = "카드를 끌어 순서를 바꾸세요";
          it.appendChild(grip);
        }

        if (!locked && !desktopMode) {
          const ctrl = el("div", "order-ctrl");
          const up = el("button", "ord-btn", "▲");
          up.setAttribute("aria-label", "위로");
          up.disabled = i === 0;
          up.addEventListener("click", () => move(i, -1));
          const dn = el("button", "ord-btn", "▼");
          dn.setAttribute("aria-label", "아래로");
          dn.disabled = i === arr.length - 1;
          dn.addEventListener("click", () => move(i, 1));
          ctrl.appendChild(up);
          ctrl.appendChild(dn);
          it.appendChild(ctrl);
        }
        listEl.appendChild(it);
      });
    }

    // 데스크톱 전용 드래그 앤 드롭 이벤트
    listEl.addEventListener("dragstart", (event) => {
      if (locked || !desktopMode) return;
      const item = event.target.closest(".order-item");
      if (!item) return;
      draggedId = item.dataset.id;
      item.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedId);
      }
    });

    listEl.addEventListener("dragend", (event) => {
      const item = event.target.closest(".order-item");
      if (item) item.classList.remove("dragging");
      draggedId = null;
      listEl.querySelectorAll(".drag-over").forEach((node) => node.classList.remove("drag-over"));
    });

    listEl.addEventListener("dragover", (event) => {
      if (locked || !desktopMode || !draggedId) return;
      event.preventDefault();
      const target = event.target.closest(".order-item");
      if (!target || target.dataset.id === draggedId) return;
      listEl.querySelectorAll(".drag-over").forEach((node) => node.classList.remove("drag-over"));
      target.classList.add("drag-over");
    });

    listEl.addEventListener("dragleave", (event) => {
      const target = event.target.closest(".order-item");
      if (target && !target.contains(event.relatedTarget)) target.classList.remove("drag-over");
    });

    listEl.addEventListener("drop", (event) => {
      if (locked || !desktopMode || !draggedId) return;
      event.preventDefault();
      const target = event.target.closest(".order-item");
      if (!target || target.dataset.id === draggedId) return;
      const from = arr.findIndex((card) => card.id === draggedId);
      const to = arr.findIndex((card) => card.id === target.dataset.id);
      if (from < 0 || to < 0) return;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      draggedId = null;
      render();
    });

    render();

    return {
      getOrderIds: () => arr.map((c) => c.id),
      markResult: () => {
        let ok = 0;
        arr.forEach((c, i) => {
          const good = c.order === i + 1;
          c._ok = good;
          c._bad = !good;
          if (good) ok++;
        });
        render();
        return ok;
      },
      lock: () => {
        locked = true;
        arr.forEach((c) => { c._ok = true; c._bad = false; });
        render();
      },
      setOrder: (ids) => {
        if (!ids || !ids.length) return;
        arr = ids.map((id) => cards.find((c) => c.id === id)).filter(Boolean);
        cards.forEach((c) => { if (!arr.includes(c)) arr.push(c); });
        render();
      },
    };
  }

  /* =======================================================================
     프롤로그
     ======================================================================= */
  function renderPrologue() {
    const p = D.prologue;
    const hero = el("div", "card hero");
    hero.appendChild(el("div", "seal", "🕯️"));
    hero.appendChild(el("div", "subtitle", "제1차 세계대전 · 세계사 탐구"));
    hero.appendChild(el("h1", "serif", "표선 전쟁 예언자"));
    hero.appendChild(el("div", "year-chip", esc(p.year)));
    hero.appendChild(el("p", "lead", esc(p.intro)));
    hero.appendChild(el("p", "lead", esc(p.mission)));

    const hasProgress = Object.keys(state.solved).length > 0 ||
      MISSION_KEYS.some((k) => Object.keys(getAnswer(k)).length > 0);

    const startRow = el("div", "actions");
    startRow.style.justifyContent = "center";
    const start = el("button", "btn btn-primary",
      hasProgress ? "이어서 예언하기 →" : "예언자의 임무 시작하기 →");
    start.addEventListener("click", () => {
      const firstUnsolved = MISSION_KEYS.find((k) => !state.solved[k]);
      const target = hasProgress ? (firstUnsolved || "epilogue") : "mission1";
      go(target);
    });
    startRow.appendChild(start);
    if (hasProgress) {
      const reset = el("button", "btn btn-ghost", "저장된 진행 지우고 처음부터 ↺");
      reset.addEventListener("click", () => {
        clearStore();
        toast("저장된 답안을 모두 지웠어요.");
        go("prologue");
      });
      startRow.appendChild(reset);
    }
    hero.appendChild(startRow);
    if (hasProgress) {
      hero.appendChild(el("p", "tiny muted",
        "💾 이 노트북에는 지금까지 작성한 답안이 저장되어 있어요. '이어서 예언하기'를 누르면 이어서 진행합니다."));
    }
    stage.appendChild(hero);

    const cc = el("div", "card");
    cc.appendChild(el("h3", "serif", "🗝️ 먼저 익혀 둘 다섯 개념"));
    cc.appendChild(el("p", "muted", "미션 도중 헷갈리면 언제든 다시 떠올려 보세요."));
    const grid = el("div", "concept-grid");
    p.concepts.forEach((c) => {
      const box = el("div", "concept");
      box.innerHTML = `<b>${esc(c.term)}</b><span>${esc(c.desc)}</span>`;
      grid.appendChild(box);
    });
    cc.appendChild(grid);
    stage.appendChild(cc);
  }

  /* =======================================================================
     미션 1 — OSM 지도 + 탭 분류
     ======================================================================= */
  function renderMission1() {
    const m = D.mission1;
    stage.appendChild(missionHeader(m));

    // 지도 카드
    const mapCard = el("div", "card");
    mapCard.appendChild(el("h3", "serif", "🗺️ 1914년 유럽 지도"));
    mapCard.appendChild(el("p", "muted", "실제 지도 위에 여섯 나라가 표시됩니다. 아래에서 분류하면 지도의 국가 색이 진영에 따라 바뀝니다."));
    const mapDiv = el("div", "leaflet-map");
    mapCard.appendChild(mapDiv);
    stage.appendChild(mapCard);

    let europe = null;
    try { europe = MAPS.buildEurope(mapDiv); }
    catch (e) { mapDiv.innerHTML = '<p class="tiny muted" style="padding:16px">지도를 불러오지 못했습니다. 인터넷 연결을 확인하세요. (분류 활동은 그대로 진행할 수 있어요.)</p>'; }

    // 분류 카드
    const card = el("div", "card");
    card.appendChild(el("p", null, "여섯 나라의 특징을 읽고 <b>두 진영</b>으로 나누세요."));

    const items = m.countries.map((c) => ({
      id: c.id,
      html: `<b>${c.emoji} ${esc(c.name)}</b><ul>${c.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`,
    }));
    const zones = [
      { key: "alliance", label: "🔴 진영 A", cls: "alliance" },
      { key: "entente", label: "🔵 진영 B", cls: "entente" },
    ];

    const clf = tapClassifier(card, shuffleItems(items), zones, {
      onChange: () => paintMap(),
    });
    function shuffleItems(list) { return shuffle(list); }
    function paintMap() {
      if (!europe) return;
      const pl = clf.getPlacement();
      m.countries.forEach((c) => europe.setGroup(c.id, pl[c.id] || "none"));
    }

    card.appendChild(hintBlock(m));
    const actions = el("div", "actions");
    actions.appendChild(el("div", "spacer"));
    const check = el("button", "btn btn-primary", "이 분류로 예언하기");
    actions.appendChild(check);
    card.appendChild(actions);
    const resultHost = el("div");
    card.appendChild(resultHost);

    function showReveal() {
      const nameOf = (id) => m.countries.find((c) => c.id === id).name;
      resultHost.innerHTML = "";
      resultHost.appendChild(revealPanel({
        verdict: "🎯 정확한 분류입니다!",
        cls: "correct",
        gained: state.scores.mission1,
        blocks: [
          { h: "삼국동맹", t: m.answer.alliance.map(nameOf).join(", ") },
          { h: "삼국협상", t: m.answer.entente.map(nameOf).join(", ") },
        ],
        caution: m.caution,
        prophecy: m.prophecy,
      }));
      resultHost.appendChild(nextButton("mission1"));
    }

    // 복원
    if (state.solved.mission1) {
      const map = {};
      m.answer.alliance.forEach((id) => (map[id] = "alliance"));
      m.answer.entente.forEach((id) => (map[id] = "entente"));
      clf.placeAll(map);
      clf.lock();
      paintMap();
      check.disabled = true;
      showReveal();
    }

    check.addEventListener("click", () => {
      const pl = clf.getPlacement();
      const alliance = Object.keys(pl).filter((id) => pl[id] === "alliance");
      const entente = Object.keys(pl).filter((id) => pl[id] === "entente");
      if (alliance.length + entente.length < m.countries.length) { toast("아직 분류하지 않은 국가가 있어요."); return; }
      const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
      const correct =
        (same(alliance, m.answer.alliance) && same(entente, m.answer.entente)) ||
        (same(alliance, m.answer.entente) && same(entente, m.answer.alliance));
      if (!correct) { toast("두 진영이 완전히 맞지는 않아요. 힌트를 참고해 다시 나눠 보세요."); return; }
      check.disabled = true;
      clf.lock();
      state.solved.mission1 = true;
      state.scores.mission1 = scoreFor("mission1", 4);
      saveAnswer("mission1", { alliance: m.answer.alliance, entente: m.answer.entente });
      renderTopbar();
      showReveal();
      resultHost.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    stage.appendChild(card);
  }

  /* =======================================================================
     미션 2 — OSM 발칸 지도 + 프로파일러 추리 + 예언
     ======================================================================= */
  function renderMission2() {
    const m = D.mission2;
    stage.appendChild(missionHeader(m));

    const boardCard = el("div", "card");
    boardCard.appendChild(el("h3", "serif", "🕵️ 사건 프로파일링 보드"));
    boardCard.appendChild(el("p", "muted", "실마리를 한 단계씩 열 때마다 발칸반도 지도의 관련 지역이 강조됩니다."));
    const mapDiv = el("div", "leaflet-map");
    boardCard.appendChild(mapDiv);

    let balkans = null;
    try { balkans = MAPS.buildBalkans(mapDiv); }
    catch (e) { mapDiv.innerHTML = '<p class="tiny muted" style="padding:16px">지도를 불러오지 못했습니다. 인터넷 연결을 확인하세요.</p>'; }

    const clueTrack = el("div", "clue-track");
    boardCard.appendChild(clueTrack);
    const openBtn = el("button", "btn btn-gold", "첫 번째 단서 열기 →");
    const br = el("div", "actions"); br.appendChild(openBtn);
    boardCard.appendChild(br);
    stage.appendChild(boardCard);

    let opened = 0;
    function renderStage() {
      const s = m.clueStages[opened];
      const step = el("div", "clue-step");
      step.appendChild(el("h4", null, "🔓 " + esc(s.title)));
      const ul = el("ul");
      s.clues.forEach((c) => ul.appendChild(el("li", null, esc(c))));
      step.appendChild(ul);
      if (s.deduce) step.appendChild(el("div", "deduce-note", "🧩 " + esc(s.deduce)));
      clueTrack.appendChild(step);
      if (balkans) balkans.highlight(s.highlight);
      opened++;
      if (opened >= m.clueStages.length) { openBtn.disabled = true; openBtn.textContent = "모든 단서를 확인했어요"; }
      else openBtn.textContent = `다음 단서 열기 (${opened}/${m.clueStages.length}) →`;
    }
    openBtn.addEventListener("click", renderStage);
    renderStage();

    // 표적 지목
    const culCard = el("div", "card");
    culCard.appendChild(el("h3", "serif", "🎯 프로파일러의 지목"));
    culCard.appendChild(el("p", "muted", esc(m.culprit.question)));
    const cList = el("div", "choice-list");
    let pickedCulprit = null;
    let culpritLocked = false;
    m.culprit.options.forEach((o) => {
      const b = el("button", "choice", esc(o.text));
      b.dataset.id = o.id;
      b.addEventListener("click", () => {
        if (culpritLocked) return;
        cList.querySelectorAll(".choice").forEach((n) => n.classList.remove("selected"));
        b.classList.add("selected");
        pickedCulprit = o;
        saveAnswer("mission2", { culprit: o.id });
      });
      cList.appendChild(b);
    });
    culCard.appendChild(cList);
    stage.appendChild(culCard);

    // 예언 기록장
    const predCard = el("div", "card");
    predCard.appendChild(el("h3", "serif", "✍️ 나의 예언 기록장"));
    predCard.appendChild(el("p", "muted", "지금까지 정리한 흐름을 종합해 다음 칸을 채워 예언을 완성하세요."));
    const grid = el("div", "slot-grid");
    const inputs = {};
    m.predictionSlots.forEach((s) => {
      const slot = el("div", "slot");
      slot.appendChild(el("label", null, esc(s.label)));
      const inp = el("input"); inp.type = "text"; inp.placeholder = s.placeholder;
      inp.addEventListener("input", () => saveAnswer("mission2", { [s.key]: inp.value }));
      slot.appendChild(inp);
      inputs[s.key] = inp;
      grid.appendChild(slot);
    });
    predCard.appendChild(grid);
    predCard.appendChild(hintBlock(m));
    const actions = el("div", "actions");
    actions.appendChild(el("div", "spacer"));
    const submit = el("button", "btn btn-primary", "예언 제출하기");
    actions.appendChild(submit);
    predCard.appendChild(actions);
    const resultHost = el("div");
    predCard.appendChild(resultHost);

    function finalize(scroll) {
      culpritLocked = true;
      submit.disabled = true;
      Object.values(inputs).forEach((i) => (i.disabled = true));
      cList.querySelectorAll(".choice").forEach((n) => {
        const o = m.culprit.options.find((x) => x.id === n.dataset.id);
        n.classList.remove("selected");
        if (o.correct) n.classList.add("correct");
        else if (n.dataset.id === pickedCulprit.id) n.classList.add("wrong");
      });
      const vals = {};
      Object.keys(inputs).forEach((k) => (vals[k] = inputs[k].value.trim()));
      let hit = 0;
      Object.keys(m.keywords).forEach((k) => { if (m.keywords[k].some((w) => vals[k].includes(w))) hit++; });
      const total = Object.keys(m.keywords).length;
      if (balkans) balkans.showSarajevo();
      const matched = pickedCulprit.correct && hit === total;
      resultHost.innerHTML = "";
      resultHost.appendChild(revealPanel({
        verdict: matched ? "🎯 사라예보 사건을 정확히 예언했습니다!"
          : `🔎 예언 완료 · 표적 ${pickedCulprit.correct ? "적중" : "오답"} · 예언 단서 ${hit}/${total}개 적중`,
        cls: matched ? "correct" : "partial",
        gained: state.scores.mission2,
        blocks: [
          { h: "프로파일러 결론", t: esc(pickedCulprit.correct ? m.culprit.feedbackRight : m.culprit.feedbackWrong) },
          { h: "실제로 일어난 사건", t: esc(m.answerEvent) },
          { h: "역사 해설", t: esc(m.explanation) },
        ],
        caution: m.caution,
        prophecy: m.prophecy,
      }));
      resultHost.appendChild(nextButton("mission2"));
      if (scroll) resultHost.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // 복원
    const saved2 = getAnswer("mission2");
    if (saved2.culprit) {
      const o = m.culprit.options.find((x) => x.id === saved2.culprit);
      const b = cList.querySelector(`.choice[data-id="${saved2.culprit}"]`);
      if (o && b) { pickedCulprit = o; b.classList.add("selected"); }
    }
    Object.keys(inputs).forEach((k) => { if (typeof saved2[k] === "string") inputs[k].value = saved2[k]; });
    if (state.solved.mission2 && pickedCulprit) finalize(false);

    submit.addEventListener("click", () => {
      if (!pickedCulprit) { toast("먼저 위쪽 '프로파일러의 지목'에서 표적 인물을 골라 주세요."); return; }
      const vals = {};
      Object.keys(inputs).forEach((k) => (vals[k] = inputs[k].value.trim()));
      if (Object.values(vals).some((v) => v.length === 0)) { toast("예언 기록장 네 칸을 모두 채워야 제출할 수 있어요."); return; }
      let hit = 0;
      Object.keys(m.keywords).forEach((k) => { if (m.keywords[k].some((w) => vals[k].includes(w))) hit++; });
      const total = Object.keys(m.keywords).length;
      state.solved.mission2 = true;
      const culpritScore = pickedCulprit.correct ? 1 : 0;
      const predScore = Math.round((hit / total) * 3);
      state.scores.mission2 = scoreFor("mission2", Math.max(2, culpritScore + predScore));
      saveAnswer("mission2", { culprit: pickedCulprit.id });
      renderTopbar();
      finalize(true);
    });

    stage.appendChild(predCard);
  }

  /* =======================================================================
     미션 3 — 탭 분류 + 키워드
     ======================================================================= */
  function renderMission3() {
    const m = D.mission3;
    stage.appendChild(missionHeader(m));

    const card = el("div", "card");
    card.appendChild(el("p", null, "전쟁의 여러 모습을 <b>두 범주</b>로 나눈 뒤, 이 전쟁을 대표하는 <b>두 키워드</b>를 찾아내세요."));

    const items = m.evidence.map((ev) => ({ id: ev.id, html: `<span>${esc(ev.text)}</span>` }));
    const zones = Object.keys(m.categories).map((cat) => ({
      key: cat, label: m.categories[cat].icon + " " + m.categories[cat].label,
    }));
    const clf = tapClassifier(card, shuffle(items), zones, {});

    card.appendChild(el("hr", "soft"));
    const kf = el("div", "field");
    kf.appendChild(el("label", null, "🗝️ 이 전쟁을 대표하는 두 키워드는?"));
    // 상시(바로 보이는) 힌트 — 설명을 덧붙이고 ㅁㅁ전 표기
    kf.appendChild(el("p", "tiny muted",
      "힌트: 첫 번째는 병사들이 땅을 파고 버티는 도랑 '참호'와 관련된 <b>ㅁㅁ전</b>, " +
      "두 번째는 나라의 모든 힘을 쏟아붓는 <b>ㅁㅁ전</b>입니다."));
    const krow = el("div", "keyword-row");
    const k1 = el("input"); k1.type = "text"; k1.placeholder = "ㅁㅁ전 (땅을 파고 대치)";
    const k2 = el("input"); k2.type = "text"; k2.placeholder = "ㅁㅁ전 (나라 전체를 동원)";
    k1.addEventListener("input", () => saveAnswer("mission3", { k1: k1.value }));
    k2.addEventListener("input", () => saveAnswer("mission3", { k2: k2.value }));
    krow.appendChild(k1); krow.appendChild(k2);
    kf.appendChild(krow);
    card.appendChild(kf);

    card.appendChild(hintBlock(m));
    const actions = el("div", "actions");
    actions.appendChild(el("div", "spacer"));
    const submit = el("button", "btn btn-primary", "분류와 키워드 확인하기");
    actions.appendChild(submit);
    card.appendChild(actions);
    const resultHost = el("div");
    card.appendChild(resultHost);

    function showReveal(scroll) {
      const saved = getAnswer("mission3");
      const sortOk = typeof saved.sortOk === "number" ? saved.sortOk : m.evidence.length;
      submit.disabled = true; k1.disabled = true; k2.disabled = true;
      clf.lock();
      resultHost.innerHTML = "";
      resultHost.appendChild(revealPanel({
        verdict: `🎯 두 키워드를 찾았습니다! (분류 정확도 ${sortOk}/${m.evidence.length})`,
        cls: "correct",
        gained: state.scores.mission3,
        blocks: [
          { h: "참호전", t: esc(m.concepts["참호전"]) },
          { h: "총력전", t: esc(m.concepts["총력전"]) },
        ],
        caution: m.caution,
        prophecy: m.prophecy,
      }));
      resultHost.appendChild(nextButton("mission3"));
      if (scroll) resultHost.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const saved3 = getAnswer("mission3");
    if (typeof saved3.k1 === "string") k1.value = saved3.k1;
    if (typeof saved3.k2 === "string") k2.value = saved3.k2;
    // 분류 복원(정답 배치)
    if (state.solved.mission3) {
      const map = {}; m.evidence.forEach((ev) => (map[ev.id] = ev.cat));
      clf.placeAll(map);
      showReveal(false);
    }

    submit.addEventListener("click", () => {
      const pl = clf.getPlacement();
      const placedCount = Object.values(pl).filter((v) => v).length;
      if (placedCount < m.evidence.length) { toast("아직 분류하지 않은 카드가 있어요."); return; }
      let sortOk = 0;
      m.evidence.forEach((ev) => { if (pl[ev.id] === ev.cat) sortOk++; });
      const answers = [k1.value.trim(), k2.value.trim()];
      const found = m.keywordTargets.map((t) => answers.some((a) => t.accept.some((w) => a.includes(w))));
      if (found.filter(Boolean).length < 2) { toast("두 키워드를 아직 다 찾지 못했어요. 힌트를 참고해 보세요."); return; }
      state.solved.mission3 = true;
      const sortScore = sortOk === m.evidence.length ? 2 : sortOk >= m.evidence.length - 2 ? 1 : 0;
      state.scores.mission3 = scoreFor("mission3", 2 + sortScore);
      saveAnswer("mission3", { sortOk });
      renderTopbar();
      showReveal(true);
    });

    stage.appendChild(card);
  }

  /* =======================================================================
     미션 4 — 학습 카드 + 탭 순서 배열
     ======================================================================= */
  function renderMission4() {
    const m = D.mission4;
    stage.appendChild(missionHeader(m));

    const learnCard = el("div", "card");
    learnCard.appendChild(el("h3", "serif", "📚 먼저 알아보기: 전쟁이 끝난 이유"));
    learnCard.appendChild(el("p", "muted", "순서를 배열하기 전에, 미국이 왜 참전했고 독일이 왜 휴전했는지 먼저 읽어 보세요."));
    const why = m.whyLearning;
    const whyGrid = el("div", "why-grid");
    const usa = el("div", "why-card");
    usa.appendChild(el("h5", null, why.usa.title));
    const ul1 = el("ul"); why.usa.points.forEach((p) => ul1.appendChild(el("li", null, esc(p)))); usa.appendChild(ul1);
    const de = el("div", "why-card de");
    de.appendChild(el("h5", null, why.germany.title));
    const ul2 = el("ul"); why.germany.points.forEach((p) => ul2.appendChild(el("li", null, esc(p)))); de.appendChild(ul2);
    whyGrid.appendChild(usa); whyGrid.appendChild(de);
    learnCard.appendChild(whyGrid);
    stage.appendChild(learnCard);

    const card = el("div", "card");
    card.appendChild(el("p", null, "전쟁이 끝나는 흐름이 뒤섞여 있습니다. 올바른 <b>시간·인과 순서</b>로 배열하세요."));
    const arrangement = state.solved.mission4
      ? m.causeCards.slice().sort((a, b) => a.order - b.order)
      : shuffle(m.causeCards);
    const orderer = tapOrderList(card, arrangement);

    card.appendChild(hintBlock(m));
    const actions = el("div", "actions");
    actions.appendChild(el("div", "spacer"));
    const submit = el("button", "btn btn-primary", "순서 확인하기");
    actions.appendChild(submit);
    card.appendChild(actions);
    const resultHost = el("div");
    card.appendChild(resultHost);

    function showReveal(scroll) {
      submit.disabled = true;
      orderer.lock();
      resultHost.innerHTML = "";
      resultHost.appendChild(revealPanel({
        verdict: "🎯 종전의 흐름을 정확히 배열했습니다!",
        cls: "correct",
        gained: state.scores.mission4,
        blocks: [{ h: "역사 해설", t: esc(m.explanation) }],
        caution: m.caution,
        prophecy: m.prophecy,
      }));
      resultHost.appendChild(nextButton("mission4"));
      if (scroll) resultHost.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (state.solved.mission4) showReveal(false);

    submit.addEventListener("click", () => {
      const ok = orderer.markResult();
      const totalN = m.causeCards.length;
      if (ok !== totalN) { toast(`${ok}/${totalN} 위치가 맞아요. 초록색은 맞고 빨간색은 자리를 옮겨 보세요.`); return; }
      state.solved.mission4 = true;
      state.scores.mission4 = scoreFor("mission4", 4);
      saveState();
      renderTopbar();
      showReveal(true);
    });

    stage.appendChild(card);
  }

  /* =======================================================================
     미션 5 — 베르사유 평가 (선택형 + 근거)
     ======================================================================= */
  function renderMission5() {
    const m = D.mission5;
    stage.appendChild(missionHeader(m));

    const evCard = el("div", "card");
    evCard.appendChild(el("h3", "serif", "📜 전후 국제 질서의 증거"));
    [m.evidence.germany, m.evidence.order].forEach((sec) => {
      evCard.appendChild(el("h4", null, esc(sec.title)));
      const grid = el("div", "evidence-grid");
      sec.items.forEach((x) => grid.appendChild(el("div", "evi", esc(x))));
      evCard.appendChild(grid);
    });
    stage.appendChild(evCard);

    const qCard = el("div", "card");
    qCard.appendChild(el("h3", "serif", "⚖️ 예언: 이 평화는 안정적일까?"));
    qCard.appendChild(el("p", "muted", "증거를 근거로 가장 타당한 예언을 고르고, 그렇게 생각한 이유를 적어 보세요."));

    const choiceList = el("div", "choice-list");
    let picked = null;
    m.choices.forEach((ch) => {
      const b = el("button", "choice", esc(ch.text));
      b.dataset.id = ch.id;
      b.addEventListener("click", () => {
        if (submit.disabled) return;
        picked = ch;
        choiceList.querySelectorAll(".choice").forEach((n) => n.classList.remove("selected"));
        b.classList.add("selected");
        saveAnswer("mission5", { choice: ch.id });
      });
      choiceList.appendChild(b);
    });
    qCard.appendChild(choiceList);

    const reason = el("div", "field");
    reason.appendChild(el("label", null, "✍️ 그렇게 예언한 근거 (한두 문장)"));
    const ta = el("textarea");
    ta.placeholder = "예: 독일에 큰 배상 부담이 남고, 미국이 국제연맹에 빠져서...";
    ta.addEventListener("input", () => saveAnswer("mission5", { reason: ta.value }));
    reason.appendChild(ta);
    qCard.appendChild(reason);

    qCard.appendChild(hintBlock(m));
    const actions = el("div", "actions");
    actions.appendChild(el("div", "spacer"));
    const submit = el("button", "btn btn-primary", "예언 제출하기");
    actions.appendChild(submit);
    qCard.appendChild(actions);
    const resultHost = el("div");
    qCard.appendChild(resultHost);

    function finalize5(scroll) {
      submit.disabled = true; ta.disabled = true;
      choiceList.querySelectorAll(".choice").forEach((n) => {
        const ch = m.choices.find((c) => c.id === n.dataset.id);
        n.classList.remove("selected");
        if (ch.correct) n.classList.add("correct");
        else if (n.dataset.id === picked.id) n.classList.add("wrong");
      });
      resultHost.innerHTML = "";
      resultHost.appendChild(revealPanel({
        verdict: picked.correct ? "🎯 가장 균형 잡힌 예언입니다!" : "🔎 예언 제출 완료 · 다른 관점도 살펴보세요",
        cls: picked.correct ? "correct" : "partial",
        gained: state.scores.mission5,
        blocks: [{ h: "역사 해설", t: esc(m.explanation) }],
        twoSides: m.twoSides,
        caution: m.caution,
        prophecy: m.prophecy,
      }));
      resultHost.appendChild(nextButton("mission5", "종합 활동으로 →"));
      if (scroll) resultHost.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const saved5 = getAnswer("mission5");
    if (typeof saved5.reason === "string") ta.value = saved5.reason;
    if (saved5.choice) {
      const ch = m.choices.find((c) => c.id === saved5.choice);
      const b = choiceList.querySelector(`.choice[data-id="${saved5.choice}"]`);
      if (ch && b) { picked = ch; b.classList.add("selected"); }
    }
    if (state.solved.mission5 && picked) finalize5(false);

    submit.addEventListener("click", () => {
      if (!picked) { toast("먼저 예언을 하나 선택하세요."); return; }
      if (ta.value.trim().length < 5) { toast("근거를 한 문장이라도 적어 주세요."); return; }
      state.solved.mission5 = true;
      const pickScore = picked.correct ? 2 : 1;
      const reasonScore = ta.value.trim().length >= 15 ? 2 : 1;
      state.scores.mission5 = scoreFor("mission5", pickScore + reasonScore);
      saveAnswer("mission5", { choice: picked.id, reason: ta.value });
      renderTopbar();
      finalize5(true);
    });

    stage.appendChild(qCard);
  }

  /* =======================================================================
     종합 활동 — 사건 배열 + 원인·결과 사슬(참여) + 최종 예언문
     ======================================================================= */
  function renderEpilogue() {
    const e = D.epilogue;

    const head = el("div", "card");
    head.appendChild(el("div", "mission-eyebrow", "📖 종합 활동"));
    head.appendChild(el("h1", "mission-title serif", esc(e.title)));
    head.appendChild(el("p", "mission-goal", "지금까지의 예언을 하나로 엮어 제1차 세계대전의 흐름을 완성하세요."));
    stage.appendChild(head);

    // 활동 1: 사건 시간순 배열 (탭 ▲▼)
    const tCard = el("div", "card");
    tCard.appendChild(el("h3", "serif", "① 사건 카드 시간순 배열"));
    tCard.appendChild(el("p", "muted", "아홉 개의 사건을 일어난 순서대로 배열하세요."));
    const tOrderer = tapOrderList(tCard, shuffle(e.timelineCards));
    const tActions = el("div", "actions");
    tActions.appendChild(el("div", "spacer"));
    const tCheck = el("button", "btn btn-gold", "순서 확인");
    tActions.appendChild(tCheck);
    tCard.appendChild(tActions);
    tCheck.addEventListener("click", () => {
      const ok = tOrderer.markResult();
      const n = e.timelineCards.length;
      if (ok === n) toast("완벽해요! 전쟁의 흐름을 모두 맞췄습니다 🎉");
      else toast(`${ok}/${n} 위치가 맞아요. 다시 정렬해 보세요.`);
    });
    stage.appendChild(tCard);

    // 활동 2: 원인과 결과 사슬 (학생 참여 — 탭 ▲▼)
    const cCard = el("div", "card");
    cCard.appendChild(el("h3", "serif", "② 원인과 결과의 사슬 잇기"));
    cCard.appendChild(el("p", "muted", esc(e.causalChain.intro)));
    const cOrderer = tapOrderList(cCard, shuffle(e.causalChain.cards));
    const cActions = el("div", "actions");
    cActions.appendChild(el("div", "spacer"));
    const cCheck = el("button", "btn btn-gold", "사슬 확인");
    cActions.appendChild(cCheck);
    cCard.appendChild(cActions);
    const cOut = el("div");
    cCard.appendChild(cOut);
    cCheck.addEventListener("click", () => {
      const ok = cOrderer.markResult();
      const n = e.causalChain.cards.length;
      cOut.innerHTML = "";
      if (ok === n) {
        cOrderer.lock();
        const done = el("div", "reveal correct");
        done.appendChild(el("div", "verdict", "🎯 원인과 결과의 사슬을 완성했습니다!"));
        const flow = e.causalChain.cards.slice().sort((a, b) => a.order - b.order).map((c) => c.text).join("  →  ");
        done.appendChild(el("div", "prophecy-line", flow));
        cOut.appendChild(done);
      } else {
        toast(`${ok}/${n} 칸이 맞아요. 초록색은 맞고 빨간색은 자리를 옮겨 보세요.`);
      }
    });
    stage.appendChild(cCard);

    // 활동 3: 최종 예언문
    const fCard = el("div", "card");
    fCard.appendChild(el("h3", "serif", "③ 최종 예언 보고서"));
    fCard.appendChild(el("p", "muted", "빈칸을 채워 나만의 예언 보고서를 완성하세요. 비워 두면 추천 답이 자동으로 들어갑니다."));

    const tmpl = e.finalTemplate;
    const parts = tmpl.text.split(/\{(\d+)\}/);
    const tmplWrap = el("div", "final-template serif");
    const fills = [];
    parts.forEach((p, i) => {
      if (i % 2 === 0) tmplWrap.appendChild(document.createTextNode(p));
      else {
        const idx = Number(p);
        const inp = el("input", "fill");
        inp.type = "text";
        inp.placeholder = tmpl.blanks[idx].hint;
        inp.dataset.suggest = tmpl.blanks[idx].suggest;
        inp.dataset.blankIdx = idx;
        const savedEp = getAnswer("epilogue");
        if (savedEp.blanks && typeof savedEp.blanks[idx] === "string") inp.value = savedEp.blanks[idx];
        inp.addEventListener("input", () => {
          const cur = getAnswer("epilogue").blanks || [];
          cur[idx] = inp.value;
          saveAnswer("epilogue", { blanks: cur });
        });
        fills.push(inp);
        tmplWrap.appendChild(inp);
      }
    });
    fCard.appendChild(tmplWrap);

    const fActions = el("div", "actions");
    const build = el("button", "btn btn-primary", "보고서 완성하기 →");
    fActions.appendChild(el("div", "spacer"));
    fActions.appendChild(build);
    fCard.appendChild(fActions);
    const out = el("div");
    fCard.appendChild(out);

    build.addEventListener("click", () => {
      const raws = fills.map((f) => f.value.trim());
      const swapGroups = tmpl.swapGroups || [];
      // 채점: accept 키워드 포함 여부. swapGroups는 그룹 내 답을 모아 필요한 키워드가 모두 채워졌는지로 판정.
      const results = raws.map((raw, i) => {
        const blank = tmpl.blanks[i];
        const accept = blank.accept || [blank.suggest];
        const ok = raw.length > 0 && accept.some((w) => raw.includes(w));
        return { raw, ok, blank };
      });
      // swapGroups 보정: 그룹 내 칸들이 '서로 바뀌어도' 모두 정답이 되도록,
      // 그룹에 필요한 정답 키워드 집합이 그룹 입력들로 모두 충족되면 그룹 전체를 정답 처리.
      swapGroups.forEach((group) => {
        const need = group.map((gi) => tmpl.blanks[gi].suggest); // 예: ["참호전","총력전"]
        const groupInputs = group.map((gi) => raws[gi]);
        const covered = need.every((word) => {
          const core = word.replace("전", ""); // "참호","총력"
          return groupInputs.some((v) => v.includes(core));
        });
        if (covered) group.forEach((gi) => (results[gi].ok = true));
      });

      let text = tmpl.text;
      results.forEach((r, i) => { text = text.replace(`{${i}}`, r.ok && r.raw ? r.raw : r.blank.suggest); });
      fills.forEach((f, i) => { f.classList.remove("ok-fill", "wrong-fill"); f.classList.add(results[i].ok ? "ok-fill" : "wrong-fill"); });

      out.innerHTML = "";
      const correctCount = results.filter((r) => r.ok).length;
      const report = el("div", "report-out");
      report.textContent = "🕯️ 전쟁 예언자의 최종 보고서\n\n" + text + "\n\n— " + e.coreMessage;
      out.appendChild(report);
      out.appendChild(el("p", null, `<b>${correctCount}/${results.length}</b> 칸을 스스로 맞혔어요.`));

      const wrong = results.filter((r) => !r.ok);
      if (wrong.length > 0) {
        const fix = el("div", "answer-fix");
        fix.appendChild(el("div", null, "📌 아래 칸은 이렇게 채우면 정확해요:"));
        const ul = el("ul"); ul.style.margin = "8px 0 0";
        results.forEach((r) => {
          if (!r.ok) {
            const yours = r.raw.length ? `내 답: “${esc(r.raw)}”` : "내 답: (비어 있음)";
            ul.appendChild(el("li", null, `<b>${esc(r.blank.hint)}</b> → 정답 예시: <b>${esc(r.blank.suggest)}</b> <span class="tiny muted">(${yours})</span>`));
          }
        });
        fix.appendChild(ul);
        out.appendChild(fix);
      } else {
        out.appendChild(el("div", "answer-fix", "🎉 모든 칸을 정확히 채웠습니다. 완벽한 예언 보고서예요!"));
      }
      out.appendChild(nextButton("epilogue", "예언 결과 확인하기 →"));
      out.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    stage.appendChild(fCard);
  }

  /* =======================================================================
     결과 화면
     ======================================================================= */
  function renderResult() {
    const total = totalScore();
    let rank, medal, comment;
    if (total >= 18) { rank = "위대한 전쟁 예언자"; medal = "🏆"; comment = "증거를 꿰뚫어 전쟁의 흐름을 완벽히 읽어냈습니다."; }
    else if (total >= 14) { rank = "뛰어난 예언자"; medal = "🥇"; comment = "핵심 흐름을 정확히 파악했습니다. 몇몇 근거만 더 다듬어 보세요."; }
    else if (total >= 10) { rank = "성실한 예언자"; medal = "🥈"; comment = "큰 줄기를 잘 잡았습니다. 놓친 단서를 다시 살펴보면 좋아요."; }
    else { rank = "견습 예언자"; medal = "🥉"; comment = "흐름을 다시 짚어 보며 예언에 도전해 보세요. 반복할수록 강해집니다."; }

    const hero = el("div", "card result-hero");
    hero.appendChild(el("div", "medal", medal));
    hero.appendChild(el("h1", "serif", "예언 완료!"));
    hero.appendChild(el("div", "rank-line", rank));
    hero.appendChild(el("div", "score-big", total + " / 20"));
    hero.appendChild(el("p", "muted", esc(comment)));
    stage.appendChild(hero);

    const tbl = el("div", "card");
    tbl.appendChild(el("h3", "serif", "🗂️ 미션별 예언 기록"));
    MISSION_KEYS.forEach((mk) => {
      const m = D[mk];
      const sc = state.scores[mk] || 0;
      const used = state.hintsUsed[mk] || 0;
      const row = el("div", "evi");
      row.style.marginTop = "8px";
      row.innerHTML = `<b>미션 ${m.order} · ${esc(m.name)}</b> — ${sc}/4점 <span class="tiny muted">(힌트 ${used}회 사용)</span>`;
      tbl.appendChild(row);
    });
    tbl.appendChild(el("div", "prophecy-line", "『핵심 메시지』 " + esc(D.epilogue.coreMessage)));
    stage.appendChild(tbl);

    const actions = el("div", "actions");
    const again = el("button", "btn btn-ghost", "처음부터 다시 예언하기 ↺");
    again.addEventListener("click", () => { clearStore(); go("prologue"); });
    const review = el("button", "btn btn-primary", "미션 1부터 다시 보기");
    review.addEventListener("click", () => go("mission1"));
    actions.appendChild(again);
    actions.appendChild(el("div", "spacer"));
    actions.appendChild(review);
    stage.appendChild(actions);
  }

  // ---------- 시작 ----------
  loadState();
  go("prologue");
})();
