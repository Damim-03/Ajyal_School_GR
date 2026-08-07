import { Outlet } from "react-router-dom";

export const AppLayout = () => (
  <div className="flex h-screen">
    <main className="flex-1 overflow-auto p-6">
      <Outlet />
    </main>
  </div>
);
