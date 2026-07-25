import React, { useState } from 'react';
import { BookOpen, MessageSquare, ListTodo, Settings, Layout, MousePointerClick, Key, Command, Move, ChevronDown, ChevronRight } from 'lucide-react';

const AccordionSection = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="bg-panel border border-card-border rounded-xl overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors text-left"
      >
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-3">
          <Icon className="w-5 h-5 text-accent" />
          {title}
        </h2>
        {isOpen ? <ChevronDown className="w-5 h-5 text-text-muted shrink-0" /> : <ChevronRight className="w-5 h-5 text-text-muted shrink-0" />}
      </button>
      
      {isOpen && (
        <div className="p-5 pt-0 animate-in slide-in-from-top-2 fade-in duration-300 border-t border-card-border/50">
          {children}
        </div>
      )}
    </section>
  );
};

export const DocsView = () => {
  return (
    <div className="flex-1 overflow-y-auto bg-bg custom-scrollbar text-text-primary p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-3 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-accent" />
            FloatGPT Documentation
          </h1>
          <p className="text-text-secondary text-[15px] leading-relaxed">
            Welcome to the official FloatGPT Documentation. Click any section below to expand and learn more about every feature, setting, and shortcut available in FloatGPT.
          </p>
        </div>

        {/* 1. Core Modes: Chat vs. Plan */}
        <AccordionSection title="1. Core Modes: Plan Mode vs. Chat Mode" icon={Layout} defaultOpen={true}>
          <p className="text-[14px] text-text-secondary leading-relaxed mt-2">
            FloatGPT has two primary reasoning engines. You can toggle between them in the Playground's top bar or the Orb's Right Panel.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-card border border-card-border rounded-xl p-5 hover:border-accent/30 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <ListTodo className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-text-primary">Plan Mode (Execution Agent)</h3>
              </div>
              <p className="text-[13px] text-text-muted leading-relaxed">
                When Plan Mode is ON, FloatGPT acts as an autonomous project manager. It analyzes your prompts and automatically breaks them down into Goals, Projects, and Tasks, saving them directly to your active workspace. Use this when you have a complex project to manage.
              </p>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-5 hover:border-accent/30 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-text-primary">Chat Mode (Conversational)</h3>
              </div>
              <p className="text-[13px] text-text-muted leading-relaxed">
                When Plan Mode is OFF, FloatGPT acts as a standard, helpful AI assistant. It will only converse with you and answer questions. In this mode, you can also set a <strong>Custom Context</strong> to dictate exactly how the AI should behave (e.g., "Act as a senior software engineer").
              </p>
            </div>
          </div>
        </AccordionSection>

        {/* 2. Slash Commands */}
        <AccordionSection title="2. Slash Commands (/)" icon={Command}>
          <p className="text-[14px] text-text-secondary leading-relaxed mt-2">
            Typing <code>/</code> in the chat input instantly opens a menu of powerful macros to execute complex workflows.
          </p>
          <div className="bg-card border border-card-border rounded-xl overflow-hidden mt-4">
            <div className="divide-y divide-card-border/50">
              <div className="p-4 hover:bg-white/5 transition-colors">
                <p className="text-[13px] font-bold text-accent mb-1">/explain</p>
                <p className="text-[13px] text-text-muted">Explains a specific concept or piece of code in extreme detail.</p>
              </div>
              <div className="p-4 hover:bg-white/5 transition-colors">
                <p className="text-[13px] font-bold text-accent mb-1">/summarize</p>
                <p className="text-[13px] text-text-muted">Condenses long blocks of text or documents into key bullet points.</p>
              </div>
              <div className="p-4 hover:bg-white/5 transition-colors">
                <p className="text-[13px] font-bold text-accent mb-1">/plan</p>
                <p className="text-[13px] text-text-muted">Forces the AI to generate a structured timeline for a specific task.</p>
              </div>
              <div className="p-4 hover:bg-white/5 transition-colors">
                <p className="text-[13px] font-bold text-accent mb-1">/brainstorm</p>
                <p className="text-[13px] text-text-muted">Generates a list of creative ideas without rigid task structures.</p>
              </div>
              <div className="p-4 hover:bg-white/5 transition-colors">
                <p className="text-[13px] font-bold text-accent mb-1">/draw</p>
                <p className="text-[13px] text-text-muted">Instructs the AI to generate a creative image or visual representation based on your prompt.</p>
              </div>
              <div className="p-4 hover:bg-white/5 transition-colors">
                <p className="text-[13px] font-bold text-accent mb-1">/diagram</p>
                <p className="text-[13px] text-text-muted">Forces the AI to map out complex architectures or workflows using a visual Mermaid diagram.</p>
              </div>
              <div className="p-4 hover:bg-white/5 transition-colors">
                <p className="text-[13px] font-bold text-accent mb-1">/table</p>
                <p className="text-[13px] text-text-muted">Ensures the AI formats its response as a structured, easy-to-read Markdown table for comparing data.</p>
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* 3. Orb Controls & Shortcuts */}
        <AccordionSection title="3. Hiding, Dragging, and Managing the Orb" icon={Move}>
          <p className="text-[14px] text-text-secondary leading-relaxed mt-2">
            The Desktop Orb is designed to stay out of your way until you need it.
          </p>
          <ul className="list-disc pl-5 text-[14px] text-text-secondary space-y-3 mt-4 bg-card border border-card-border p-5 rounded-xl">
            <li><strong>Global Hotkey:</strong> Press <kbd className="bg-bg px-2 py-1 rounded text-xs border border-card-border">Ctrl+Shift+Space</kbd> from anywhere on your PC to instantly hide or show the Orb.</li>
            <li><strong>Draggable Interface:</strong> Click and drag the circular Orb icon to move it anywhere on your screen. It will automatically snap to the nearest edge.</li>
            <li><strong>Right Panel:</strong> Click the Gear icon inside the Orb to open the Right Panel. From here, you can manage API keys, change themes, or swap the underlying LLM provider.</li>
            <li><strong>History:</strong> Click the Clock icon inside the Orb to view your past chat sessions.</li>
          </ul>
        </AccordionSection>

        {/* 4. Structured Responses & Diagrams */}
        <AccordionSection title="4. Copying Diagrams & Structured Responses" icon={MousePointerClick}>
          <p className="text-[14px] text-text-secondary leading-relaxed mt-2">
            FloatGPT uses an advanced Markdown renderer that fully supports rich text, code blocks, and Mermaid diagrams.
          </p>
          <ul className="list-disc pl-5 text-[14px] text-text-secondary space-y-3 mt-4 bg-card border border-card-border p-5 rounded-xl">
            <li><strong>One-Click Copy:</strong> Hover over any AI response in the Playground to reveal a Copy button in the top right corner. Clicking this will copy the entire raw Markdown to your clipboard.</li>
            <li><strong>Code Blocks:</strong> All code blocks come with their own dedicated copy buttons and syntax highlighting.</li>
            <li><strong>Mermaid Diagrams:</strong> If the AI generates a workflow or architecture diagram, FloatGPT will render it visually in the chat. You can copy the underlying Mermaid syntax if you want to edit it elsewhere.</li>
          </ul>
        </AccordionSection>

        {/* 5. Optimizing Settings */}
        <AccordionSection title="5. Settings Optimization" icon={Settings}>
          <p className="text-[14px] text-text-secondary leading-relaxed mt-2">
            You can heavily optimize FloatGPT's behavior in the Settings panel.
          </p>
          <div className="bg-card border border-card-border rounded-xl p-5 mt-4">
            <h3 className="font-semibold text-text-primary mb-3">Key Settings</h3>
            <div className="space-y-4">
              <div className="border-b border-card-border/50 pb-4">
                <p className="text-[13px] font-bold text-white mb-1">LLM Provider Selection</p>
                <p className="text-[13px] text-text-muted">Switch seamlessly between Groq (for speed), OpenAI (for reasoning), or OpenRouter (for variety). Make sure you enter the correct API key for the selected provider.</p>
              </div>
              <div className="border-b border-card-border/50 pb-4">
                <p className="text-[13px] font-bold text-white mb-1">System Persona</p>
                <p className="text-[13px] text-text-muted">Modify the underlying system prompt. You can change FloatGPT from a "Strict Productivity Guardian" to a "Chill Coding Assistant" permanently.</p>
              </div>
              <div>
                <p className="text-[13px] font-bold text-white mb-1">Temperature</p>
                <p className="text-[13px] text-text-muted">Adjust the creativity slider. Lower temperature = more analytical/rigid. Higher temperature = more creative/brainstorming.</p>
              </div>
            </div>
          </div>
        </AccordionSection>

        <div className="pb-10"></div>
      </div>
    </div>
  );
};
