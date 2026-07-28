"use client";
import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button className="nav__link" onClick={() => signOut({ callbackUrl: "/" })}>
      Sign Out
    </button>
  );
}
