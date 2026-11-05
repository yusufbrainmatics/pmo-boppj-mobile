const icons = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  projects: '<path d="M3 6h18v14H3z"/><path d="M3 10h18M8 6V3h8v3"/>',
  regions: '<path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/>',
  management: '<path d="m14 4 6 6-10 10-6-6L14 4Z"/><path d="m12 6 6 6M3 21l4-1-3-3-1 4Z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M16 11h6"/>',
  daily: '<path d="M3 12h3l2-6 4 12 3-8 2 2h4"/>',
  export: '<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M5 21h14"/>',
  map: '<path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/>',
  approval: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3h6v3H9zM9 12l2 2 4-4M9 17h6"/>',
  missing: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  knowledge: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5A2.5 2.5 0 0 1 20 22V5.5Z"/>',
}

document.querySelectorAll('.menu-item').forEach((item) => {
  const path = icons[item.dataset.page]
  if (!path) return
  ;[...item.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).forEach((node) => node.remove())
  item.insertAdjacentHTML('afterbegin', `<svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`)
})
