import "./styles.css";

const links = [...document.querySelectorAll(".guide-index a")];
const sections = links
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    const activeEntry = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (!activeEntry) return;
    for (const link of links) {
      if (link.hash === `#${activeEntry.target.id}`) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }, { rootMargin: "-15% 0px -70% 0px", threshold: [0, 0.1, 0.5] });
  sections.forEach((section) => sectionObserver.observe(section));
}
