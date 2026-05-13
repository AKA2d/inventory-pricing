import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button variant="secondary" type="submit">
        <LogOut className="size-4" aria-hidden />
        Sign out
      </Button>
    </form>
  );
}
