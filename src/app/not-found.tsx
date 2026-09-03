"use client";

import { useRouter } from "next/navigation";

import { NotFoundScreen } from "../pages/404";

export default function NotFound() {
    const router = useRouter();
    return <NotFoundScreen onNavigateHome={() => router.push("/")} />;
}
