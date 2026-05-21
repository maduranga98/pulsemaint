export default function AuthLoading() {
  return (
    <div className="fixed inset-0 bg-[#0A1628] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        {/* PulseMaint Logo */}
        <div className="text-center">
          <div className="text-4xl font-bold">
            <span className="text-white">Pulse</span>
            <span className="text-[#00C2FF]">Maint</span>
          </div>
        </div>

        {/* Animated pulse line */}
        <div className="w-16 h-16 relative">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polyline
              points="10,50 30,50 35,30 40,70 45,40 50,50 100,50"
              fill="none"
              stroke="#00C2FF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-pulse"
            />
          </svg>
        </div>

        {/* Loading text */}
        <p className="text-[#00C2FF] text-lg font-medium animate-pulse">
          Loading...
        </p>
      </div>
    </div>
  );
}
