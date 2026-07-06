import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";
import { getSubscriptions } from "../actions";
import SubscriptionsTable from "./SubscriptionsTable";

export default async function SubscriptionsPage() {
  const role = await getRole();
  if (role !== "superadmin") return redirect("/");

  const subscriptions = await getSubscriptions();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-black text-slate-800">Subscriptions</h1>
        <p className="text-sm text-slate-500 font-medium">Manage active schools and their platform access.</p>
      </div>

      <SubscriptionsTable data={subscriptions} />
    </div>
  );
}
