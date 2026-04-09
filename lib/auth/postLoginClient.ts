// STATUS: KEEP

// lib/auth/postLoginClient.ts
"use client";

type PostLoginOk = {
  ok: true;
  rid: string;
  ts?: string;
  status?: string;
  happened?: string;
  data?: { redirectTo?: string; hard?: boolean };
};

type PostLoginErr = {
  ok: false;
  rid?: string;
  ts?: string;
  status?: string;
  message?: string;
  error?: string;
  detail?: any;
};

export async function postLoginAndHardRedirect(): Promise<PostLoginOk | PostLoginErr> {
  const res = await fetch("/api/auth/post-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as any;

  if (!json) {
    const out: PostLoginErr = {
      ok: false,
      status: "FAILED",
      message: "Uventet svar fra server (ingen JSON).",
      error: "NO_JSON",
    };
    return out;
  }

  // ✅ ONLY redirect if ok + redirectTo exists
  if (json?.ok === true && json?.data?.redirectTo) {
    const to = String(json.data.redirectTo);

    // HARD redirect: dette er selve loop-fiksen
    window.location.assign(to);
    return json as PostLoginOk;
  }

  return json as PostLoginErr;
}

export async function logoutAndHardRedirect(): Promise<PostLoginOk | PostLoginErr> {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as any;

  if (!json) {
    const out: PostLoginErr = {
      ok: false,
      status: "FAILED",
      message: "Uventet svar fra server (ingen JSON).",
      error: "NO_JSON",
    };
    return out;
  }

  if (json?.ok === true && json?.data?.redirectTo) {
    window.location.assign(String(json.data.redirectTo));
    return json as PostLoginOk;
  }

  return json as PostLoginErr;
}
