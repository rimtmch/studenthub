import React, { useState, useRef, useEffect } from 'react';
import { Send, BrainCircuit, Sparkles, AlertCircle, Bot, RefreshCw, Copy, Check, RotateCcw } from 'lucide-react';
import { createChatSession, sendMessageStream } from '../services/geminiService';
import { ChatMessage } from '../types';
import { GenerateContentResponse } from "@google/genai";

const SUBJECTS = [
  "General Medicine",
  "Anatomy",
  "Physiology",
  "Biochemistry",
  "Pathology",
  "Pharmacology",
  "Microbiology",
  "Forensic Medicine",
  "Community Medicine",
  "ENT",
  "Ophthalmology",
  "Surgery",
  "OBG",
  "Pediatrics"
];

const AITutor: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: `Hello! I am your AI Medical Tutor specializing in ${SUBJECTS[0]}. Ask me anything!` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [chatSession, setChatSession] = useState(() => createChatSession(SUBJECTS[0]));
  
  // Use a ref for the scrollable container specifically
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatSession(createChatSession(selectedSubject));
    setMessages([{ 
        id: Date.now().toString(), 
        role: 'model', 
        text: `Context switched to ${selectedSubject}. How can I help you with this subject?` 
    }]);
  }, [selectedSubject]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
        const { scrollHeight, clientHeight } = chatContainerRef.current;
        chatContainerRef.current.scrollTo({
            top: scrollHeight - clientHeight,
            behavior: 'smooth'
        });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateResponse = async (promptText: string) => {
      setIsLoading(true);
      const modelMsgId = (Date.now() + 1).toString();
      
      // Add placeholder for model response
      setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '', isStreaming: true }]);

      try {
          const responseStream = await sendMessageStream(chatSession, promptText);
          let fullText = '';
          
          for await (const chunk of responseStream) {
            const c = chunk as GenerateContentResponse;
            if (c.text) {
                fullText += c.text;
                setMessages(prev => 
                    prev.map(msg => 
                        msg.id === modelMsgId 
                        ? { ...msg, text: fullText } 
                        : msg
                    )
                );
            }
          }

          setMessages(prev => 
            prev.map(msg => 
                msg.id === modelMsgId 
                ? { ...msg, isStreaming: false } 
                : msg
            )
          );

      } catch (error) {
          setMessages(prev => prev.map(msg => 
            msg.id === modelMsgId 
            ? { ...msg, text: 'Sorry, I encountered an error. Please check your connection.', isStreaming: false } 
            : msg
          ));
      } finally {
          setIsLoading(false);
      }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const textToSend = input;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    
    await generateResponse(textToSend);
  };

  const handleCopy = async (text: string, id: string) => {
      try {
          await navigator.clipboard.writeText(text);
          setCopiedId(id);
          setTimeout(() => setCopiedId(null), 2000);
      } catch (err) {
          console.error('Failed to copy', err);
      }
  };

  const handleRegenerate = async () => {
      if (isLoading || messages.length < 2) return;

      // Find the last user message using reverse iteration to support older environments
      let lastUserMessageIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          lastUserMessageIndex = i;
          break;
        }
      }
      
      if (lastUserMessageIndex === -1) return;

      const lastUserMessage = messages[lastUserMessageIndex];

      // Remove all messages after the last user message
      setMessages(prev => prev.slice(0, lastUserMessageIndex + 1));

      // Re-trigger generation
      await generateResponse(lastUserMessage.text);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col glass rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl mb-20">
      {/* Chat Header */}
      <div className="p-5 bg-slate-100/50 dark:bg-slate-900/30 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-sm">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 dark:bg-purple-600/20 flex items-center justify-center border border-purple-500/30 text-purple-600 dark:text-purple-300 shadow-inner">
            <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
            <h2 className="font-bold text-lg text-slate-900 dark:text-white">AI Medical Tutor</h2>
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></span>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Gemini 2.5 Flash Online</p>
            </div>
            </div>
        </div>
        
        <div className="relative">
            <select 
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="appearance-none bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-200 text-sm rounded-xl py-3 pl-4 pr-10 focus:outline-none focus:border-purple-500/50 cursor-pointer hover:bg-white/50 dark:hover:bg-white/10 transition w-full sm:w-56 font-medium shadow-sm"
            >
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <RefreshCw className="w-4 h-4" />
            </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-5 space-y-6 bg-transparent scroll-smooth"
      >
        {messages.map((msg, idx) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-3xl p-5 shadow-lg relative group ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-white dark:bg-white/5 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-bl-none backdrop-blur-md'
              }`}
            >
              {msg.role === 'model' && (
                <div className="flex items-center gap-2 mb-2 text-purple-600 dark:text-purple-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" /> {selectedSubject} Tutor
                </div>
              )}
              
              <div className="whitespace-pre-wrap text-sm leading-relaxed font-medium">
                {msg.text}
                {msg.isStreaming && <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-slate-400 animate-pulse"></span>}
              </div>

              {/* Action Buttons for Model */}
              {msg.role === 'model' && !msg.isStreaming && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button 
                        onClick={() => handleCopy(msg.text, msg.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                        title="Copy Response"
                      >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      
                      {/* Only show regenerate on the latest message */}
                      {idx === messages.length - 1 && (
                          <button 
                            onClick={handleRegenerate}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                            title="Regenerate Response"
                          >
                              <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                      )}
                  </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1].role === 'user' && (
             <div className="flex justify-start">
                 <div className="bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 rounded-3xl rounded-bl-none p-5 flex items-center gap-3 backdrop-blur-md">
                    <Bot className="w-5 h-5 animate-bounce" />
                    <span className="text-sm font-medium">Thinking...</span>
                 </div>
             </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-5 bg-slate-100/50 dark:bg-slate-900/40 border-t border-white/5 backdrop-blur-lg">
        <div className="relative flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Ask a question about ${selectedSubject}...`}
            disabled={isLoading}
            className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-200 text-sm rounded-2xl py-4 pl-5 pr-14 focus:outline-none focus:border-blue-500/50 focus:bg-slate-50 dark:focus:bg-slate-800/80 transition disabled:opacity-50 placeholder-slate-400 dark:placeholder-slate-500 shadow-inner"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-blue-900/20 active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-3 text-center flex items-center justify-center gap-1.5 opacity-70">
            <AlertCircle className="w-3 h-3" />
            AI can make mistakes. Always verify with your textbooks.
        </p>
      </div>
    </div>
  );
};

export default AITutor;