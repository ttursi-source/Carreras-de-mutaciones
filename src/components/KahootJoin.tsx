import React, { useState } from 'react';

interface KahootJoinProps {
  onJoinCode: (code: string) => void;
  onBack: () => void;
}

export const KahootJoin: React.FC<KahootJoinProps> = ({ onJoinCode, onBack }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let cleanPin = pin.trim().toUpperCase();
    if (!cleanPin) {
      setError('Por favor ingresá el PIN o número de sala (ej: 1, 2, 3)');
      return;
    }
    // If typed "SALA 1" or "SALA 2", normalize to number
    cleanPin = cleanPin.replace(/^SALA\s*/i, '');
    setError('');
    onJoinCode(cleanPin);
  };

  const handleQuickPin = (code: string) => {
    onJoinCode(code);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#46178f] via-[#25076b] to-[#130238] text-white relative overflow-hidden select-none">
      {/* Decorative Kahoot-style geometric shapes in background */}
      <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-red-500/20 blur-xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-44 h-44 rounded-full bg-blue-500/20 blur-xl pointer-events-none" />
      <div className="absolute top-1/3 -right-8 w-28 h-28 rounded-full bg-yellow-400/20 blur-lg pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-6 z-10">
        <div className="text-4xl mb-1 animate-bounce" style={{ animationDuration: '1.5s' }}>
          🎮
        </div>
        <h1 className="pixel-text text-3xl sm:text-4xl font-black text-yellow-300 drop-shadow-[2px_2px_0px_#000] tracking-wider">
          UNIRTE A PARTIDA
        </h1>
        <p className="text-xs sm:text-sm text-purple-200 mt-1 font-medium">
          Ingresá el PIN que te compartió tu amigo/a
        </p>
      </div>

      {/* Main Kahoot-Style Card */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs bg-white text-slate-900 rounded-3xl p-5 shadow-2xl border-4 border-[#e9c46a] flex flex-col items-center z-10"
      >
        <label htmlFor="kahoot-pin-input" className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          PIN O CÓDIGO DE SALA:
        </label>

        <input
          id="kahoot-pin-input"
          type="text"
          value={pin}
          onChange={e => {
            setPin(e.target.value.toUpperCase());
            if (error) setError('');
          }}
          placeholder="Ej: 1, 2, ABCD"
          maxLength={8}
          autoFocus
          className="w-full text-center text-2xl sm:text-3xl font-black tracking-widest font-mono py-3 px-3 rounded-2xl border-3 border-purple-800 bg-purple-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-yellow-400 text-purple-950 uppercase mb-3 shadow-inner"
        />

        {error && (
          <div className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1 mb-3 text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!pin.trim()}
          className={`w-full py-3.5 rounded-2xl font-black text-lg tracking-wider text-white shadow-lg transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
            pin.trim()
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 border-b-4 border-emerald-800'
              : 'bg-gray-400 opacity-60 cursor-not-allowed border-b-4 border-gray-600'
          }`}
        >
          <span>🚀</span> ENTRAR A LA PARTIDA
        </button>

        {/* Quick public room shortcuts */}
        <div className="w-full border-t border-gray-200 mt-4 pt-3 text-center">
          <span className="text-[11px] font-bold text-gray-400 block mb-1.5">
            O entrá a una sala pública estándar:
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {['1', '2', '3', '4', '5', '6'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleQuickPin(num)}
                className="py-1 px-2 rounded-lg font-bold text-xs bg-purple-100 hover:bg-yellow-300 text-purple-900 border border-purple-300 cursor-pointer transition active:scale-95"
              >
                Sala {num}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="mt-5 text-xs text-purple-200 hover:text-white font-bold underline cursor-pointer z-10"
      >
        ← Volver al Menú Principal
      </button>

      {/* Helpful explanation */}
      <div className="mt-4 max-w-xs text-center text-[11px] text-purple-300/80 leading-tight z-10">
        💡 Al ingresar el PIN, vas a <b>crear tu propio clon mutante</b> personalizado para correr en la partida.
      </div>
    </div>
  );
};
