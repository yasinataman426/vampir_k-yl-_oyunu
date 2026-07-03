import React, { useEffect, useState } from 'react';
import { RoleCounts, getDefaultRoles, calculateTotalSpecialRoles } from '@/lib/gameLogic';

interface RoleSettingsPanelProps {
  playerCount: number;
  roleCounts: RoleCounts;
  onChange: (newCounts: RoleCounts) => void;
}

const ROLE_LABELS: Record<keyof RoleCounts, string> = {
  vampire: 'Vampir',
  doctor: 'Doktor',
  hunter: 'Avcı',
  jester: 'Soytarı',
  gunslinger: 'Silahşör'
};

export const RoleSettingsPanel: React.FC<RoleSettingsPanelProps> = ({ playerCount, roleCounts, onChange }) => {
  const [isAuto, setIsAuto] = useState(true);

  useEffect(() => {
    if (isAuto) {
      onChange(getDefaultRoles(playerCount));
    }
  }, [playerCount, isAuto, onChange]); // Note: In a real app we might want to memoize this or handle deps carefully to prevent infinite loops.

  const handleCountChange = (role: keyof RoleCounts, delta: number) => {
    setIsAuto(false);
    const newCount = Math.max(0, roleCounts[role] + delta);
    const newCounts = { ...roleCounts, [role]: newCount };
    
    // Prevent adding if it exceeds player count
    if (delta > 0 && calculateTotalSpecialRoles(newCounts) > playerCount) {
      return;
    }
    
    onChange(newCounts);
  };

  const totalSpecial = calculateTotalSpecialRoles(roleCounts);
  const remainingVillagers = Math.max(0, playerCount - totalSpecial);

  return (
    <div className="glass-panel p-6 rounded-xl w-full">
      <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
        <h3 className="text-xl font-serif text-white">Rol Dağılımı</h3>
        <button 
          onClick={() => setIsAuto(true)}
          disabled={isAuto}
          className={`text-sm px-3 py-1 rounded-full border transition-colors ${
            isAuto 
              ? 'bg-primary/20 text-primary border-primary/30 cursor-default' 
              : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/30'
          }`}
        >
          {isAuto ? 'Otomatik Hesaplandı' : 'Varsayılana Dön'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {(Object.keys(ROLE_LABELS) as Array<keyof RoleCounts>).map((role) => (
          <div key={role} className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
            <span className="text-gray-300 font-medium">{ROLE_LABELS[role]}</span>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => handleCountChange(role, -1)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-primary transition-colors disabled:opacity-30 disabled:hover:bg-white/10"
                disabled={roleCounts[role] <= 0}
              >
                -
              </button>
              <span className="text-xl font-mono text-white w-4 text-center">{roleCounts[role]}</span>
              <button 
                onClick={() => handleCountChange(role, 1)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-primary transition-colors disabled:opacity-30 disabled:hover:bg-white/10"
                disabled={totalSpecial >= playerCount}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-black/40 p-4 rounded-lg flex justify-between items-center border border-secondary/20">
        <span className="text-gray-400">Geriye Kalan (Köylü)</span>
        <span className="text-2xl font-mono text-secondary">{remainingVillagers}</span>
      </div>

      {totalSpecial > playerCount && (
        <p className="text-red-400 text-sm mt-4 text-center">
          Uyarı: Atanan özel rol sayısı toplam oyuncu sayısını geçemez!
        </p>
      )}
    </div>
  );
};
