(() => {
  const currentPath = normalizePath(window.location.pathname);
  const links = document.querySelectorAll(".siteNav nav a");

  for (const link of links) {
    const linkPath = normalizePath(new URL(link.href, window.location.origin).pathname);
    if (linkPath === "/admin/therapist-schedules") {
      link.textContent = "時段管理";
    }

    const isActive =
      linkPath === currentPath ||
      (currentPath === "/admin" && linkPath === "/admin/reservations") ||
      (currentPath === "/booking-success" && linkPath === "/booking");

    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }

  function normalizePath(path) {
    const normalized = path.replace(/\/+$/, "");
    return normalized || "/";
  }
})();
