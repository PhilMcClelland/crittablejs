// The tool's settings. Every value here can also be set from the page: window.CRITTABLE_CONFIG = { … } before the script tag.
window.CRITTABLE_CONFIG = {
  productName: "Crittable.js",
  sidebarTitle: "All notes",
  tagName: "pin-note-board",
  storagePrefix: "crittable",
  anonymousName: "Guest",
  launcherLabel: "Notes",
  maxNote: 1000,
  maxReply: 500,
  onEvent: function () {} // a hook for the host page; the tool itself sends nothing anywhere unless a shared store is connected
};
