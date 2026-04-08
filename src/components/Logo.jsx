import React from 'react';

const Logo = ({ className = "w-8 h-8", textClassName = "text-xl" }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative group shrink-0">
        <div className="absolute -inset-1 bg-emerald-500/20 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
        <img 
          src="/favicon.png" 
          alt="SplitPay Icon" 
          className="relative w-10 h-10 rounded-xl object-contain shadow-lg shadow-black/20 transform hover:scale-105 transition-transform"
        />
      </div>
      <span className={`font-black tracking-tighter dark:text-white ${textClassName} uppercase leading-none`}>
        Split<span className="text-emerald-500">Pay</span>
      </span>
    </div>
  );
};

export default Logo;
