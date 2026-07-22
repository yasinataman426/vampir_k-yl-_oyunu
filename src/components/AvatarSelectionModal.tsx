import React, { useState } from 'react';
import { AVATARS } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/Button';

interface AvatarSelectionModalProps {
  isOpen: boolean;
  currentPlayerId: string;
  takenAvatars: string[];
}

export const AvatarSelectionModal: React.FC<AvatarSelectionModalProps> = ({ 
  isOpen, 
  currentPlayerId, 
  takenAvatars 
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelect = async () => {
    if (!selectedAvatar) return;
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('players')
        .update({ avatar_id: selectedAvatar })
        .eq('id', currentPlayerId);

      if (error) {
        throw error;
      }
      // If successful, the Realtime listener in LobbyPage will update the currentPlayer,
      // which will naturally close this modal because currentPlayer.avatar_id will no longer be null.
    } catch (err: any) {
      console.error(err);
      alert('Bu karakter az önce başkası tarafından alındı, lütfen başka bir karakter seçin.');
      setSelectedAvatar(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4 animate-in fade-in duration-500 backdrop-blur-sm">
      <div className="max-w-4xl w-full text-center flex flex-col h-[90vh] md:h-auto">
        <div className="shrink-0 mb-4">
          <h2 className="text-3xl md:text-5xl font-serif text-white mb-2 drop-shadow-lg">Karakterini Seç</h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base hidden sm:block">
            Kasabaya girmeden önce kimliğine bürüneceğin karakterini seç. 
            Unutma, diğer oyuncuların seçtiği karakterler kilitlenir.
          </p>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 overflow-y-auto flex-1 md:max-h-[65vh] p-2 custom-scrollbar">
          {AVATARS.map((avatar) => {
            const isTaken = takenAvatars.includes(avatar.id);
            const isSelected = selectedAvatar === avatar.id;

            return (
              <button
                key={avatar.id}
                disabled={isTaken || isSubmitting}
                onClick={() => setSelectedAvatar(avatar.id)}
                className={`relative group rounded-xl border-2 transition-all p-1 flex flex-col items-center gap-2
                  ${isTaken ? 'opacity-30 grayscale border-transparent cursor-not-allowed' : ''}
                  ${!isTaken && isSelected ? 'border-primary scale-110 shadow-[0_0_20px_rgba(139,0,0,0.6)] bg-primary/20 z-10' : ''}
                  ${!isTaken && !isSelected ? 'border-white/10 hover:border-white/40 hover:bg-white/10' : ''}
                `}
              >
                <div className="w-full aspect-square rounded-lg overflow-hidden bg-black">
                   <img 
                     src={avatar.src} 
                     alt={avatar.name} 
                     className="w-full h-full object-cover"
                   />
                </div>
                <span className={`text-xs font-medium truncate w-full ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                  {avatar.name}
                </span>
                
                {isTaken && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                    <span className="text-red-500 text-3xl">🔒</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="shrink-0 mt-6">
          <Button 
            variant="primary" 
            className="px-16 py-4 text-xl"
            disabled={!selectedAvatar || isSubmitting}
            onClick={handleSelect}
          >
            {isSubmitting ? 'Onaylanıyor...' : 'Seçimi Onayla'}
          </Button>
        </div>
      </div>
    </div>
  );
};
