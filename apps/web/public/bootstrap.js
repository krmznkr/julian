(function () {
  // Apply persisted UI preferences before React boots to avoid flicker.
  try {
    var stored = localStorage.getItem("theme");
    var prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch {
    // Ignore storage and media query access failures during bootstrap.
  }

  try {
    var fontSize = localStorage.getItem("julian.settings.fontSize");
    if (fontSize === "small" || fontSize === "medium" || fontSize === "large") {
      document.documentElement.dataset.fontSize = fontSize;
    } else {
      document.documentElement.dataset.fontSize = "medium";
    }

    var density = localStorage.getItem("julian.settings.density");
    if (density === "comfortable" || density === "compact") {
      document.documentElement.dataset.density = density;
    }
  } catch {
    // Ignore storage access failures during bootstrap.
  }
})();
