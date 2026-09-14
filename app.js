/* =========================================================================
   전쟁 예언자 — 앱 로직
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

  // 미션 4점 * 5 = 20점
  const MISSION_KEYS = ["mission1", "mission2", "mission3", "mission4", "mission5"];
  const SCREENS = ["prologue", ...MISSION_KEYS, "epilogue", "result"];

  // 진행 상태
  const state = {
    current: "prologue",
    scores: {},          // { mission1: 4, ... }  각 미션 획득 점수
    hintsUsed: {},       // { mission1: 2, ... }
    solved: {},          // { mission1: true }
    answers: {},         // { mission2: { who:"..." }, ... }  학생이 입력/선택한 답안
  };

  // ---------- localStorage 저장/복원 ----------
  // 학생 노트북 브라우저 안에만 저장됩니다(서버 전송 없음).
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
    } catch (e) {
      /* 시크릿 모드 등 저장 불가 환경은 조용히 무시 */
    }
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
    } catch (e) {
      /* 손상된 데이터면 무시하고 새로 시작 */
    }
  }

  function clearStore() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    state.scores = {};
    state.hintsUsed = {};
    state.solved = {};
    state.answers = {};
  }

  // 특정 미션의 답안 저장/조회
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
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }
  function totalScore() {
    return Object.values(state.scores).reduce((a, b) => a + b, 0);
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // ---------- 상단 진행 표시 ----------
  function renderTopbar() {
    if (state.current === "prologue") {
      topbar.hidden = true;
      return;
    }
    topbar.hidden = false;
    stepNav.innerHTML = "";
    MISSION_KEYS.forEach((mk, i) => {
      const dot = el("button", "step-dot");
      dot.textContent = i + 1;
      if (state.solved[mk]) dot.classList.add("done");
      if (state.current === mk) dot.classList.add("current");
      // 이미 푼 미션이나 바로 다음 미션까지만 이동 허용
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
  function nextScreen(cur) {
    return SCREENS[SCREENS.indexOf(cur) + 1];
  }

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
    // 이미 쓴 힌트 복원
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
      if (shown >= m.hints.length) {
        btn.disabled = true;
        btn.textContent = "힌트를 모두 열었어요";
      } else {
        btn.textContent = `힌트 열기 (${shown}/${m.hints.length}) →`;
      }
    }
    return box;
  }

  // ---------- 공통: 점수 계산 (힌트당 -1, 최소 1점) ----------
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

  // ---------- 공통: 다음으로 버튼 ----------
  function nextButton(cur, label) {
    const wrap = el("div", "actions");
    wrap.appendChild(el("div", "spacer"));
    const btn = el("button", "btn btn-primary", label || "다음 미션으로 →");
    btn.addEventListener("click", () => go(nextScreen(cur)));
    wrap.appendChild(btn);
    return wrap;
  }

  /* =======================================================================
     프롤로그
     ======================================================================= */
  function renderPrologue() {
    const p = D.prologue;
    const hero = el("div", "card hero");
    hero.appendChild(el("div", "seal", "🕯️"));
    hero.appendChild(el("div", "subtitle", "제1차 세계대전 · 세계사 탐구"));
    hero.appendChild(el("h1", "serif", "전쟁 예언자"));
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
      // 이어서: 아직 풀지 않은 첫 미션으로 (모두 풀었으면 종합 활동)
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
     미션 1 — 지도 & 국가 분류 (드래그 앤 드롭)
     ======================================================================= */
  function renderMission1() {
    const m = D.mission1;
    stage.appendChild(missionHeader(m));

    const card = el("div", "card");
    card.appendChild(el("p", null, "아래 여섯 나라의 특징을 읽고, <b>두 진영</b>으로 나누어 보세요. 카드를 아래의 두 상자로 끌어다 놓으면 됩니다."));

    const layout = el("div", "m1-layout");
    // 유럽 SVG 지도 + 국가 이름 핀
    const mapWrap = el("div", "map-wrap");
    mapWrap.innerHTML = MAPS.europe();
    m.countries.forEach((c) => {
      const pin = el("div", "map-pin");
      pin.dataset.id = c.id;
      pin.style.left = c.pos.x + "%";
      pin.style.top = c.pos.y + "%";
      pin.innerHTML = `<div class="dot">${c.emoji}</div><div class="tag">${esc(c.name)}</div>`;
      mapWrap.appendChild(pin);
    });
    const mapCol = el("div");
    mapCol.appendChild(mapWrap);
    mapCol.appendChild(el("p", "tiny muted", "🗺️ 국가를 분류하면 지도의 나라 영역이 진영 색으로 칠해집니다. (학습용 개략 지도)"));
    // 지도 범례
    const legend = el("div", "legend");
    legend.innerHTML =
      '<span><i style="background:#e2a19a"></i>진영 A</span>' +
      '<span><i style="background:#9db8dc"></i>진영 B</span>' +
      '<span><i style="background:#e6dcc0"></i>미분류</span>';
    mapCol.appendChild(legend);
    layout.appendChild(mapCol);

    // 국가 카드 풀
    const pool = el("div", "country-pool");
    pool.appendChild(el("p", "pool-hint", "🖱️ 국가 카드를 아래 두 상자 중 하나로 끌어 놓으세요."));
    const source = el("div", "pool-source dz-items");
    source.dataset.zone = "source";
    shuffle(m.countries).forEach((c) => source.appendChild(countryCard(c)));
    pool.appendChild(source);
    layout.appendChild(pool);
    card.appendChild(layout);

    // 드롭 존
    const zones = el("div", "dropzones");
    ["alliance", "entente"].forEach((g) => {
      const dz = el("div", "dropzone " + g);
      dz.dataset.zone = g;
      dz.appendChild(el("h4", null, (g === "alliance" ? "🔴 " : "🔵 ") + "?  진영 " + (g === "alliance" ? "A" : "B")));
      const items = el("div", "dz-items");
      items.dataset.zone = g;
      dz.appendChild(items);
      zones.appendChild(dz);
    });
    card.appendChild(el("hr", "soft"));
    card.appendChild(zones);

    // 드래그 로직
    enableDragDrop(card, () => updateM1Pins(card));

    card.appendChild(hintBlock(m));

    const actions = el("div", "actions");
    const check = el("button", "btn btn-primary", "이 분류로 예언하기");
    actions.appendChild(el("div", "spacer"));
    actions.appendChild(check);
    card.appendChild(actions);

    const resultHost = el("div");
    card.appendChild(resultHost);

    // 저장된 답안 복원: 각 국가를 저장된 진영 상자로 이동
    function placeCountry(id, zone) {
      const cardNode = card.querySelector(`.country-card[data-id="${id}"]`);
      const target = card.querySelector(`.dz-items[data-zone="${zone}"]`);
      if (cardNode && target) target.appendChild(cardNode);
    }
    function showM1Reveal() {
      const nameOf = (id) => m.countries.find((c) => c.id === id).name;
      resultHost.innerHTML = "";
      resultHost.appendChild(
        revealPanel({
          verdict: "🎯 정확한 분류입니다!",
          cls: "correct",
          gained: state.scores.mission1,
          blocks: [
            { h: "삼국동맹", t: m.answer.alliance.map(nameOf).join(", ") },
            { h: "삼국협상", t: m.answer.entente.map(nameOf).join(", ") },
          ],
          caution: m.caution,
          prophecy: m.prophecy,
        })
      );
      resultHost.appendChild(nextButton("mission1"));
    }

    const saved1 = getAnswer("mission1");
    if (state.solved.mission1 && saved1.alliance && saved1.entente) {
      saved1.alliance.forEach((id) => placeCountry(id, "alliance"));
      saved1.entente.forEach((id) => placeCountry(id, "entente"));
      updateM1Pins(card);
      check.disabled = true;
      showM1Reveal();
    }

    check.addEventListener("click", () => {
      const alliance = [...card.querySelectorAll('[data-zone="alliance"] .country-card')].map((n) => n.dataset.id);
      const entente = [...card.querySelectorAll('[data-zone="entente"] .country-card')].map((n) => n.dataset.id);
      if (alliance.length + entente.length < m.countries.length) {
        toast("아직 분류하지 않은 국가가 있어요.");
        return;
      }
      const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
      const correct =
        (same(alliance, m.answer.alliance) && same(entente, m.answer.entente)) ||
        (same(alliance, m.answer.entente) && same(entente, m.answer.alliance));

      if (!correct) {
        toast("두 진영이 완전히 맞지는 않아요. 힌트를 참고해 다시 나눠 보세요.");
        return;
      }
      check.disabled = true;
      state.solved.mission1 = true;
      const gained = scoreFor("mission1", 4);
      state.scores.mission1 = gained;
      // 정답 기준으로 저장(복원 시 항상 올바르게 배치)
      saveAnswer("mission1", { alliance: m.answer.alliance, entente: m.answer.entente });
      renderTopbar();
      showM1Reveal();
      resultHost.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    stage.appendChild(card);

    function countryCard(c) {
      const node = el("div", "country-card");
      node.draggable = true;
      node.dataset.id = c.id;
      node.innerHTML =
        `<h4>${c.emoji} ${esc(c.name)}</h4><ul>${c.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`;
      return node;
    }
  }

  function updateM1Pins(card) {
    const m = D.mission1;
    // card 하위에서 찾되, 아직 stage에 붙기 전(복원 시)에도 동작하도록 card 우선 탐색
    const scope = card || stage;
    m.countries.forEach((c) => {
      const pin = scope.querySelector(`.map-pin[data-id="${c.id}"]`);
      const land = scope.querySelector(`.geo-map .land[data-country="${c.id}"]`);
      if (pin) pin.classList.remove("alliance", "entente");
      if (land) land.classList.remove("alliance", "entente");
      const inZone = card.querySelector(`.dz-items[data-zone] .country-card[data-id="${c.id}"]`);
      if (inZone) {
        const z = inZone.closest("[data-zone]").dataset.zone;
        if (z === "alliance" || z === "entente") {
          if (pin) pin.classList.add(z);
          if (land) land.classList.add(z);
        }
      }
    });
  }

  // 범용 드래그앤드롭 (카드 <-> 존)
  function enableDragDrop(root, onChange) {
    let dragEl = null;
    root.addEventListener("dragstart", (e) => {
      const t = e.target.closest("[draggable]");
      if (!t) return;
      dragEl = t;
      t.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    root.addEventListener("dragend", () => {
      if (dragEl) dragEl.classList.remove("dragging");
      dragEl = null;
      root.querySelectorAll(".over").forEach((z) => z.classList.remove("over"));
    });
    root.querySelectorAll("[data-zone]").forEach((zone) => {
      const target = zone.classList.contains("dz-items") ? zone : zone.querySelector(".dz-items") || zone;
      zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("over"));
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("over");
        if (dragEl) {
          target.appendChild(dragEl);
          if (onChange) onChange();
        }
      });
    });
  }

  /* =======================================================================
     미션 2 — 사라예보 사건 예언 (단계 힌트 + 예언 틀)
     ======================================================================= */
  function renderMission2() {
    const m = D.mission2;
    stage.appendChild(missionHeader(m));

    // ---- 프로파일러 보드: 지도 + 단계별 단서 ----
    const boardCard = el("div", "card");
    boardCard.appendChild(el("h3", "serif", "🕵️ 사건 프로파일링 보드"));
    boardCard.appendChild(el("p", "muted", "실마리를 한 단계씩 열 때마다 지도의 관련 지역이 강조됩니다. 흐름을 정리하며 다음에 벌어질 사건을 추리하세요."));

    const profiler = el("div", "profiler");

    // 왼쪽: 발칸 지도
    const mapCol = el("div");
    const balkanWrap = el("div", "balkan-map-wrap");
    balkanWrap.innerHTML = MAPS.balkans();
    mapCol.appendChild(balkanWrap);
    const legend = el("div", "legend");
    legend.innerHTML =
      '<span><i style="background:#d9c48f"></i>오스트리아-헝가리</span>' +
      '<span><i style="background:#e7b98c"></i>보스니아</span>' +
      '<span><i style="background:#cdb0d4"></i>세르비아</span>' +
      '<span><i style="background:#b9d0a6"></i>오스만 제국</span>';
    mapCol.appendChild(legend);
    profiler.appendChild(mapCol);

    // 오른쪽: 단서 트랙
    const clueCol = el("div");
    const clueTrack = el("div", "clue-track");
    clueCol.appendChild(clueTrack);
    const openBtn = el("button", "btn btn-gold", "첫 번째 단서 열기 →");
    const br = el("div", "actions"); br.appendChild(openBtn);
    clueCol.appendChild(br);
    profiler.appendChild(clueCol);
    boardCard.appendChild(profiler);
    stage.appendChild(boardCard);

    function clearHighlights() {
      boardCard.querySelectorAll(".geo-map.balkans .region.highlight").forEach((r) => r.classList.remove("highlight"));
    }
    function highlight(regions) {
      (regions || []).forEach((rg) => {
        const node = boardCard.querySelector(`.geo-map.balkans .region[data-region="${rg}"]`);
        if (node) node.classList.add("highlight");
      });
    }

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
      clearHighlights();
      highlight(s.highlight);
      opened++;
      if (opened >= m.clueStages.length) {
        openBtn.disabled = true;
        openBtn.textContent = "모든 단서를 확인했어요";
      } else {
        openBtn.textContent = `다음 단서 열기 (${opened}/${m.clueStages.length}) →`;
      }
    }
    openBtn.addEventListener("click", renderStage);
    renderStage(); // 첫 단계 자동 공개

    // ---- 프로파일러 지목: 표적 인물 찾기 ----
    const culCard = el("div", "card");
    culCard.appendChild(el("h3", "serif", "🎯 프로파일러의 지목"));
    culCard.appendChild(el("p", "muted", esc(m.culprit.question)));
    const cList = el("div", "choice-list");
    let pickedCulprit = null;
    m.culprit.options.forEach((o) => {
      const b = el("button", "choice", esc(o.text));
      b.dataset.id = o.id;
      b.addEventListener("click", () => {
        if (pickedCulprit && pickedCulprit.locked) return;
        cList.querySelectorAll(".choice").forEach((n) => n.classList.remove("selected"));
        b.classList.add("selected");
        pickedCulprit = o;
        saveAnswer("mission2", { culprit: o.id });
      });
      cList.appendChild(b);
    });
    culCard.appendChild(cList);
    stage.appendChild(culCard);

    // ---- 예언 기록장 ----
    const predCard = el("div", "card");
    predCard.appendChild(el("h3", "serif", "✍️ 나의 예언 기록장"));
    predCard.appendChild(el("p", "muted", "지금까지 정리한 흐름을 종합해 다음 칸을 채워 예언을 완성하세요."));
    const grid = el("div", "slot-grid");
    const inputs = {};
    m.predictionSlots.forEach((s) => {
      const slot = el("div", "slot");
      slot.appendChild(el("label", null, esc(s.label)));
      const inp = el("input");
      inp.type = "text";
      inp.placeholder = s.placeholder;
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

    // 채점 + 결과 표시 (제출/복원 공용)
    function finalize(scroll) {
      pickedCulprit.locked = true;
      submit.disabled = true;
      inputs && Object.values(inputs).forEach((i) => (i.disabled = true));

      cList.querySelectorAll(".choice").forEach((n) => {
        const o = m.culprit.options.find((x) => x.id === n.dataset.id);
        n.classList.remove("selected");
        if (o.correct) n.classList.add("correct");
        else if (n.dataset.id === pickedCulprit.id) n.classList.add("wrong");
      });

      const vals = {};
      Object.keys(inputs).forEach((k) => (vals[k] = inputs[k].value.trim()));
      let hit = 0;
      Object.keys(m.keywords).forEach((k) => {
        if (m.keywords[k].some((w) => vals[k].includes(w))) hit++;
      });
      const total = Object.keys(m.keywords).length;

      const spark = boardCard.querySelector(".geo-map.balkans .spark");
      const cityLbl = boardCard.querySelector(".geo-map.balkans .city-label");
      if (spark) spark.classList.add("show");
      if (cityLbl) cityLbl.classList.add("show");
      clearHighlights();
      highlight(["bosnia"]);

      const matched = pickedCulprit.correct && hit === total;
      resultHost.innerHTML = "";
      resultHost.appendChild(
        revealPanel({
          verdict: matched
            ? "🎯 사라예보 사건을 정확히 예언했습니다!"
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
        })
      );
      resultHost.appendChild(nextButton("mission2"));
      if (scroll) resultHost.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // 저장된 답안 복원
    const saved2 = getAnswer("mission2");
    if (saved2.culprit) {
      const o = m.culprit.options.find((x) => x.id === saved2.culprit);
      const b = cList.querySelector(`.choice[data-id="${saved2.culprit}"]`);
      if (o && b) { pickedCulprit = o; b.classList.add("selected"); }
    }
    Object.keys(inputs).forEach((k) => {
      if (typeof saved2[k] === "string") inputs[k].value = saved2[k];
    });
    if (state.solved.mission2 && pickedCulprit) {
      finalize(false);
    }

    submit.addEventListener("click", () => {
      if (!pickedCulprit) {
        toast("먼저 위쪽 '프로파일러의 지목'에서 표적 인물을 골라 주세요.");
        return;
      }
      const vals = {};
      Object.keys(inputs).forEach((k) => (vals[k] = inputs[k].value.trim()));
      if (Object.values(vals).some((v) => v.length === 0)) {
        toast("예언 기록장 네 칸을 모두 채워야 제출할 수 있어요.");
        return;
      }

      // 채점하여 점수 저장
      let hit = 0;
      Object.keys(m.keywords).forEach((k) => {
        if (m.keywords[k].some((w) => vals[k].includes(w))) hit++;
      });
      const total = Object.keys(m.keywords).length;
      state.solved.mission2 = true;
      const culpritScore = pickedCulprit.correct ? 1 : 0;
      const predScore = Math.round((hit / total) * 3);
      const base = Math.max(2, culpritScore + predScore);
      state.scores.mission2 = scoreFor("mission2", base);
      saveAnswer("mission2", { culprit: pickedCulprit.id });
      renderTopbar();
      finalize(true);
    });

    stage.appendChild(predCard);
  }

  /* =======================================================================
     미션 3 — 증거 분류 + 핵심어 찾기
     ======================================================================= */
  function renderMission3() {
    const m = D.mission3;
    stage.appendChild(missionHeader(m));

    const card = el("div", "card");
    card.appendChild(el("p", null, "전쟁의 여러 모습을 <b>두 범주</b>로 나눈 뒤, 이 전쟁을 대표하는 <b>두 개의 키워드</b>를 찾아내세요."));

    const source = el("div", "sort-pool dz-items");
    source.dataset.zone = "source";
    shuffle(m.evidence).forEach((ev) => source.appendChild(eviChip(ev)));
    card.appendChild(source);
    card.appendChild(el("hr", "soft"));

    const cats = el("div", "sort-cats");
    Object.keys(m.categories).forEach((cat) => {
      const c = m.categories[cat];
      const dz = el("div", "dropzone");
      dz.dataset.zone = cat;
      dz.appendChild(el("h4", null, c.icon + " " + esc(c.label)));
      const items = el("div", "dz-items");
      items.dataset.zone = cat;
      dz.appendChild(items);
      cats.appendChild(dz);
    });
    card.appendChild(cats);
    enableDragDrop(card, null);

    // 키워드 입력
    card.appendChild(el("hr", "soft"));
    const kf = el("div", "field");
    kf.appendChild(el("label", null, "🗝️ 이 전쟁을 대표하는 두 키워드는?"));
    kf.appendChild(el("p", "tiny muted",
      "힌트: 첫 번째는 병사들이 땅을 파고 버티는 도랑 '참호'와 관련된 '참□전', " +
      "두 번째는 나라의 모든 힘을 쏟는 '총□전'입니다."));
    const krow = el("div", "keyword-row");
    const k1 = el("input"); k1.type = "text"; k1.placeholder = "참 □ 전 (땅을 파고 대치)";
    const k2 = el("input"); k2.type = "text"; k2.placeholder = "총 □ 전 (나라 전체를 동원)";
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

    function showM3Reveal(scroll) {
      const saved = getAnswer("mission3");
      const sortOk = typeof saved.sortOk === "number" ? saved.sortOk : m.evidence.length;
      submit.disabled = true;
      k1.disabled = true; k2.disabled = true;
      resultHost.innerHTML = "";
      resultHost.appendChild(
        revealPanel({
          verdict: `🎯 두 키워드를 찾았습니다! (분류 정확도 ${sortOk}/${m.evidence.length})`,
          cls: "correct",
          gained: state.scores.mission3,
          blocks: [
            { h: "참호전", t: esc(m.concepts["참호전"]) },
            { h: "총력전", t: esc(m.concepts["총력전"]) },
          ],
          caution: m.caution,
          prophecy: m.prophecy,
        })
      );
      resultHost.appendChild(nextButton("mission3"));
      if (scroll) resultHost.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // 저장된 답안 복원
    const saved3 = getAnswer("mission3");
    if (typeof saved3.k1 === "string") k1.value = saved3.k1;
    if (typeof saved3.k2 === "string") k2.value = saved3.k2;
    if (state.solved.mission3) showM3Reveal(false);

    submit.addEventListener("click", () => {
      // 분류 채점
      let sortOk = 0;
      m.evidence.forEach((ev) => {
        const node = card.querySelector(`.chip[data-id="${ev.id}"]`);
        const z = node.closest("[data-zone]").dataset.zone;
        if (z === ev.cat) sortOk++;
      });
      const allSorted = card.querySelector('[data-zone="source"]').children.length === 0;
      if (!allSorted) { toast("아직 분류하지 않은 카드가 있어요."); return; }

      // 키워드 채점
      const answers = [k1.value.trim(), k2.value.trim()];
      const found = m.keywordTargets.map((t) => answers.some((a) => t.accept.some((w) => a.includes(w))));
      const keyHit = found.filter(Boolean).length;

      if (keyHit < 2) {
        toast("두 키워드를 아직 다 찾지 못했어요. 힌트를 참고해 보세요.");
        return;
      }
      state.solved.mission3 = true;
      // 4점: 키워드 2점 + 분류 정확도 2점
      const sortScore = sortOk === m.evidence.length ? 2 : sortOk >= m.evidence.length - 2 ? 1 : 0;
      const base = 2 + sortScore;
      state.scores.mission3 = scoreFor("mission3", base);
      saveAnswer("mission3", { sortOk: sortOk });
      renderTopbar();
      showM3Reveal(true);
    });

    stage.appendChild(card);

    function eviChip(ev) {
      const chip = el("div", "chip");
      chip.draggable = true;
      chip.dataset.id = ev.id;
      chip.innerHTML = `<span>${esc(ev.text)}</span>`;
      return chip;
    }
  }

  /* =======================================================================
     미션 4 — 인과 카드 순서 배열
     ======================================================================= */
  function renderMission4() {
    const m = D.mission4;
    stage.appendChild(missionHeader(m));

    // ---- 학습 카드: 미국은 왜 참전했고, 독일은 왜 휴전했나 ----
    const learnCard = el("div", "card");
    learnCard.appendChild(el("h3", "serif", "📚 먼저 알아보기: 전쟁이 끝난 이유"));
    learnCard.appendChild(el("p", "muted", "순서를 배열하기 전에, 미국이 왜 참전했고 독일이 왜 휴전했는지 먼저 읽어 보세요."));
    const why = D.mission4.whyLearning;
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
    card.appendChild(el("p", null, "이제 전쟁이 끝나는 흐름이 뒤섞여 있습니다. 카드를 끌어 올바른 <b>시간·인과 순서</b>로 배열하세요."));

    const list = el("div", "order-list");
    // 이미 완료한 경우 정답 순서로 표시, 아니면 섞어서 표시
    const arrangement = state.solved.mission4
      ? m.causeCards.slice().sort((a, b) => a.order - b.order)
      : shuffle(m.causeCards);
    arrangement.forEach((c) => list.appendChild(orderItem(c)));
    card.appendChild(list);
    enableSortList(list);

    card.appendChild(hintBlock(m));

    const actions = el("div", "actions");
    actions.appendChild(el("div", "spacer"));
    const submit = el("button", "btn btn-primary", "순서 확인하기");
    actions.appendChild(submit);
    card.appendChild(actions);
    const resultHost = el("div");
    card.appendChild(resultHost);

    function showM4Reveal(scroll) {
      const nodes = [...list.querySelectorAll(".order-item")];
      nodes.forEach((n, i) => { n.classList.add("ok"); n.draggable = false; n.querySelector(".num").textContent = i + 1; });
      submit.disabled = true;
      resultHost.innerHTML = "";
      resultHost.appendChild(
        revealPanel({
          verdict: "🎯 종전의 흐름을 정확히 배열했습니다!",
          cls: "correct",
          gained: state.scores.mission4,
          blocks: [{ h: "역사 해설", t: esc(m.explanation) }],
          caution: m.caution,
          prophecy: m.prophecy,
        })
      );
      resultHost.appendChild(nextButton("mission4"));
      if (scroll) resultHost.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (state.solved.mission4) showM4Reveal(false);

    submit.addEventListener("click", () => {
      const nodes = [...list.querySelectorAll(".order-item")];
      let ok = 0;
      nodes.forEach((n, i) => {
        const correct = Number(n.dataset.order) === i + 1;
        n.classList.toggle("ok", correct);
        n.classList.toggle("bad", !correct);
        n.querySelector(".num").textContent = i + 1;
        if (correct) ok++;
      });
      if (ok !== nodes.length) {
        toast(`${ok}/${nodes.length} 위치가 맞아요. 초록색은 맞고 빨간색은 자리를 옮겨 보세요.`);
        return;
      }
      state.solved.mission4 = true;
      state.scores.mission4 = scoreFor("mission4", 4);
      saveState();
      renderTopbar();
      showM4Reveal(true);
    });

    stage.appendChild(card);

    function orderItem(c) {
      const it = el("div", "order-item");
      it.draggable = true;
      it.dataset.order = c.order;
      it.innerHTML = `<span class="num">·</span><span class="txt">${esc(c.text)}</span><span class="grip">⋮⋮</span>`;
      return it;
    }
  }

  // 리스트 내부 순서 재배열 드래그
  function enableSortList(list) {
    let dragEl = null;
    list.addEventListener("dragstart", (e) => {
      dragEl = e.target.closest(".order-item");
      if (dragEl) dragEl.classList.add("dragging");
    });
    list.addEventListener("dragend", () => {
      if (dragEl) { dragEl.classList.remove("dragging"); dragEl = null; }
    });
    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      const after = getAfter(list, e.clientY);
      if (!dragEl) return;
      if (after == null) list.appendChild(dragEl);
      else list.insertBefore(dragEl, after);
    });
    function getAfter(container, y) {
      const items = [...container.querySelectorAll(".order-item:not(.dragging)")];
      return items.reduce(
        (closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) return { offset, element: child };
          return closest;
        },
        { offset: -Infinity, element: null }
      ).element;
    }
  }

  /* =======================================================================
     미션 5 — 베르사유 체제 평가 (선택형 + 양면 제시)
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
      submit.disabled = true;
      ta.disabled = true;
      choiceList.querySelectorAll(".choice").forEach((n) => {
        const ch = m.choices.find((c) => c.id === n.dataset.id);
        n.classList.remove("selected");
        if (ch.correct) n.classList.add("correct");
        else if (n.dataset.id === picked.id) n.classList.add("wrong");
      });
      resultHost.innerHTML = "";
      resultHost.appendChild(
        revealPanel({
          verdict: picked.correct ? "🎯 가장 균형 잡힌 예언입니다!" : "🔎 예언 제출 완료 · 다른 관점도 살펴보세요",
          cls: picked.correct ? "correct" : "partial",
          gained: state.scores.mission5,
          blocks: [{ h: "역사 해설", t: esc(m.explanation) }],
          twoSides: m.twoSides,
          caution: m.caution,
          prophecy: m.prophecy,
        })
      );
      resultHost.appendChild(nextButton("mission5", "종합 활동으로 →"));
      if (scroll) resultHost.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // 저장된 답안 복원
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
      const base = pickScore + reasonScore;
      state.scores.mission5 = scoreFor("mission5", base);
      saveAnswer("mission5", { choice: picked.id, reason: ta.value });
      renderTopbar();
      finalize5(true);
    });

    stage.appendChild(qCard);
  }

  /* =======================================================================
     종합 활동 — 사건 배열 + 최종 예언문
     ======================================================================= */
  function renderEpilogue() {
    const e = D.epilogue;

    const head = el("div", "card");
    head.appendChild(el("div", "mission-eyebrow", "📖 종합 활동"));
    head.appendChild(el("h1", "mission-title serif", esc(e.title)));
    head.appendChild(el("p", "mission-goal", "지금까지의 예언을 하나로 엮어 제1차 세계대전의 흐름을 완성하세요."));
    stage.appendChild(head);

    // 활동 1: 사건 시간순 배열
    const tCard = el("div", "card");
    tCard.appendChild(el("h3", "serif", "① 사건 카드 시간순 배열"));
    tCard.appendChild(el("p", "muted", "아홉 개의 사건을 일어난 순서대로 배열하세요."));
    const tList = el("div", "order-list");
    shuffle(e.timelineCards).forEach((c) => {
      const it = el("div", "order-item");
      it.draggable = true;
      it.dataset.order = c.order;
      it.innerHTML = `<span class="num">·</span><span class="txt">${esc(c.text)}</span><span class="grip">⋮⋮</span>`;
      tList.appendChild(it);
    });
    tCard.appendChild(tList);
    enableSortList(tList);
    const tActions = el("div", "actions");
    tActions.appendChild(el("div", "spacer"));
    const tCheck = el("button", "btn btn-gold", "순서 확인");
    tActions.appendChild(tCheck);
    tCard.appendChild(tActions);
    tCheck.addEventListener("click", () => {
      const nodes = [...tList.querySelectorAll(".order-item")];
      let ok = 0;
      nodes.forEach((n, i) => {
        const correct = Number(n.dataset.order) === i + 1;
        n.classList.toggle("ok", correct);
        n.classList.toggle("bad", !correct);
        n.querySelector(".num").textContent = i + 1;
        if (correct) ok++;
      });
      if (ok === nodes.length) toast("완벽해요! 전쟁의 흐름을 모두 맞췄습니다 🎉");
      else toast(`${ok}/${nodes.length} 위치가 맞아요. 다시 정렬해 보세요.`);
    });
    stage.appendChild(tCard);

    // 활동 2: 인과 연결 (읽기 자료)
    const cCard = el("div", "card");
    cCard.appendChild(el("h3", "serif", "② 원인과 결과의 사슬"));
    const chain = [
      "동맹 대립과 민족주의",
      "한 지역의 분쟁이 국제전으로 확대",
      "전쟁 장기화",
      "총력전과 민간인 동원",
      "사회·경제적 피로 누적",
      "미국 참전과 동맹국 붕괴",
      "전쟁 종결",
      "불안정한 평화",
    ];
    const chainWrap = el("div", "evidence-grid");
    chain.forEach((c, i) => {
      const box = el("div", "evi");
      box.innerHTML = `${i + 1}. ${esc(c)} ${i < chain.length - 1 ? "⬇️" : "🏁"}`;
      chainWrap.appendChild(box);
    });
    cCard.appendChild(chainWrap);
    stage.appendChild(cCard);

    // 활동 3: 최종 예언문
    const fCard = el("div", "card");
    fCard.appendChild(el("h3", "serif", "③ 최종 예언 보고서"));
    fCard.appendChild(el("p", "muted", "빈칸을 채워 나만의 예언 보고서를 완성하세요. 비워 두면 추천 답이 자동으로 들어갑니다."));

    const tmpl = e.finalTemplate;
    const parts = tmpl.text.split(/\{(\d+)\}/); // 문자, 인덱스, 문자, 인덱스...
    const tmplWrap = el("div", "final-template serif");
    const fills = [];
    parts.forEach((p, i) => {
      if (i % 2 === 0) {
        tmplWrap.appendChild(document.createTextNode(p));
      } else {
        const idx = Number(p);
        const inp = el("input", "fill");
        inp.type = "text";
        inp.placeholder = tmpl.blanks[idx].hint;
        inp.dataset.suggest = tmpl.blanks[idx].suggest;
        inp.dataset.blankIdx = idx;
        // 저장된 값 복원
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
      // 각 빈칸 채점: 입력이 accept 키워드 중 하나라도 포함하면 정답
      const results = fills.map((f, i) => {
        const raw = f.value.trim();
        const blank = tmpl.blanks[i];
        const accept = blank.accept || [blank.suggest];
        const ok = raw.length > 0 && accept.some((w) => raw.includes(w));
        return { raw, ok, blank };
      });

      // 보고서 본문은 정답인 칸은 학생 답, 오답/빈칸은 추천 정답으로 채움
      let text = tmpl.text;
      results.forEach((r, i) => {
        const filled = r.ok ? r.raw : r.blank.suggest;
        text = text.replace(`{${i}}`, filled);
      });

      // 입력칸에 정답/오답 색 표시
      fills.forEach((f, i) => {
        f.classList.remove("ok-fill", "wrong-fill");
        f.classList.add(results[i].ok ? "ok-fill" : "wrong-fill");
      });

      out.innerHTML = "";
      const correctCount = results.filter((r) => r.ok).length;

      const report = el("div", "report-out");
      report.textContent =
        "🕯️ 전쟁 예언자의 최종 보고서\n\n" + text + "\n\n— " + e.coreMessage;
      out.appendChild(report);

      // 채점 요약
      out.appendChild(el("p", null, `<b>${correctCount}/${results.length}</b> 칸을 스스로 맞혔어요.`));

      // 틀리거나 비운 칸이 있으면 정답을 알려 준다
      const wrong = results.filter((r) => !r.ok);
      if (wrong.length > 0) {
        const fix = el("div", "answer-fix");
        fix.appendChild(el("div", null, "📌 아래 칸은 이렇게 채우면 정확해요:"));
        const ul = el("ul");
        ul.style.margin = "8px 0 0";
        results.forEach((r, i) => {
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

    // 미션별 점수표
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
    again.addEventListener("click", () => {
      clearStore();
      go("prologue");
    });
    const review = el("button", "btn btn-primary", "미션 1부터 다시 보기");
    review.addEventListener("click", () => go("mission1"));
    actions.appendChild(again);
    actions.appendChild(el("div", "spacer"));
    actions.appendChild(review);
    stage.appendChild(actions);
  }

  // ---------- 시작 ----------
  loadState();
  // 항상 프롤로그에서 시작하되, 저장된 진행이 있으면 '이어서 예언하기'가 표시됩니다.
  go("prologue");
})();
