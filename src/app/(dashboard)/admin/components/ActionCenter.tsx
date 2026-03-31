import React from 'react';
import QuickPayButton from '../finance/QuickPayButton';

interface ActionItem {
  id: string;
  name: string;
  amount: number;
  type: 'student' | 'teacher' | 'staff';
  phone?: string;
}

interface ActionCenterProps {
  unpaidStudents: ActionItem[];
  unpaidTeachers: ActionItem[];
  unpaidStaff: ActionItem[];
}

const ActionList = ({ title, items, color }: { title: string, items: ActionItem[], color: string }) => (
  <div className={`flex-1 min-w-[300px] bg-white p-6 rounded-2xl shadow-sm border-t-4 ${color}`}>
    <div className="flex justify-between items-center mb-4">
      <h3 className="font-bold text-slate-800">{title}</h3>
      <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded-full text-slate-500">{items.length} Pending</span>
    </div>
    <div className="space-y-3">
      {items.slice(0, 3).map((item) => (
        <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-700">{item.name}</span>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{item.phone || 'No Phone'}</span>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-sm font-black text-slate-800">${item.amount}</span>
             <QuickPayButton 
               id={item.id} 
               name={item.name} 
               amount={item.amount} 
               type={item.type} 
               monthYear={new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
             />
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-emerald-500 font-medium py-4 text-center">✓ All settled!</p>}
      {items.length > 3 && (
        <p className="text-[10px] text-center text-slate-400 font-bold uppercase cursor-pointer hover:text-indigo-500 transition-colors">
          + {items.length - 3} more items
        </p>
      )}
    </div>
  </div>
);

const ActionCenter = ({ unpaidStudents, unpaidTeachers, unpaidStaff }: ActionCenterProps) => {
  return (
    <div className="flex gap-6 w-full flex-wrap">
      <ActionList title="Unpaid Students" items={unpaidStudents} color="border-amber-400" />
      <ActionList title="Unpaid Teachers" items={unpaidTeachers} color="border-rose-400" />
      <ActionList title="Unpaid Staff" items={unpaidStaff} color="border-orange-400" />
    </div>
  );
};

export default ActionCenter;
