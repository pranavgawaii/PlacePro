"use client";

import Link from "next/link";

export function LandingNavbar() {
    return (
        <header className="w-full h-[80px] px-8 flex items-center justify-between relative z-20 bg-white border-y-2 border-black">
            <Link href="/" className="flex items-center gap-2 group hover-logo-3d">
                <img src="/brand/logo.png" alt="PlacePro Logo" className="w-8 h-8 object-contain" />
                <span className="text-xl font-semibold tracking-tight text-neutral-900 transition-colors group-hover:text-blue-600">PlacePro</span>
            </Link>

            <nav className="hidden md:flex gap-8 text-[15px] font-medium text-neutral-600">
                {["Product", "Features", "Pricing", "Resources"].map((item) => (
                    <Link
                        key={item}
                        className="relative group hover:text-black transition-colors"
                        href={`#${item.toLowerCase()}`}
                    >
                        {item}
                        <span className="absolute left-0 -bottom-1 w-0 h-[2px] bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                    </Link>
                ))}
            </nav>

            <div className="relative group">
                <Link href="/login">
                    <button className="bg-black text-white px-6 py-2.5 text-sm font-medium relative hover:bg-blue-600 transition-colors shadow-sm active:translate-y-0.5">
                        Book a Demo
                        <div className="absolute top-1 left-1 w-1 h-1 bg-white rounded-full"></div>
                        <div className="absolute top-1 right-1 w-1 h-1 bg-white rounded-full"></div>
                        <div className="absolute bottom-1 left-1 w-1 h-1 bg-white rounded-full"></div>
                        <div className="absolute bottom-1 right-1 w-1 h-1 bg-white rounded-full"></div>
                    </button>
                </Link>
            </div>
        </header>
    );
}
