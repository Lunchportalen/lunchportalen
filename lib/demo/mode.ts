export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("demo_mode") === "true";
}

export function enableDemoMode(): void {
  localStorage.setItem("demo_mode", "true");
  window.location.reload();
}

export function disableDemoMode(): void {
  localStorage.removeItem("demo_mode");
  window.location.reload();
}
