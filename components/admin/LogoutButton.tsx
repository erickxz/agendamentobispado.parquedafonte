"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="link-button"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}
