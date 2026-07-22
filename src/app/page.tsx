"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { CreateRoomModal } from "@/components/CreateRoomModal";
import { JoinRoomModal } from "@/components/JoinRoomModal";

export default function Home() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Image with breathing animation */}
      <div className="absolute inset-0 -z-20 overflow-hidden bg-black">
        <Image
          src="/vampire_bg_v4.png"
          alt="Vampir Köylü Background"
          fill
          priority
          className="w-full h-full opacity-50 animate-breath"
          style={{ objectFit: 'fill' }}
        />
      </div>
      
      {/* Dark gradient overlay to ensure text readability */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none" />

      <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 relative z-10">
        <h1 className="text-5xl md:text-7xl font-serif text-white tracking-widest uppercase mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          Vampir <span className="text-primary">Köylü</span>
        </h1>
        <p className="text-gray-400 text-lg md:text-xl font-light tracking-wide max-w-md mx-auto drop-shadow-md">
          Kasabaya gece çöküyor... Kimin dost, kimin düşman olduğunu bulabilir misin?
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both relative z-10">
        <Button 
          variant="primary" 
          fullWidth 
          onClick={() => setIsCreateModalOpen(true)}
          className="text-lg py-4"
        >
          Oda Kur
        </Button>
        <Button 
          variant="secondary" 
          fullWidth 
          onClick={() => setIsJoinModalOpen(true)}
          className="text-lg py-4"
        >
          Odaya Katıl
        </Button>
      </div>

      {/* Modals */}
      <CreateRoomModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />
      <JoinRoomModal 
        isOpen={isJoinModalOpen} 
        onClose={() => setIsJoinModalOpen(false)} 
      />
    </main>
  );
}
