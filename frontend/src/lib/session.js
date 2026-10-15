import { showToast } from "./dialogs";
import { apiUrl } from "./api";
let tokenRequest;
export async function csrfToken() {
  if (!tokenRequest) {
    tokenRequest = fetch(apiUrl("session.php"), {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Unable to initialize your session");
        const data = await res.json();
        if (!data.csrf_token) throw new Error("Invalid session response");
        return data.csrf_token;
      })
      .catch((error) => {
        tokenRequest = undefined;
        throw error;
      });
  }
  return tokenRequest;
}
export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers);
  if ((options.method || "GET").toUpperCase() === "POST")
    headers.set("X-CSRF-Token", await csrfToken());
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
  if (response.status === 403) tokenRequest = undefined;
  return response;
}
export async function logout() {
  try {
    const response = await apiFetch(apiUrl("steamauth/logout.php"), {
      method: "POST",
    });
    if (!response.ok) throw new Error("Logout failed");
    window.location.assign("/");
  } catch {
    showToast(
      "Nie udało się wylogować. Odśwież stronę i spróbuj ponownie. / Please reload and try again.",
    );
  }
}
