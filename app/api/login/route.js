import { NextResponse } from "next/server";

export async function POST(request) {
  const { username, password } = await request.json();

  const expectedUser = process.env.AUTH_USER;
  const expectedPass = process.env.AUTH_PASS;

  if (!expectedUser || !expectedPass) {
    return NextResponse.json(
      { ok: false, error: "Server is not configured for authentication." },
      { status: 500 }
    );
  }

  if (username === expectedUser && password === expectedPass) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("dm_session", "ok", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });
    return res;
  }

  return NextResponse.json(
    { ok: false, error: "Invalid username or password" },
    { status: 401 }
  );
}
