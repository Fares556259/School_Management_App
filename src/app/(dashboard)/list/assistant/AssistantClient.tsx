"use client";
import SnapAssistant from "../../admin/components/SnapAssistant";
import AssistantSidebar from "../../admin/components/AssistantSidebar";
import { useState } from "react";

const AssistantClient = ({
  dashboardContext,
  activities
}: {
  dashboardContext: any;
  activities: any[];
}) => {
  const [activeSession, setActiveSession] = useState("new");
  const [chatKey, setChatKey] = useState(0);

  const handleNewChat = () => {
    setChatKey(prev => prev + 1);
    setActiveSession("new");
  };

  return (
    <div className="h-[calc(100vh-100px)] -m-6 flex overflow-hidden bg-slate-50/30">
      {/* 1. ChatGPT-Style Sidebar */}
      <AssistantSidebar 
        conversations={activities}
        activeId={activeSession}
        onSelect={setActiveSession}
        onNewChat={handleNewChat}
      />

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-8 overflow-hidden">
          <SnapAssistant 
            key={chatKey}
            context={dashboardContext} 
            fullPage={true} 
            onNewChat={handleNewChat}
          />
        </div>
      </div>
    </div>
  );
};

export default AssistantClient;
