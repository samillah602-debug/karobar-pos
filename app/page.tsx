import Workspace from "./workspace";
import Login from "./login";
import { hasSession, isConfigured } from "@/lib/auth/server";
export const dynamic = "force-dynamic";
export default async function Home() {
  return (await hasSession()) ? (
    <Workspace />
  ) : (
    <Login configured={isConfigured()} />
  );
}
