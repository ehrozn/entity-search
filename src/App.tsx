import React, { useState, useRef, useEffect } from 'react';
import { Send, Building2, MapPin, Search, History, Plus, Loader2, Info, Star, StarOff, Heart, Download, FileText, Upload, MessageSquare, X, Menu, Copy, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { searchBusinessInfo, askFollowUp } from './services/gemini';
import { cn } from './lib/utils';
import { jsPDF } from 'jspdf';
import Papa from 'papaparse';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  businessName?: string;
  state?: string;
  isResult?: boolean;
  sessionId?: string;
}

interface Favorite {
  id: string;
  name: string;
  state: string;
  addedAt: Date;
}

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", 
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", 
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", 
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", 
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", 
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", 
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", 
  "Wisconsin", "Wyoming"
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [state, setState] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<{id: string, name: string, state: string}[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'favorites'>('history');
  const [followUpText, setFollowUpText] = useState('');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [showAbout, setShowAbout] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('taxbiz_history');
    const savedFavorites = localStorage.getItem('taxbiz_favorites');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedFavorites) {
      const parsed = JSON.parse(savedFavorites);
      setFavorites(parsed.map((f: any) => ({ ...f, addedAt: new Date(f.addedAt) })));
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('taxbiz_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('taxbiz_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleFavorite = (name: string, state: string) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.name.toLowerCase() === name.toLowerCase() && f.state.toLowerCase() === state.toLowerCase());
      if (exists) {
        return prev.filter(f => f.id !== exists.id);
      }
      return [{
        id: Date.now().toString(),
        name,
        state,
        addedAt: new Date()
      }, ...prev];
    });
  };

  const isFavorite = (name?: string, state?: string) => {
    if (!name || !state) return false;
    return favorites.some(f => f.name.toLowerCase() === name.toLowerCase() && f.state.toLowerCase() === state.toLowerCase());
  };

  const handleSearch = async (e?: React.FormEvent, overrideName?: string, overrideState?: string) => {
    if (e) e.preventDefault();
    
    const nameToSearch = overrideName || businessName;
    const stateToSearch = overrideState || state;

    if (!nameToSearch.trim() || !stateToSearch.trim()) return;

    const sessionId = Math.random().toString(36).substring(7);
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `Search: **${nameToSearch}** in state **${stateToSearch}**`,
      timestamp: new Date(),
      businessName: nameToSearch,
      state: stateToSearch,
      sessionId
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    if (!overrideName) {
      setBusinessName('');
      setState('');
    }

    const result = await searchBusinessInfo({ name: nameToSearch, state: stateToSearch }, sessionId);

    if (result.includes("An error occurred")) {
      setError("Search failed. Please check your connection or API key.");
      setIsLoading(false);
      return;
    }

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: result,
      timestamp: new Date(),
      businessName: nameToSearch,
      state: stateToSearch,
      isResult: true,
      sessionId
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);

    // Add to history if not already there
    setHistory(prev => {
      const exists = prev.find(h => h.name.toLowerCase() === nameToSearch.toLowerCase() && h.state.toLowerCase() === stateToSearch.toLowerCase());
      if (exists) return prev;
      return [{ id: Date.now().toString(), name: nameToSearch, state: stateToSearch }, ...prev].slice(0, 15);
    });
  };

  const handleFollowUp = async (sessionId: string) => {
    if (!followUpText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: followUpText,
      timestamp: new Date(),
      sessionId
    };

    setMessages(prev => [...prev, userMessage]);
    const currentText = followUpText;
    setFollowUpText('');
    setIsLoading(true);

    try {
      const result = await askFollowUp(sessionId, currentText);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result,
        timestamp: new Date(),
        sessionId
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const data = results.data as any[];
        const validRows = data.filter(row => row.name && row.state);
        
        if (validRows.length === 0) {
          alert("No valid rows found. Please ensure your CSV has 'name' and 'state' columns.");
          return;
        }

        setIsBatchProcessing(true);
        setBatchProgress({ current: 0, total: validRows.length });

        for (let i = 0; i < validRows.length; i++) {
          setBatchProgress(prev => ({ ...prev, current: i + 1 }));
          await handleSearch(undefined, validRows[i].name, validRows[i].state);
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setIsBatchProcessing(false);
      }
    });
  };

  const downloadTxt = (content: string, filename: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${filename}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadPdf = (content: string, filename: string) => {
    const doc = new jsPDF();
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const splitText = doc.splitTextToSize(content, pageWidth - margin * 2);
    
    let y = margin;
    const pageHeight = doc.internal.pageSize.getHeight();

    splitText.forEach((line: string) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 7; // Line height
    });
    
    doc.save(`${filename}.pdf`);
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear your search history?")) {
      setHistory([]);
    }
  };

  const startNewSearch = () => {
    setMessages([]);
    setBusinessName('');
    setState('');
  };

  return (
    <div className="flex h-screen bg-[#f5f5f5] font-sans text-slate-900 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transition-transform duration-300 md:relative md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                <Building2 size={20} />
              </div>
              <h1 className="font-semibold text-lg tracking-tight">Entity Search</h1>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden p-1 hover:bg-slate-100 rounded-lg"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>
          
          <button 
            onClick={startNewSearch}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <Plus size={18} />
            New Search
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex border-b border-slate-100 px-4">
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2",
                activeTab === 'history' ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              History
            </button>
            <button 
              onClick={() => setActiveTab('favorites')}
              className={cn(
                "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2",
                activeTab === 'favorites' ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Favorites
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {activeTab === 'history' ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Searches</span>
                  {history.length > 0 && (
                    <button 
                      onClick={clearHistory}
                      className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {history.length === 0 ? (
                  <p className="px-2 text-sm text-slate-400 italic">History is empty</p>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSearch(undefined, item.name, item.state)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors group flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate group-hover:text-emerald-600">{item.name}</div>
                        <div className="text-xs text-slate-400">{item.state}</div>
                      </div>
                      {isFavorite(item.name, item.state) && (
                        <Heart size={12} className="text-rose-500 fill-rose-500" />
                      )}
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {favorites.length === 0 ? (
                  <p className="px-2 text-sm text-slate-400 italic">Favorites list is empty</p>
                ) : (
                  favorites.map((item) => (
                    <div key={item.id} className="group relative">
                      <button
                        onClick={() => handleSearch(undefined, item.name, item.state)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate group-hover:text-emerald-600">{item.name}</div>
                          <div className="text-xs text-slate-400">{item.state}</div>
                        </div>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(item.name, item.state); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <StarOff size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
              TM
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Tax Manager</p>
              <p className="text-xs text-slate-500 truncate">Workspace</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-6 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Menu size={20} className="text-slate-600" />
            </button>
            <div className="flex items-center gap-2">
              <Building2 className="text-emerald-600 md:hidden" size={24} />
              <span className="font-semibold md:hidden">Entity Search</span>
              <div className="hidden md:flex items-center gap-4 text-sm text-slate-500">
                <button 
                  onClick={() => setShowAbout(true)}
                  className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors"
                >
                  <Info size={16} />
                  About & Instructions
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
              title="Batch Search (CSV)"
            >
              <Upload size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".csv" 
              className="hidden" 
            />
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">System Active</span>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-600 mb-2">
                <Search size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Find Business Information</h2>
                <p className="text-slate-500 text-lg">
                  Enter company name and state to get tax return data.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pt-4">
                <div 
                  className="p-4 bg-white border border-slate-200 rounded-2xl text-left hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group" 
                  onClick={() => handleSearch(undefined, 'Apple Inc.', 'California')}
                >
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1 group-hover:text-emerald-500">Example 1</p>
                  <p className="font-medium">Apple Inc. in California</p>
                </div>
                <div 
                  className="p-4 bg-white border border-slate-200 rounded-2xl text-left hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group" 
                  onClick={() => handleSearch(undefined, 'Microsoft', 'Washington')}
                >
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1 group-hover:text-emerald-500">Example 2</p>
                  <p className="font-medium">Microsoft in Washington</p>
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div 
              key={message.id} 
              className={cn(
                "flex w-full",
                message.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "max-w-[90%] md:max-w-[85%] rounded-2xl p-6 shadow-sm relative group transition-all",
                message.role === 'user' 
                  ? "bg-slate-900 text-white rounded-tr-none" 
                  : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
              )}>
                {message.role === 'assistant' && message.isResult && (
                  <div className="absolute -right-12 top-0 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => toggleFavorite(message.businessName!, message.state!)}
                      className={cn(
                        "p-2 rounded-full shadow-sm border border-slate-100",
                        isFavorite(message.businessName, message.state) 
                          ? "text-rose-500 bg-rose-50" 
                          : "text-slate-400 hover:text-emerald-600 bg-white"
                      )}
                      title={isFavorite(message.businessName, message.state) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star size={18} className={isFavorite(message.businessName, message.state) ? "fill-rose-500" : ""} />
                    </button>
                    <button 
                      onClick={() => downloadTxt(message.content, message.businessName || 'report')}
                      className="p-2 rounded-full shadow-sm border border-slate-100 text-slate-400 hover:text-emerald-600 bg-white"
                      title="Download TXT"
                    >
                      <FileText size={18} />
                    </button>
                    <button 
                      onClick={() => downloadPdf(message.content, message.businessName || 'report')}
                      className="p-2 rounded-full shadow-sm border border-slate-100 text-slate-400 hover:text-emerald-600 bg-white"
                      title="Download PDF"
                    >
                      <Download size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(message.content);
                        setCopySuccess(message.id);
                        setTimeout(() => setCopySuccess(null), 2000);
                      }}
                      className="p-2 rounded-full shadow-sm border border-slate-100 text-slate-400 hover:text-emerald-600 bg-white transition-all"
                      title="Copy Report"
                    >
                      {copySuccess === message.id ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
                    </button>
                  </div>
                )}
                <div className="prose prose-slate max-w-none prose-sm md:prose-base dark:prose-invert">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>

                {/* Follow-up Input for Assistant Results */}
                {message.role === 'assistant' && message.sessionId && message.isResult && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-3 text-xs font-bold text-emerald-600 uppercase tracking-widest">
                      <MessageSquare size={14} />
                      Ask a follow-up question
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="e.g., Who is the CEO? Any recent news?"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500 transition-all"
                        value={followUpText}
                        onChange={(e) => setFollowUpText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleFollowUp(message.sessionId!)}
                      />
                      <button 
                        onClick={() => handleFollowUp(message.sessionId!)}
                        disabled={isLoading}
                        className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                )}
                <div className={cn(
                  "text-[10px] mt-2 opacity-50",
                  message.role === 'user' ? "text-right" : "text-left"
                )}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-3">
                <Loader2 className="animate-spin text-emerald-600" size={18} />
                <span className="text-sm text-slate-500 font-medium">Analyzing registries...</span>
              </div>
            </div>
          )}

          {/* Batch Progress Bar */}
          {isBatchProcessing && (
            <div className="sticky bottom-0 left-0 right-0 px-6 py-3 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between z-20">
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin text-emerald-600" size={18} />
                <span className="text-sm font-bold text-emerald-800">
                  Batch Processing: {batchProgress.current} / {batchProgress.total}
                </span>
              </div>
              <div className="w-64 h-2 bg-emerald-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-600 transition-all duration-500" 
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-gradient-to-t from-[#f5f5f5] via-[#f5f5f5] to-transparent">
          <form 
            onSubmit={handleSearch}
            className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 p-2 flex flex-col md:flex-row gap-2"
          >
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-transparent focus-within:border-emerald-200 transition-all">
              <Building2 size={18} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Company name..." 
                className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-slate-400"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>
            <div className="w-full md:w-56 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-transparent focus-within:border-emerald-200 transition-all">
              <MapPin size={18} className="text-slate-400" />
              <select 
                className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
              >
                <option value="" disabled>Select State...</option>
                {US_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <button 
              type="submit"
              disabled={isLoading || isBatchProcessing || !businessName.trim() || !state.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-200"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              <span>Search</span>
            </button>
          </form>
          <p className="text-center text-[10px] text-slate-400 mt-3 font-medium uppercase tracking-widest">
            AI can make mistakes. Always verify data in official sources.
          </p>
        </div>
        {/* Error Toast */}
        {error && (
          <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-right duration-300">
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3">
              <AlertCircle size={20} />
              <span className="text-sm font-medium">{error}</span>
              <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Overlay for mobile menu */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-30 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </main>

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                    <Building2 size={24} />
                  </div>
                  <h2 className="text-2xl font-bold">About Entity Search</h2>
                </div>
                <button 
                  onClick={() => setShowAbout(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-6 text-slate-600">
                <section>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">What is Entity Search?</h3>
                  <p>
                    Entity Search is a professional business intelligence platform designed to help tax managers, 
                    legal professionals, and business analysts quickly gather comprehensive information about 
                    US-based companies. It leverages advanced AI to search through public registries, 
                    official state records, and online presence to generate detailed reports.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">How to Use</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      <strong>Single Search:</strong> Enter the company name and select the state of registration 
                      in the search bar at the bottom to generate a real-time report.
                    </li>
                    <li>
                      <strong>Batch Search:</strong> Click the upload icon in the header to process a CSV file 
                      with 'name' and 'state' columns for multiple entities at once.
                    </li>
                    <li>
                      <strong>Follow-up Questions:</strong> After a report is generated, you can ask specific 
                      questions like "Who is the CEO?" or "What are their recent financials?" directly in the chat.
                    </li>
                    <li>
                      <strong>Exporting:</strong> Hover over any report to download it as a PDF or TXT file, 
                      or copy it to your clipboard.
                    </li>
                    <li>
                      <strong>Favorites:</strong> Star important reports to save them in your favorites list for 
                      quick access later.
                    </li>
                  </ul>
                </section>

                <section className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-widest mb-2">Key Features</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm text-emerald-700">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Sanctions Checking
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Financial Analysis
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Ownership Details
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Compliance Status
                    </div>
                  </div>
                </section>
              </div>

              <button 
                onClick={() => setShowAbout(false)}
                className="w-full mt-8 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
