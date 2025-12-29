
import React, { useRef } from 'react';

interface HeaderProps {
  onSave: () => void;
  canSave: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Header: React.FC<HeaderProps> = ({ onSave, canSave, onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNewClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 z-50 bg-background-dark/40 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center gap-2 group cursor-default">
        <div className="size-8 bg-primary rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(48,232,122,0.4)] group-hover:rotate-12 transition-transform">
          <span className="material-symbols-outlined text-background-dark font-bold text-xl filled">auto_fix_high</span>
        </div>
        <span className="text-sm font-bold tracking-[3px] uppercase text-white/90">Studio</span>
      </div>

      <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-bold tracking-[0.2em] uppercase text-white hidden sm:block">
        Object Remover <span className="text-primary/50 text-[10px] align-top ml-1">AI</span>
      </h1>

      <div className="flex items-center gap-3">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={onUpload} 
          accept="image/*" 
          className="hidden" 
        />
        
        <button 
          onClick={handleNewClick}
          className="flex items-center justify-center size-9 rounded-full bg-white/5 text-white/60 hover:text-primary hover:bg-primary/10 border border-white/5 transition-all"
          title="Upload New Image"
        >
          <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
        </button>

        <button 
          onClick={onSave}
          disabled={!canSave}
          className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all text-xs font-bold uppercase tracking-widest ${
            canSave 
              ? 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-background-dark shadow-[0_0_20px_rgba(48,232,122,0.1)]' 
              : 'text-white/20 cursor-not-allowed border border-white/5'
          }`}
        >
          <span className="material-symbols-outlined text-sm">download</span>
          Save
        </button>
      </div>
    </header>
  );
};

export default Header;
