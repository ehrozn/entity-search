import React, { useState, useRef, useEffect } from 'react';
import { Send, Building2, MapPin, Search, History, Plus, Loader2, Info, Star, StarOff, Heart, Download, FileText, Upload, MessageSquare, X, Menu, Copy, Trash2, CheckCircle2, AlertCircle, Printer, Users, Globe, Briefcase } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { searchBusinessInfo, askFollowUp } from './services/gemini';
import { cn } from './lib/utils';
import { AdBanner } from './components/AdBanner';
import { PrivacyPolicy, TermsOfService } from './components/Legal';
import { CookieConsent } from './components/CookieConsent';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import Papa from 'papaparse';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

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
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
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
    setError('');
    
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
      setError(result);
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

  const downloadPdf = async (content: string, filename: string) => {
    const element = document.createElement('div');
    element.className = 'pdf-export-container';
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.top = '0';
    element.style.width = '700px';
    element.style.padding = '50px';
    element.style.backgroundColor = 'white';
    element.style.color = '#1e293b';
    element.style.lineHeight = '1.6';
    
    element.innerHTML = `
      <style>
        .pdf-report h1 { font-size: 24px; font-weight: bold; color: #0f172a; margin-bottom: 20px; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
        .pdf-report h2 { font-size: 18px; font-weight: bold; color: #059669; margin-top: 25px; margin-bottom: 15px; border-left: 4px solid #10b981; padding-left: 10px; }
        .pdf-report p { margin-bottom: 12px; font-size: 12px; }
        .pdf-report table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #f8fafc; }
        .pdf-report th { text-align: left; padding: 8px; background: #f1f5f9; border: 1px solid #e2e8f0; font-size: 11px; }
        .pdf-report td { padding: 8px; border: 1px solid #e2e8f0; font-size: 11px; }
        .pdf-report ul { padding-left: 20px; margin-bottom: 15px; }
        .pdf-report li { margin-bottom: 5px; font-size: 12px; }
      </style>
      <div class="pdf-report">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 30px;">
          <div style="width: 30px; height: 30px; background: #059669; border-radius: 6px;"></div>
          <span style="font-weight: bold; font-size: 18px; color: #334155;">Entity Search Report</span>
        </div>
        ${content
          .replace(/# (.*)/g, '<h1>$1</h1>')
          .replace(/## (.*)/g, '<h2>$1</h2>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br/>')
        }
        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 10px; color: #94a3b8; text-align: center;">
          Generated by Entity Search Platform • ${new Date().toLocaleDateString()}
        </div>
      </div>
    `;
    
    document.body.appendChild(element);
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth - 20; // 10mm margin each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 10; // Top margin

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      document.body.removeChild(element);
    }
  };

  const handlePrint = (content: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Entity Search Report</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
            body { font-family: 'Inter', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 24px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
            h2 { font-size: 18px; font-weight: bold; color: #059669; margin-top: 25px; margin-bottom: 15px; border-left: 4px solid #10b981; padding-left: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { text-align: left; padding: 8px; border: 1px solid #e2e8f0; }
            th { background: #f1f5f9; }
          </style>
        </head>
        <body>
          <div class="prose max-w-none">
            ${content.replace(/\n/g, '<br/>').replace(/# (.*)/g, '<h1>$1</h1>').replace(/## (.*)/g, '<h2>$1</h2>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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

  const BusinessDataVisuals: React.FC<{ content: string }> = ({ content }) => {
    const jsonMatch = content.match(/### DATA_FOR_UI_DO_NOT_EDIT\n([\s\S]*?)\n---/);
    if (!jsonMatch) return null;

    try {
      let jsonStr = jsonMatch[1].trim();
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      const data = JSON.parse(jsonStr);
      const hasFinancials = data.financials && data.financials.some((f: any) => f.revenue > 0);
      const hasNaics = data.naics && data.naics.length > 0 && data.naics[0].code !== "XXXXXX";
      const hasNexus = data.nexus_risks && data.nexus_risks.length > 0 && data.nexus_risks[0].state !== "State Name";
      const hasOwners = data.owners && data.owners.length > 0 && data.owners[0].name !== "Name";
      const hasDirectors = data.directors && data.directors.length > 0 && data.directors[0].name !== "Name";
      const hasOtherExact = data.other_states_exact && data.other_states_exact.length > 0 && data.other_states_exact[0].state !== "State";
      const hasSimilar = data.similar_entities && data.similar_entities.length > 0 && data.similar_entities[0].name !== "Similar Name";

      return (
        <div className="mt-6 space-y-6 border-t border-slate-100 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasOwners && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Users size={14} className="text-indigo-600" />
                  Legal Owners (Members)
                </h3>
                <div className="space-y-2">
                  {data.owners.map((owner: any, idx: number) => (
                    <div key={idx} className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-indigo-900">{owner.name}</span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase">{owner.source}</span>
                      </div>
                      <p className="text-[11px] text-indigo-700 mt-1">{owner.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasDirectors && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Briefcase size={14} className="text-amber-600" />
                  Management (Directors/Officers)
                </h3>
                <div className="space-y-2">
                  {data.directors.map((dir: any, idx: number) => (
                    <div key={idx} className="p-3 bg-amber-50/30 rounded-xl border border-amber-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-amber-900">{dir.name}</span>
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase">{dir.source}</span>
                      </div>
                      <p className="text-[11px] text-amber-700 mt-1">{dir.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasOtherExact && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Globe size={14} className="text-emerald-600" />
                  Exact Matches (Other States)
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {data.other_states_exact.map((item: any, idx: number) => (
                    <div key={idx} className="p-2 bg-emerald-50/30 rounded-lg border border-emerald-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900">{item.state}</span>
                      <span className="text-[9px] text-emerald-600 font-medium">{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasSimilar && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Search size={14} className="text-slate-600" />
                  Similar Entities Found
                </h3>
                <div className="space-y-2">
                  {data.similar_entities.map((item: any, idx: number) => (
                    <div key={idx} className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{item.name}</p>
                        <p className="text-[10px] text-slate-500">{item.state}</p>
                      </div>
                      <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold">{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {hasFinancials && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Loader2 size={14} className="text-emerald-600" />
                Estimated Revenue Trend
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.financials}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasNaics && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Info size={14} className="text-blue-600" />
                  Industry Code Matcher
                </h3>
                <div className="space-y-3">
                  {data.naics.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-bold text-blue-900 font-mono">{item.code}</span>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                          item.confidence === 'High' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {item.confidence} Match
                        </span>
                      </div>
                      <p className="text-xs text-blue-800 leading-relaxed">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasNexus && (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertCircle size={14} className="text-rose-600" />
                  Nexus Risk Analyzer
                </h3>
                <div className="space-y-3">
                  {data.nexus_risks.map((risk: any, idx: number) => (
                    <div key={idx} className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-rose-900">{risk.state}</span>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                          risk.risk_level === 'High' ? "bg-rose-200 text-rose-800" : "bg-amber-200 text-amber-800"
                        )}>
                          {risk.risk_level} Risk
                        </span>
                      </div>
                      <p className="text-xs text-rose-800 leading-relaxed">{risk.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    } catch (e) {
      console.error("Failed to parse business visuals data", e);
      return null;
    }
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
          <AdBanner 
            slot={import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR || "XXXXXXXXXX"} 
            className="mb-4 min-h-[100px]" 
          />
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
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-3 py-2">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-1">
                <Search size={24} />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Find Business Information</h2>
                <p className="text-slate-500 text-xs md:text-sm">
                  Enter company name and state to get tax return data.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full pt-1">
                <div 
                  className="p-2.5 bg-white border border-slate-200 rounded-xl text-left hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group" 
                  onClick={() => handleSearch(undefined, 'Apple Inc.', 'California')}
                >
                  <p className="text-[9px] font-semibold text-slate-400 uppercase mb-0.5 group-hover:text-emerald-500">Example 1</p>
                  <p className="font-medium text-xs md:text-sm">Apple Inc. in California</p>
                </div>
                <div 
                  className="p-2.5 bg-white border border-slate-200 rounded-xl text-left hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group" 
                  onClick={() => handleSearch(undefined, 'Microsoft', 'Washington')}
                >
                  <p className="text-[9px] font-semibold text-slate-400 uppercase mb-0.5 group-hover:text-emerald-500">Example 2</p>
                  <p className="font-medium text-xs md:text-sm">Microsoft in Washington</p>
                </div>
              </div>
              <AdBanner 
                slot={import.meta.env.VITE_ADSENSE_SLOT_DEFAULT || "XXXXXXXXXX"} 
                className="w-full max-w-md pt-1" 
              />
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
                      onClick={() => handlePrint(message.content)}
                      className="p-2 rounded-full shadow-sm border border-slate-100 text-slate-400 hover:text-emerald-600 bg-white"
                      title="Print Report"
                    >
                      <Printer size={18} />
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
                  <ReactMarkdown>{message.content.split('### DATA_FOR_UI_DO_NOT_EDIT')[0]}</ReactMarkdown>
                </div>

                {message.role === 'assistant' && message.isResult && (
                  <BusinessDataVisuals content={message.content} />
                )}

                {message.role === 'assistant' && message.isResult && (
                  <AdBanner 
                    slot={import.meta.env.VITE_ADSENSE_SLOT_REPORT || "XXXXXXXXXX"} 
                    className="mt-6 border-t border-slate-100 pt-6 min-h-[90px]" 
                  />
                )}

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
        <div className="p-4 bg-gradient-to-t from-[#f5f5f5] via-[#f5f5f5] to-transparent">
          <form 
            onSubmit={handleSearch}
            className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 p-1.5 flex flex-col md:flex-row gap-1.5"
          >
            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-transparent focus-within:border-emerald-200 transition-all">
              <Building2 size={16} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Company name..." 
                className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-slate-400"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>
            <div className="w-full md:w-48 flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-transparent focus-within:border-emerald-200 transition-all">
              <MapPin size={16} className="text-slate-400" />
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
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-5 py-2 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-200"
            >
              {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              <span>Search</span>
            </button>
          </form>
          <div className="max-w-4xl mx-auto mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
            <span>© 2026 Entity Search Platform</span>
            <button onClick={() => setShowPrivacy(true)} className="hover:text-emerald-600 transition-colors">Privacy Policy</button>
            <button onClick={() => setShowTerms(true)} className="hover:text-emerald-600 transition-colors">Terms of Service</button>
            <button onClick={() => setShowAbout(true)} className="hover:text-emerald-600 transition-colors">Contact Support</button>
          </div>
          <p className="text-center text-[9px] text-slate-400 mt-2 font-medium uppercase tracking-widest">
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

                <section className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                  <h3 className="text-lg font-bold text-emerald-900 mb-2">Contact & Support</h3>
                  <p className="text-emerald-800 text-sm mb-4">
                    Need help or have custom requirements? Our team is here to assist you.
                  </p>
                  <div className="flex flex-col gap-2">
                    <a href="mailto:ehrozn@gmail.com" className="text-emerald-700 font-semibold hover:underline flex items-center gap-2">
                      <Send size={16} />
                      ehrozn@gmail.com
                    </a>
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

      {/* Legal Modals */}
      <PrivacyPolicy isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsOfService isOpen={showTerms} onClose={() => setShowTerms(false)} />
      <CookieConsent />
    </div>
  );
}
