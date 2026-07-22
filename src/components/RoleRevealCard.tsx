import React from 'react';

export interface Teammate {
  id: string;
  nickname: string;
  role: string;
}

interface RoleRevealCardProps {
  role: string;
  teammates?: Teammate[];
  onContinue: () => void;
}

const getRoleDescription = (role: string) => {
  switch (role) {
    case 'Vampir': return 'Geceleri avlan, gündüzleri masum rolü yap. Kasabayı ele geçir.';
    case 'Doktor': return 'Geceleri bir kişiyi iyileştirme gücüne sahipsin. Vampirlerin hedefini tahmin et.';
    case 'Avcı': return 'Geceleri bir kişinin vampir olup olmadığını öğrenebilirsin. Kahin yeteneklerine sahipsin.';
    case 'Soytarı': return 'Amacın gündüzleri kendini astırmak. Eğer asılırsan, oyunu sen kazanırsın!';
    case 'Silahşör': return 'Geceleri silahını ateşleyip birini vurma hakkın var. Ancak dikkatli ol, masum birini vurursan sen de ölürsün!';
    default: return 'Geceleri hayatta kalmaya çalış, gündüzleri vampirleri bulup as!';
  }
};

export const RoleRevealCard: React.FC<RoleRevealCardProps> = ({ role, teammates, onContinue }) => {
  const isVampire = role === 'Vampir';
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in duration-1000 fill-mode-forwards p-2">
      <div className={`glass-panel p-6 md:p-12 rounded-2xl max-w-md w-full text-center border-t border-l ${
        isVampire ? 'border-primary/50 shadow-[0_0_50px_rgba(139,0,0,0.3)]' : 'border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.05)]'
      }`}>
        <h2 className="text-gray-400 uppercase tracking-[0.3em] text-xs md:text-sm mb-2 md:mb-4">Senin Rolün</h2>
        <h1 className={`text-4xl md:text-5xl font-serif mb-4 md:mb-6 drop-shadow-md ${isVampire ? 'text-primary' : 'text-white'}`}>
          {role}
        </h1>
        <p className="text-gray-300 mb-8 leading-relaxed">
          {getRoleDescription(role)}
        </p>
        
        {teammates && teammates.length > 0 && (
          <div className="mb-8 p-4 bg-black/30 rounded-lg border border-white/10 text-left animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 fill-mode-both">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">
              Takım Arkadaşların
            </h3>
            <ul className="space-y-2">
              {teammates.map(t => (
                <li key={t.id} className="text-white flex items-center gap-3 font-medium">
                  <span className={`w-2 h-2 rounded-full ${isVampire ? 'bg-primary' : 'bg-secondary'}`}></span>
                  {t.nickname}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button 
          onClick={onContinue}
          className={`w-full py-3 rounded-lg font-medium transition-all ${
            isVampire 
              ? 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20' 
              : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
          }`}
        >
          Devam Et
        </button>
      </div>
    </div>
  );
};
