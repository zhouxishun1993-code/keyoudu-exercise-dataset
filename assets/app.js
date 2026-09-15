(function () {
  "use strict";

  var dataset = window.KEYOUDU_EXERCISE_DATASET;
  var PAGE_SIZE = 48;
  var page = 1;
  var filtered = [];

  var grid = document.getElementById("exercise-grid");
  var summary = document.getElementById("result-summary");
  var searchInput = document.getElementById("search");
  var bodyPartSelect = document.getElementById("body-part");
  var equipmentSelect = document.getElementById("equipment");
  var pagination = document.getElementById("pagination");
  var previousPage = document.getElementById("previous-page");
  var nextPage = document.getElementById("next-page");
  var pageLabel = document.getElementById("page-label");
  var dialog = document.getElementById("exercise-dialog");
  var dialogContent = document.getElementById("dialog-content");

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function populateSelect(select, values) {
    values.sort(function (a, b) {
      return a.localeCompare(b, "zh-CN");
    }).forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase("zh-CN");
  }

  function matches(exercise) {
    var term = normalize(searchInput.value);
    var haystack = normalize([
      exercise.id,
      exercise.name_zh,
      exercise.aliases.join(" "),
      exercise.source.name
    ].join(" "));
    return (!term || haystack.indexOf(term) !== -1) &&
      (!bodyPartSelect.value || exercise.body_part === bodyPartSelect.value) &&
      (!equipmentSelect.value || exercise.equipment === equipmentSelect.value);
  }

  function cardHtml(exercise) {
    return "<button class=\"exercise-card\" type=\"button\" data-exercise-id=\"" + escapeHtml(exercise.id) + "\" aria-label=\"查看 " + escapeHtml(exercise.name_zh) + " 详情\">" +
      "<span class=\"exercise-card__visual\">" +
        "<img class=\"exercise-card__image\" src=\"" + escapeHtml(exercise.media.thumbnail) + "\" alt=\"\" loading=\"lazy\">" +
        "<span class=\"exercise-card__index\">" + escapeHtml(exercise.id) + "</span>" +
      "</span>" +
      "<span class=\"exercise-card__body\">" +
        "<strong class=\"exercise-card__name\">" + escapeHtml(exercise.name_zh) + "</strong>" +
        "<span class=\"exercise-card__meta\">" +
          "<span class=\"tag\">" + escapeHtml(exercise.body_part) + "</span>" +
          "<span class=\"tag\">" + escapeHtml(exercise.equipment) + "</span>" +
        "</span>" +
        "<span class=\"exercise-card__open\">查看起止动作与步骤</span>" +
      "</span>" +
    "</button>";
  }

  function render() {
    var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    var start = (page - 1) * PAGE_SIZE;
    var visible = filtered.slice(start, start + PAGE_SIZE);

    if (visible.length) {
      grid.innerHTML = visible.map(cardHtml).join("");
    } else {
      grid.innerHTML = "<div class=\"empty-state\"><h3>没有找到匹配动作</h3><p>换一个关键词，或清空筛选条件。</p></div>";
    }
    grid.setAttribute("aria-busy", "false");

    var shownFrom = visible.length ? start + 1 : 0;
    summary.textContent = visible.length ? "当前显示 " + shownFrom + "–" + (start + visible.length) : "没有匹配结果";
    pageLabel.textContent = "第 " + page + " / " + totalPages + " 页";
    previousPage.disabled = page <= 1;
    nextPage.disabled = page >= totalPages;
    pagination.hidden = filtered.length <= PAGE_SIZE;
  }

  function applyFilters() {
    filtered = dataset.exercises.filter(matches);
    page = 1;
    render();
  }

  function detailHtml(exercise) {
    var instructions = exercise.instructions_zh.map(function (step) {
      return "<li>" + escapeHtml(step) + "</li>";
    }).join("");
    return "<article class=\"detail\">" +
      "<header class=\"detail__heading\">" +
        "<p class=\"detail__id\">" + escapeHtml(exercise.id) + "</p>" +
        "<h2>" + escapeHtml(exercise.name_zh) + "</h2>" +
        "<p class=\"detail__source\">原名：" + escapeHtml(exercise.source.name) + "</p>" +
      "</header>" +
      "<div class=\"pose-pair\">" +
        "<figure class=\"pose\"><img src=\"" + escapeHtml(exercise.media.start) + "\" alt=\"" + escapeHtml(exercise.name_zh) + " 开始动作\"><figcaption>开始</figcaption></figure>" +
        "<figure class=\"pose\"><img src=\"" + escapeHtml(exercise.media.end) + "\" alt=\"" + escapeHtml(exercise.name_zh) + " 结束动作\"><figcaption>结束</figcaption></figure>" +
      "</div>" +
      "<div class=\"detail__content\">" +
        "<section><h3>动作步骤</h3><ol class=\"instructions\">" + instructions + "</ol>" +
          "<p class=\"detail__warning\">图片和步骤尚未经过专业教练或运动医学人员逐项审核。请在训练或产品发布前独立核对。</p></section>" +
        "<aside><h3>动作信息</h3><dl class=\"facts\">" +
          "<div><dt>身体部位</dt><dd>" + escapeHtml(exercise.body_part) + "</dd></div>" +
          "<div><dt>器械</dt><dd>" + escapeHtml(exercise.equipment) + "</dd></div>" +
          "<div><dt>计量方式</dt><dd>" + (exercise.measurement === "duration" ? "时长" : "次数") + "</dd></div>" +
          "<div><dt>媒体许可</dt><dd>CC BY 4.0</dd></div>" +
          "<div><dt>专业审核</dt><dd>未进行</dd></div>" +
        "</dl></aside>" +
      "</div>" +
    "</article>";
  }

  function openExercise(id) {
    var exercise = dataset.exercises.find(function (item) {
      return item.id === id;
    });
    if (!exercise) return;
    dialogContent.innerHTML = detailHtml(exercise);
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog() {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function initialize() {
    if (!dataset || !Array.isArray(dataset.exercises)) {
      grid.innerHTML = "<div class=\"empty-state\"><h3>数据读取失败</h3><p>请确认 data/exercises.js 与 index.html 位于同一个仓库。</p></div>";
      summary.textContent = "读取失败";
      return;
    }

    populateSelect(bodyPartSelect, Array.from(new Set(dataset.exercises.map(function (item) { return item.body_part; }))));
    populateSelect(equipmentSelect, Array.from(new Set(dataset.exercises.map(function (item) { return item.equipment; }))));
    filtered = dataset.exercises.slice();
    render();
  }

  document.getElementById("filter-form").addEventListener("input", applyFilters);
  document.getElementById("filter-form").addEventListener("change", applyFilters);
  document.getElementById("clear-filters").addEventListener("click", function () {
    searchInput.value = "";
    bodyPartSelect.value = "";
    equipmentSelect.value = "";
    applyFilters();
    searchInput.focus();
  });
  grid.addEventListener("click", function (event) {
    var card = event.target.closest("[data-exercise-id]");
    if (card) openExercise(card.getAttribute("data-exercise-id"));
  });
  previousPage.addEventListener("click", function () {
    if (page > 1) {
      page -= 1;
      render();
      grid.scrollIntoView({ block: "start" });
    }
  });
  nextPage.addEventListener("click", function () {
    if (page < Math.ceil(filtered.length / PAGE_SIZE)) {
      page += 1;
      render();
      grid.scrollIntoView({ block: "start" });
    }
  });
  document.getElementById("dialog-close").addEventListener("click", closeDialog);
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) closeDialog();
  });

  initialize();
}());
