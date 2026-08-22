(function () {
  var btn = document.getElementById("mobileNavBtn");
  var panel = document.getElementById("mobileNav");
  if (btn && panel) {
    btn.addEventListener("click", function () {
      var isHidden = panel.classList.contains("hidden");
      panel.classList.toggle("hidden");
      btn.setAttribute("aria-expanded", String(isHidden));
    });
  }

  var toolsBtn = document.getElementById("mobileToolsBtn");
  var toolsPanel = document.getElementById("mobileToolsPanel");
  var chevron = document.getElementById("mobileToolsChevron");
  if (toolsBtn && toolsPanel) {
    toolsBtn.addEventListener("click", function () {
      toolsPanel.classList.toggle("hidden");
      toolsPanel.classList.toggle("flex");
      if (chevron) chevron.classList.toggle("rotate-180");
    });
  }

  // FAQ accordions (used on faq.html and blog posts)
  document.querySelectorAll("[data-accordion-trigger]").forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      var panel = trigger.nextElementSibling;
      var icon = trigger.querySelector("[data-accordion-icon]");
      var isOpen = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!isOpen));
      if (panel) panel.classList.toggle("hidden", isOpen);
      if (icon) icon.classList.toggle("rotate-45", !isOpen);
    });
  });
})();
