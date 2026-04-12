"use client";
import SnapAssistant from "../../admin/components/SnapAssistant";
import AssistantSidebar from "../../admin/components/AssistantSidebar";
import { useState } from "react";

const AssistantClient = ({
  dashboardContext
}: {
  dashboardContext: any;
}) => {
  const [activeSession, setActiveSession] = useState("1");
  const [chatKey, setChatKey] = useState(0);

  const mockConversations = [
    { id: "1", title: "Analyse des revenus de Juin", date: "AUJOURD'HUI" },
    { id: "2", title: "Gap de paiement Amine Student", date: "HIER" },
    { id: "3", title: "Mise à jour des notes 2C", date: "10 AVRIL" },
  ];

  const handleNewChat = () => {
    setChatKey(prev => prev + 1);
    setActiveSession("new");
  };

  return (
    <div className="h-[calc(100vh-100px)] -m-6 flex overflow-hidden bg-white">
      {/* 1. ChatGPT-Style Sidebar */}
      <AssistantSidebar 
        conversations={mockConversations}
        activeId={activeSession}
        onSelect={setActiveSession}
        onNewChat={handleNewChat}
      />

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <div className="flex-1 p-6 overflow-hidden">
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
