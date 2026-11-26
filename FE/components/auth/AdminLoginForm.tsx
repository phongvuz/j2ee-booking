"use client";

import LoginForm from "./LoginForm";

export default function AdminLoginForm() {
  return <LoginForm variant="admin" onSuccess={() => {
    window.location.replace("/admin");
  }} />;
}
