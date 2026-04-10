import prisma from "@/lib/prisma";
import { addSubscriber, removeSubscriber } from "./actions";

export default async function ReportsManagementPage() {
  const subscribers = await prisma.reportSubscriber.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 bg-white rounded-2xl flex-1 m-4 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Daily Nightly Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Manage stakeholders who receive the automated midnight AI report.</p>
        </div>
        
        {/* Manual Trigger Button */}
        <form action="/api/cron/daily-report" method="GET" target="_blank">
          <button
            type="submit"
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-full font-semibold shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            Send Report Now
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Add Subscriber Form */}
        <div className="col-span-1 border rounded-xl p-5 shadow-sm bg-gray-50/50 h-fit">
          <h2 className="text-lg font-bold mb-4">Add Stakeholder</h2>
          <form action={addSubscriber} className="flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="text-xs text-gray-600 font-semibold mb-1 block">Full Name (Optional)</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>
            <div>
              <label htmlFor="email" className="text-xs text-gray-600 font-semibold mb-1 block">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="director@school.com"
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>
            <button
              type="submit"
              className="mt-2 w-full bg-slate-900 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-slate-800 transition-colors"
            >
              Add to Mailing List
            </button>
          </form>
        </div>

        {/* List of Subscribers */}
        <div className="col-span-2 border rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gray-50 border-b px-5 py-3">
            <h2 className="text-lg font-bold">Active Recipients ({subscribers.length})</h2>
          </div>
          
          <div className="p-0">
            {subscribers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No stakeholders added yet.</p>
                <p className="text-sm mt-1">The report will not be sent to anyone until emails are added.</p>
              </div>
            ) : (
              <ul className="divide-y">
                {subscribers.map((sub) => (
                  <li key={sub.id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
                        {sub.name ? sub.name[0].toUpperCase() : sub.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{sub.name || "Unknown Name"}</p>
                        <p className="text-sm text-gray-500">{sub.email}</p>
                      </div>
                    </div>
                    <form action={async () => {
                      "use server";
                      await removeSubscriber(sub.id);
                    }}>
                      <button 
                        type="submit"
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Remove Subscriber"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
